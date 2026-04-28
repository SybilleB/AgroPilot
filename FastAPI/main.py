import os
import json
import asyncio
from fastapi import FastAPI, HTTPException
from google import genai
from google.genai import types
from schemas import RequeteTop3, ResultatRecommandations, RequeteIA, ConseilAgricole
from services import get_previsions_meteo

app = FastAPI()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
if not GOOGLE_API_KEY:
    print("⚠️ ATTENTION : La clé API Google n'est pas définie dans le fichier .env !")

client_gemini = genai.Client(api_key=GOOGLE_API_KEY)

with open("data/cultures.json", "r", encoding="utf-8") as f:
    CULTURES_DB = json.load(f)

async def call_gemini(prompt: str, schema) -> dict:
    """Appelle Gemini avec le SDK officiel, force le format JSON et gère les pannes."""
    
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=503, detail="Clé API manquante")

    models_to_try = [
        "models/gemini-3.1-flash-lite-preview",
        "models/gemini-3-flash-preview",
        "models/gemini-2.0-flash",
        "models/gemini-flash-latest"
    ]

    last_error = ""

    for model_name in models_to_try:
        try:
            print(f"🤖 Tentative avec le modèle : {model_name}...")
            
            reponse = await client_gemini.aio.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1, 
                    response_mime_type="application/json",
                    response_schema=schema,
                ),
            )
            
            print(f"✅ Succès avec {model_name} !")
            return json.loads(reponse.text) 
        except Exception as e:
            last_error = str(e)
            print(f"❌ Échec avec {model_name} : {last_error}")
            print("⏳ Attente de 2 secondes avant la prochaine tentative...")
            await asyncio.sleep(2)
            continue 

    raise HTTPException(
        status_code=502, 
        detail=f"Échec critique IA après plusieurs tentatives. Dernière erreur : {last_error}"
    )

def calculer_marges_rapide(cultures_db,hec,sol):
    return {
        c["label"]: ((c["rendement_optimal_t_ha"] * c["prix_vente_t"]) - c["charges_ha"][sol]["total"])*hec
        for c in cultures_db["cultures"]
    }


@app.post("/api/ia/recommandations")
async def generer_recommandations(requete: RequeteTop3):
    marge=calculer_marges_rapide(CULTURES_DB,requete.hectares,requete.type_sol)
    
    try:
        meteo = await get_previsions_meteo(requete.latitude, requete.longitude)
    except Exception as e:
        print("❌ ERREUR MÉTÉO :", repr(e))
        meteo = "Données météo indisponibles."

    prompt = f"""
    Tu es un conseiller agronome expert.
    
    DONNÉES : {requete.hectares}ha, Sol: {requete.type_sol}, Météo: {json.dumps(meteo)}
    BASE CULTURES : {json.dumps(CULTURES_DB)}
    Marge brute : {marge}

    MISSION :
    1. Calcule la rentabilité de CHAQUE culture de la base.
    2. Applique la règle de recommandation suivante :
       - Une culture est 'recommandée' si sa Marge Brute > 0 ET que la météo n'est pas 'Défavorable'.
       - Sinon, elle est 'non recommandé'.
    3. FILTRE ET TRIE : Garde UNIQUEMENT les cultures avec le statut 'recommandé' et trie-les par marge brute décroissante (de la plus rentable à la moins rentable).
    4. LIMITE LE RÉSULTAT : Isole strictement les 3 premières cultures de cette liste triée (Le TOP 3).
    
    IMPORTANT : 
    - Si seulement 1 ou 2 cultures remplissent les critères, retourne uniquement celles-là. 
    - Si aucune culture ne remplit les critères de rentabilité ou de météo, retourne une liste vide [].
    """

    return await call_gemini(prompt, ResultatRecommandations)


@app.post("/api/ia/generer-conseil")
async def generer_conseil_agricole(requete: RequeteIA):
    
    culture_data = next((c for c in CULTURES_DB if c["libelle"].lower() == requete.culture.lower()), None)
    if not culture_data:
        raise HTTPException(status_code=404, detail="Culture non trouvée dans la base")

    try:
        meteo = await get_previsions_meteo(requete.latitude, requete.longitude)
    except Exception as e:
        print("❌ ERREUR MÉTÉO :", repr(e))
        meteo = "Données météo indisponibles."

    prompt = f"""
    Tu es un conseiller agronome expert et un spécialiste de la gestion financière agricole. 
    
    DONNÉES DE L'AGRICULTEUR :
    - Surface : {requete.hectares} hectares
    - Culture visée : {requete.culture}
    - Type de sol : {requete.type_sol}
    
    RÉFÉRENCES AGRONOMIQUES POUR CETTE CULTURE :
    {json.dumps(culture_data, ensure_ascii=False)}
    
    MÉTÉO PRÉVUE (7 jours) :
    {json.dumps(meteo, ensure_ascii=False)}
    
    MISSION ÉTAPE PAR ÉTAPE :
    1. Calcule le rendement total estimé pour la surface donnée. ATTENTION : Tu dois multiplier le rendement moyen de base par le coefficient du type de sol '{requete.type_sol}'.
    2. Calcule le chiffre d'affaires total (Rendement total * Prix de vente).
    3. Calcule les charges totales (Charges par hectare * Surface).
    4. Calcule la marge brute estimée (Chiffre d'affaires - Charges totales).
    5. Analyse la météo à 7 jours par rapport aux 'regles_semis' de cette culture pour rédiger un conseil d'action précis et court (3 lignes max).
    6. Définis un statut clair basé sur la météo : 'FEU VERT', 'FEU ROUGE' ou 'ATTENTE'.
    7. Évalue la viabilité globale du projet (en croisant le malus/bonus du sol et le statut météo) et donne ton verdict final strict : 'recommandé' ou 'non recommandé'.
    """

    resultat_json = await call_gemini(prompt, ConseilAgricole)
    
    return resultat_json