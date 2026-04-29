"""
FastAPI — AgroPilot backend
Endpoints :
  GET  /                          → healthcheck
  POST /subventions/suggestions   → analyse IA (Tavily + Gemini) des aides éligibles
  POST /marche/analyse            → analyse marchés personnalisée (prix MATIF + news + IA)
  POST /marche/recherche          → recherche libre sur n'importe quel sujet agricole
  POST /api/ia/recommandations    → recommandations de cultures (Top 3)
  POST /api/ia/generer-conseil    → conseil sur une culture spécifique
"""

import os
import json
import asyncio
import datetime
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
from google import genai
from google.genai import types
from dotenv import load_dotenv

from schemas import *
from services import get_previsions_meteo

load_dotenv()

app = FastAPI(title="AgroPilot API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

if not GOOGLE_API_KEY:
    print("⚠️ ATTENTION : La clé API Google n'est pas définie dans le fichier .env !")

client_gemini = genai.Client(api_key=GOOGLE_API_KEY)

try:
    with open("data/cultures.json", "r", encoding="utf-8") as f:
        CULTURES_DB = json.load(f)
except FileNotFoundError:
    print("⚠️ ATTENTION : Fichier data/cultures.json introuvable !")
    CULTURES_DB = {"cultures": []}


TYPE_LABELS = {
    "grandes_cultures": "grandes cultures (céréales, oléagineux)",
    "elevage_bovin":    "élevage bovin",
    "elevage_porcin":   "élevage porcin",
    "elevage_avicole":  "élevage avicole",
    "viticulture":      "viticulture",
    "maraichage":       "maraîchage",
    "arboriculture":    "arboriculture",
    "mixte":            "exploitation mixte",
}

METHODE_LABELS = {
    "conventionnelle": "agriculture conventionnelle",
    "raisonnee":       "agriculture raisonnée",
    "hve":             "HVE (Haute Valeur Environnementale)",
    "bio":             "agriculture biologique",
    "biodynamie":      "biodynamie",
}

CULTURE_LABELS = {
    "ble_tendre":   "blé tendre",
    "ble_dur":      "blé dur",
    "mais":         "maïs",
    "colza":        "colza",
    "soja":         "soja",
    "orge":         "orge",
    "tournesol":    "tournesol",
    "pois":         "pois protéagineux",
    "lin":          "lin",
    "betterave":    "betterave sucrière",
    "pomme_de_terre": "pomme de terre",
    "vigne":        "vigne",
    "prairie":      "prairies / fourrage",
}

def calculer_marges_rapide(cultures_db, hec, sol):
    """Calcule les marges brutes pour la route recommandations."""
    if "cultures" not in cultures_db:
        return {}
    marges = {}
    for c in cultures_db["cultures"]:
        try:
            revenu_ha = c["rendement_optimal_t_ha"] * c["prix_vente_t"]
            charges_ha = c["charges_ha"].get(sol, {}).get("total", 0)
            marges[c["label"]] = (revenu_ha - charges_ha) * hec
        except KeyError:
            continue
    return marges



def build_search_queries(p: ProfilePayload) -> List[str]:
    type_label = TYPE_LABELS.get(p.type_exploitation or "", p.type_exploitation or "agriculteur")
    methode    = METHODE_LABELS.get(p.methode_production or "", "")
    localisation = p.region or p.departement or "France"

    queries = [
        f"subventions aides agricoles {type_label} 2024 2025 France",
        f"aides PAC éco-régimes {type_label} {localisation} 2025",
    ]

    if p.methode_production in ("bio", "hve", "biodynamie", "raisonnee"):
        queries.append(f"aides financières {methode} agriculteur France 2025")
    if p.certifications:
        certs = " ".join(p.certifications)
        queries.append(f"subventions certification {certs} exploitation agricole France")
    if p.region or p.departement:
        queries.append(f"aides régionales agriculteurs {localisation} 2025 conseil régional")

    return queries[:5]

async def tavily_search(query: str, client: httpx.AsyncClient) -> List[dict]:
    if not TAVILY_API_KEY:
        return []
    try:
        resp = await client.post(
            "https://api.tavily.com/search",
            json={
                "api_key": TAVILY_API_KEY,
                "query":   query,
                "max_results": 4,
                "search_depth": "advanced",
                "include_answer": True,
            },
            timeout=15.0,
        )
        return resp.json().get("results", [])
    except Exception:
        return []

def build_claude_prompt(p: ProfilePayload, search_results: List[dict]) -> str:
    profile_lines = []
    if p.type_exploitation: profile_lines.append(f"- Type : {TYPE_LABELS.get(p.type_exploitation, p.type_exploitation)}")
    if p.methode_production: profile_lines.append(f"- Méthode : {METHODE_LABELS.get(p.methode_production, p.methode_production)}")
    if p.surface_ha: profile_lines.append(f"- Surface : {p.surface_ha} ha")
    if p.certifications: profile_lines.append(f"- Certifications : {', '.join(p.certifications).upper()}")
    if p.cultures: profile_lines.append(f"- Cultures : {', '.join(p.cultures).replace('_', ' ')}")
    if p.departement or p.region: profile_lines.append(f"- Localisation : {' / '.join(filter(None, [p.departement, p.region]))}")

    profile_summary = "\n".join(profile_lines) if profile_lines else "Profil non renseigné"

    snippets = []
    for r in search_results[:12]:
        snippets.append(f"[{r.get('title', '')}]\n{r.get('content', '')[:400]}\nURL: {r.get('url', '')}")
    tavily_block = "\n\n---\n".join(snippets) if snippets else "Aucun résultat de recherche disponible."

    return f"""Tu es un conseiller agricole expert en aides et subventions.
## Profil de l'exploitant
{profile_summary}

## Sources récentes (Tavily)
{tavily_block}

## Ta mission
Retourne une liste JSON de 4 à 8 subventions/aides pour cet exploitant.
Format d'un objet : {{"nom": "...", "organisme": "...", "description": "...", "montant_label": "...", "pourquoi_eligible": "...", "demarches": "...", "url": "...", "categorie": "...", "score": 5}}
"""

def build_marche_queries(req: MarcheRequest) -> List[str]:
    today = datetime.date.today().strftime("%B %Y")
    cultures_labels = [CULTURE_LABELS.get(c, c.replace("_", " ")) for c in (req.cultures or [])]
    localisation = req.region or req.departement or "France"
    type_label = TYPE_LABELS.get(req.type_exploitation or "", "agriculture")

    queries = []
    if cultures_labels:
        crops_str = " ".join(cultures_labels[:4])
        queries.append(f"cours prix {crops_str} MATIF Euronext €/tonne {today}")
        queries.append(f"tendance marché {crops_str} France prévision prix {today}")
    else:
        queries.append(f"prix céréales blé maïs colza MATIF Euronext €/tonne {today}")

    queries.append(f"prix engrais urée azote carburant GNR agriculteur France {today}")
    queries.append(f"actualités marché agricole conjoncture {type_label} {localisation} {today}")
    return queries[:5]

def build_marche_prompt(req: MarcheRequest, search_results: List[dict]) -> str:
    today = datetime.date.today().strftime("%d/%m/%Y")
    snippets = [f"[{r.get('title', '')}]\n{r.get('content', '')[:500]}\nURL: {r.get('url', '')}" for r in search_results[:15]]
    tavily_block = "\n\n---\n".join(snippets) if snippets else "Pas de résultats disponibles."

    return f"""Tu es un analyste de marché agricole expert. Date du jour : {today}
## Sources (Tavily)
{tavily_block}
## Ta mission
Retourne UN OBJET JSON UNIQUE analysant le marché avec : prix (MATIF), synthese, recommandations, opportunites, risques, actualites, horodatage.
"""

def build_recherche_prompt(question: str, cultures: List[str], search_results: List[dict]) -> str:
    today = datetime.date.today().strftime("%d/%m/%Y")
    snippets = [f"[{r.get('title', '')}]\n{r.get('content', '')[:600]}\nURL: {r.get('url', '')}" for r in search_results[:10]]
    tavily_block = "\n\n---\n".join(snippets) if snippets else "Aucune source trouvée."
    
    return f"""Tu es un expert agricole. Date : {today}
## Question : {question}
## Sources (Tavily) : {tavily_block}
## Ta mission : Réponds en texte libre structuré. Retourne UN JSON: {{"reponse": "...", "points_cles": ["..."], "sources_utilisees": ["..."]}}
"""


async def call_gemini_schema(prompt: str, schema) -> dict:
    """Utilisé quand on a un schéma Pydantic strict (Top3, ConseilAgricole)"""
    if not GOOGLE_API_KEY: raise HTTPException(status_code=503, detail="Clé API manquante")
    
    models_to_try = ["models/gemini-3.1-flash-lite-preview", "models/gemini-3-flash-preview", "models/gemini-2.0-flash", "models/gemini-flash-latest"]
    for model_name in models_to_try:
        try:
            print(f"🤖 [SCHEMA] Tentative avec : {model_name}...")
            reponse = await client_gemini.aio.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.1, 
                    response_mime_type="application/json",
                    response_schema=schema,
                ),
            )
            return json.loads(reponse.text)
        except Exception as e:
            print(f"❌ [SCHEMA] Échec {model_name} : {e}")
            await asyncio.sleep(2)
            continue
    raise HTTPException(status_code=502, detail="IA indisponible (Schema)")

