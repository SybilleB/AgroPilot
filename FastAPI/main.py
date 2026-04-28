import os
import json
import asyncio
from fastapi import FastAPI, HTTPException
from google import genai
from google.genai import types
from schemas import RequeteTop3, Top3Reponse
from services import get_previsions_meteo

app = FastAPI()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
if not GOOGLE_API_KEY:
    print("⚠️ ATTENTION : La clé API Google n'est pas définie dans le fichier .env !")

client_gemini = genai.Client(api_key=GOOGLE_API_KEY)

with open("data/cultures.json", "r", encoding="utf-8") as f:
    CULTURES_DB = json.load(f)

async def call_gemini(prompt: str) -> dict:
    """Appelle Gemini avec le SDK officiel, force le format JSON et gère les pannes."""
    
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=503, detail="Clé API manquante")

    # Liste des modèles par ordre de préférence (le Plan A, puis les Plans B)
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
                    response_schema=Top3Reponse, # On force le JSON structuré ici !
                ),
            )
            
            print(f"✅ Succès avec {model_name} !")
            # La réponse est déjà un JSON parfait grâce au response_schema
            return json.loads(reponse.text)

        except Exception as e:
            last_error = str(e)
            print(f"❌ Échec avec {model_name} : {last_error}")
            print("⏳ Attente de 2 secondes avant la prochaine tentative...")
            await asyncio.sleep(2) # On patiente avant de changer de modèle
            continue 

    # Si la boucle se termine sans succès, on lève une erreur critique
    raise HTTPException(
        status_code=502, 
        detail=f"Échec critique IA après plusieurs tentatives. Dernière erreur : {last_error}"
    )

# ==========================================
# 3. ROUTE WEB : LE CONTRÔLEUR
# ==========================================

@app.post("/api/ia/top-3-cultures")
async def generer_top_3(requete: RequeteTop3):
    
    # Étape A : Récupérer la météo
    try:
        meteo = await get_previsions_meteo(requete.latitude, requete.longitude)
    except Exception as e:
        print("❌ ERREUR MÉTÉO :", repr(e))
        meteo = "Données météo indisponibles."

    # Étape B : Construire le Prompt
    prompt = f"""
    Tu es un conseiller agronome d'élite et un expert en rentabilité agricole. 
    
    DONNÉES DE LA PARCELLE DE L'AGRICULTEUR :
    - Surface totale : {requete.hectares} hectares
    - Type de sol : {requete.type_sol}
    
    BASE DE DONNÉES DE TOUTES LES CULTURES POSSIBLES :
    {json.dumps(CULTURES_DB, ensure_ascii=False)}
    
    MÉTÉO PRÉVUE (7 jours) :
    {json.dumps(meteo, ensure_ascii=False)}
    
    TA MISSION ÉTAPE PAR ÉTAPE :
    1. Analyse chaque culture de la base de données.
    2. Calcule le rendement de chaque culture pour la surface donnée. ATTENTION : Tu dois ABSOLUMENT multiplier le rendement moyen de base par le coefficient correspondant au type de sol '{requete.type_sol}' trouvé dans 'affinites_sol'.
    3. Calcule la Marge Brute totale de chaque culture (Revenu total - Charges totales).
    4. Trie toutes les cultures de la plus rentable à la moins rentable.
    5. Isole strictement les 3 meilleures cultures (Le TOP 3).
    6. Pour ces 3 cultures, analyse la météo pour donner un conseil de semis et un statut (FEU VERT, FEU ROUGE ou ATTENTE) en fonction des règles de température et de pluie de chaque plante.
    """

    # Étape C : Déléguer le travail à la fonction call_gemini
    resultat_json = await call_gemini(prompt)
    
    return resultat_json