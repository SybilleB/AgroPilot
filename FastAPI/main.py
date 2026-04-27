import os
import json
from fastapi import FastAPI, HTTPException
from google import genai
from google.genai import types
from schemas import RequeteIA, ConseilAgricole
from services import get_previsions_meteo

app = FastAPI()

# Initialisation du client Gemini
client_gemini = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))

# Chargement de ton JSON local
with open("data/cultures.json", "r", encoding="utf-8") as f:
    CULTURES_DB = json.load(f)

@app.post("/api/ia/generer-conseil")
async def generer_conseil_agricole(requete: RequeteIA):
    # 1. Trouver les infos de la culture
    culture_data = next((c for c in CULTURES_DB if c["libelle"].lower() == requete.culture.lower()), None)
    if not culture_data:
        raise HTTPException(status_code=404, detail="Culture non trouvée dans la base")

    # 2. Récupérer la météo
    try:
        meteo = await get_previsions_meteo(requete.latitude, requete.longitude)
    except Exception:
        meteo = "Données météo indisponibles."

    # 3. Le Prompt (Plus besoin de lui expliquer comment faire un JSON !)
    prompt = f"""
    Tu es un conseiller agronome expert. 
    
    DONNÉES DE L'AGRICULTEUR :
    - Surface : {requete.hectares} hectares
    - Culture visée : {requete.culture}
    - Type de sol : {requete.type_sol}
    
    RÉFÉRENCES AGRONOMIQUES :
    {json.dumps(culture_data, ensure_ascii=False)}
    
    MÉTÉO PRÉVUE (7 jours) :
    {json.dumps(meteo, ensure_ascii=False)}
    
    MISSION :
    Calcule le prévisionnel économique pour cette surface totale en ajustant les rendements au type de sol.
    Analyse la météo pour donner un conseil de semis et un statut (FEU VERT, FEU ROUGE ou ATTENTE).
    """

    # 4. Appel à l'API Gemini (Modèle 2.5 Flash : ultra rapide et économique)
    try:
        reponse = await client_gemini.aio.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1, # Température très basse pour rester mathématique
                response_mime_type="application/json",
                response_schema=ConseilAgricole, # On force Gemini à utiliser ton schéma Pydantic !
            ),
        )
        
        # 5. La réponse est garantie d'être un JSON valide correspondant à ton schéma
        return json.loads(reponse.text)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))