async def call_gemini_json(prompt: str) -> dict | list:
    """Utilisé pour la recherche, les marchés et les subventions (Format JSON dynamique)"""
    if not GOOGLE_API_KEY: raise HTTPException(status_code=503, detail="Clé API manquante")

    models_to_try = ["models/gemini-3.1-flash-lite-preview", "models/gemini-3-flash-preview", "models/gemini-2.0-flash", "models/gemini-flash-latest"]
    for model_name in models_to_try:
        try:
            print(f"🤖 [JSON] Tentative avec : {model_name}...")
            reponse = await client_gemini.aio.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2, 
                    response_mime_type="application/json"
                ),
            )
            return json.loads(reponse.text)
        except Exception as e:
            print(f"❌ [JSON] Échec {model_name} : {e}")
            await asyncio.sleep(2)
            continue
    raise HTTPException(status_code=502, detail="IA indisponible (JSON)")



@app.get("/")
def read_root():
    return {"status": "ok", "service": "AgroPilot API"}

@app.post("/subventions/suggestions", response_model=List[SubventionCard])
async def get_subvention_suggestions(profile: ProfilePayload):
    async with httpx.AsyncClient() as client:
        queries = build_search_queries(profile)
        tasks   = [tavily_search(q, client) for q in queries]
        results_nested = await asyncio.gather(*tasks)

        seen = set()
        search_results = []
        for batch in results_nested:
            for r in batch:
                url = r.get("url", "")
                if url not in seen:
                    seen.add(url)
                    search_results.append(r)

        prompt = build_claude_prompt(profile, search_results)
        cards  = await call_gemini_json(prompt)

    validated = []
    if isinstance(cards, list):
        for c in cards:
            try: validated.append(SubventionCard(**c))
            except Exception: pass
    return validated

