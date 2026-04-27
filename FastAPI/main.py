import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import google.generativeai as genai
from tavily import TavilyClient

# 1. Chargement des variables d'environnement
load_dotenv()

# 2. Initialisation de FastAPI
app = FastAPI(title="AgroPilot API")

# Configuration CORS (pour que ton Front-end React puisse appeler l'API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Configuration des clients API
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

# --- ROUTES ---

@app.get("/")
async def root():
    return {"message": "Serveur AgroPilot en ligne"}

@app.get("/test-ia")
async def test_ia():
    """Route de vérification de la connexion Gemini"""
    try:
        # Utilisation du modèle qui a fonctionné lors de nos tests
        model = genai.GenerativeModel('gemini-flash-latest')
        response = model.generate_content("Réponds par 'Liaison établie.'")
        return {
            "status": "Succès",
            "message": response.text
        }
    except Exception as e:
        return {"status": "Erreur", "details": str(e)}

@app.get("/recherche-aides")
async def recherche_aides(query: str = "aides installation agriculteur 2026"):
    """Route principale pour chercher et résumer des aides via Tavily et Gemini"""
    try:
        # 1. Recherche web via Tavily
        # On limite à la France pour plus de pertinence
        search_result = tavily.search(
            query=query, 
            search_depth="advanced", 
            max_results=5
        )
        
        # 2. Préparation du contexte pour l'IA
        contexte = "\n".join([res['content'] for res in search_result['results']])
        
        # 3. Génération du résumé par Gemini
        model = genai.GenerativeModel('gemini-flash-latest')
        prompt = f"""
        Tu es l'assistant AgroPilot. En utilisant les informations suivantes :
        {contexte}
        
        Fais un résumé clair et structuré des aides disponibles pour la requête suivante : {query}.
        Inclus les montants si disponibles et les conditions d'éligibilité.
        Réponds en français.
        """
        
        response = model.generate_content(prompt)
        
        return {
            "query": query,
            "analyse_ia": response.text,
            "sources": [res['url'] for res in search_result['results']]
        }
    except Exception as e:
        return {"status": "Erreur", "details": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)