@app.post("/marche/analyse", response_model=MarcheAnalyse)
async def get_marche_analyse(req: MarcheRequest):
    async with httpx.AsyncClient() as client:
        queries = build_marche_queries(req)
        tasks   = [tavily_search(q, client) for q in queries]
        results_nested = await asyncio.gather(*tasks)

    seen, search_results = set(), []
    for batch in results_nested:
        for r in batch:
            url = r.get("url", "")
            if url not in seen:
                seen.add(url)
                search_results.append(r)

    prompt = build_marche_prompt(req, search_results)
    data   = await call_gemini_json(prompt)

    today = datetime.date.today().strftime("%d/%m/%Y")
    
    # On filtre pour s'assurer que l'IA a bien renvoyé des dictionnaires (objets) 
    # et non du texte brut, pour éviter l'erreur TypeError (**p)
    prix_valides = [PrixCulture(**p) for p in data.get("prix", []) if isinstance(p, dict)]
    recos_valides = [Recommandation(**r) for r in data.get("recommandations", []) if isinstance(r, dict)]
    actus_valides = [Actualite(**a) for a in data.get("actualites", []) if isinstance(a, dict)]

    return MarcheAnalyse(
        prix            = prix_valides,
        synthese        = data.get("synthese", "Synthèse non disponible."),
        recommandations = recos_valides,
        opportunites    = data.get("opportunites", []) if isinstance(data.get("opportunites"), list) else [],
        risques         = data.get("risques", []) if isinstance(data.get("risques"), list) else [],
        actualites      = actus_valides,
        horodatage      = data.get("horodatage", today),
    )

@app.post("/marche/recherche", response_model=RechercheResultat)
async def recherche_marche(req: RechercheRequest):
    async with httpx.AsyncClient() as client:
        cultures_ctx = " ".join([CULTURE_LABELS.get(c, c) for c in (req.cultures or [])])
        enriched_q   = f"{req.question} {cultures_ctx} France agriculteur".strip()
        tasks = [
            tavily_search(enriched_q, client),
            tavily_search(req.question + " prix marché 2025", client),
        ]
        results_nested = await asyncio.gather(*tasks)

    seen, search_results = set(), []
    for batch in results_nested:
        for r in batch:
            url = r.get("url", "")
            if url not in seen:
                seen.add(url)
                search_results.append(r)

    prompt = build_recherche_prompt(req.question, req.cultures or [], search_results)
    data   = await call_gemini_json(prompt)

    sources_raw = [{"titre": r.get("title", ""), "url": r.get("url", "")} for r in search_results[:5]]

    return RechercheResultat(
        question   = req.question,
        reponse    = data.get("reponse", ""),
        sources    = sources_raw,
        horodatage = datetime.date.today().strftime("%d/%m/%Y"),
    )

@app.post("/api/ia/recommandations")
async def generer_recommandations(requete: RequeteTop3):
    marge = calculer_marges_rapide(CULTURES_DB, requete.hectares, requete.type_sol)
    
    try:
        meteo = await get_previsions_meteo(requete.latitude, requete.longitude)
    except Exception as e:
        print("❌ ERREUR MÉTÉO :", repr(e))
        meteo = "Données météo indisponibles."

    prompt = f"""
    Tu es un conseiller agronome expert.
    DONNÉES : {requete.hectares}ha, Sol: {requete.type_sol}, Météo: {json.dumps(meteo)}
    BASE CULTURES : {json.dumps(CULTURES_DB)}
    Marge brute pré-calculée : {json.dumps(marge)}

    MISSION :
    1. Calcule la rentabilité de CHAQUE culture.
    2. Règle : 'recommandée' si Marge Brute > 0 ET météo non 'Défavorable'.
    3. FILTRE ET TRIE : Garde UNIQUEMENT les statuts 'recommandé', tri par marge brute décroissante.
    4. LIMITE : Isole les 3 premières cultures (Le TOP 3). Retourne [] si aucune.
    """
    return await call_gemini_schema(prompt, ResultatRecommandations)

@app.post("/api/ia/generer-conseil")
async def generer_conseil_agricole(requete: RequeteIA):
    
    culture_data = next((c for c in CULTURES_DB.get("cultures", []) if c["label"].lower() == requete.culture.lower()), None)
    if not culture_data:
        raise HTTPException(status_code=404, detail="Culture non trouvée dans la base")

    try:
        meteo = await get_previsions_meteo(requete.latitude, requete.longitude)
    except Exception as e:
        print("❌ ERREUR MÉTÉO :", repr(e))
        meteo = "Données météo indisponibles."

    prompt = f"""
    Conseiller agronome. 
    DONNÉES : {requete.culture} ({requete.hectares} ha), Sol : {requete.type_sol}
    RÉFÉRENCES : {json.dumps(culture_data, ensure_ascii=False)}
    MÉTÉO : {json.dumps(meteo, ensure_ascii=False)}
    
    MISSION :
    1. Rendement estimé (rendement moyen * coeff sol '{requete.type_sol}').
    2. CA (Rendement * Prix).
    3. Charges.
    4. Marge brute (CA - Charges).
    5. Conseil action (3 lignes max).
    6. Statut météo : 'Favorable', 'Défavorable' ou 'Incertain'.
    7. Verdict : 'recommandé' ou 'non recommandé' (si marge > 0 et météo non défavorable).
    """
    return await call_gemini_schema(prompt, ConseilAgricole)

'''
@app.post("/subventions/suggestions/demo", response_model=List[SubventionCard])
...
'''