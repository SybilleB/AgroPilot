"""
FastAPI — AgroPilot backend
Endpoints :
  GET  /                          → healthcheck
  POST /subventions/suggestions   → analyse IA (Tavily + Claude) des aides éligibles
"""

import os
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)

app = FastAPI(title="AgroPilot API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Modèles Pydantic ─────────────────────────────────────────────────────────

class ProfilePayload(BaseModel):
    type_exploitation:  Optional[str]       = None
    methode_production: Optional[str]       = None
    certifications:     Optional[List[str]] = []
    surface_ha:         Optional[float]     = None
    departement:        Optional[str]       = None
    region:             Optional[str]       = None
    commune:            Optional[str]       = None
    cultures:           Optional[List[str]] = []
    situation_familiale:Optional[str]       = None
    date_naissance:     Optional[str]       = None
    nb_enfants:         Optional[int]       = None

class SubventionCard(BaseModel):
    nom:              str
    organisme:        str
    description:      str
    montant_label:    str           # ex: "jusqu'à 5 000 €/an"
    pourquoi_eligible:str           # phrase personnalisée liée au profil
    demarches:        str           # résumé court des démarches
    url:              Optional[str] = None
    categorie:        str           # "pac" | "national" | "regional" | "certification"
    score:            int           # 1-5 (pertinence pour ce profil)

# ─── Helpers ──────────────────────────────────────────────────────────────────

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

def build_search_queries(p: ProfilePayload) -> List[str]:
    """Construit 3-5 requêtes Tavily ciblées sur le profil."""
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

    return queries[:5]  # max 5 requêtes


async def tavily_search(query: str, client: httpx.AsyncClient) -> List[dict]:
    """Appelle l'API Tavily et retourne les résultats bruts."""
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
        data = resp.json()
        return data.get("results", [])
    except Exception:
        return []


def build_claude_prompt(p: ProfilePayload, search_results: List[dict]) -> str:
    """Construit le prompt envoyé à Claude avec profil + résultats Tavily."""
    # Résumé profil
    profile_lines = []
    if p.type_exploitation:
        profile_lines.append(f"- Type d'exploitation : {TYPE_LABELS.get(p.type_exploitation, p.type_exploitation)}")
    if p.methode_production:
        profile_lines.append(f"- Méthode de production : {METHODE_LABELS.get(p.methode_production, p.methode_production)}")
    if p.surface_ha:
        profile_lines.append(f"- Surface : {p.surface_ha} ha")
    if p.certifications:
        profile_lines.append(f"- Certifications : {', '.join(p.certifications).upper()}")
    if p.cultures:
        profile_lines.append(f"- Cultures : {', '.join(p.cultures).replace('_', ' ')}")
    if p.departement or p.region:
        loc = " / ".join(filter(None, [p.departement, p.region]))
        profile_lines.append(f"- Localisation : {loc}")
    if p.situation_familiale:
        profile_lines.append(f"- Situation familiale : {p.situation_familiale}")
    if p.nb_enfants is not None:
        profile_lines.append(f"- Enfants à charge : {p.nb_enfants}")

    profile_summary = "\n".join(profile_lines) if profile_lines else "Profil non renseigné"

    # Extraits Tavily (titre + snippet)
    tavily_block = ""
    if search_results:
        snippets = []
        for r in search_results[:12]:
            title   = r.get("title", "")
            snippet = r.get("content", "")[:400]
            url     = r.get("url", "")
            snippets.append(f"[{title}]\n{snippet}\nURL: {url}")
        tavily_block = "\n\n---\n".join(snippets)
    else:
        tavily_block = "Aucun résultat de recherche disponible — utilise tes connaissances générales sur les aides agricoles françaises 2024-2025."

    return f"""Tu es un conseiller agricole expert en aides et subventions pour les exploitants français.

## Profil de l'exploitant
{profile_summary}

## Sources récentes (Tavily)
{tavily_block}

## Ta mission
Analyse le profil et les sources, puis retourne une liste JSON de 4 à 8 subventions/aides pour lesquelles cet exploitant est potentiellement éligible.

IMPORTANT : retourne UNIQUEMENT un tableau JSON valide, sans texte avant ni après.

Format de chaque objet :
{{
  "nom": "Nom court et précis de l'aide",
  "organisme": "Organisme qui la verse (ex: MSA, FranceAgriMer, Conseil Régional, ASP...)",
  "description": "Description claire en 1-2 phrases de ce que couvre cette aide",
  "montant_label": "Montant ou fourchette (ex: 'jusqu'à 5 000 €/an', '52 €/ha', 'variable')",
  "pourquoi_eligible": "Phrase personnalisée expliquant pourquoi CET exploitant est éligible (mentionne son type, méthode, région...)",
  "demarches": "Résumé des démarches en 1-2 phrases (ex: 'Dossier PAC avant le 15 mai via télépac.fr')",
  "url": "URL officielle si disponible, sinon null",
  "categorie": "pac" ou "national" ou "regional" ou "certification",
  "score": entier de 1 à 5 (5 = très pertinent pour ce profil exact)
}}

Trie par score décroissant. Sois précis, concret et adapté au profil fourni."""


async def call_gemini(prompt: str) -> List[dict]:
    """Appelle Gemini via le SDK officiel (thread pool pour rester async)."""
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=503, detail="GOOGLE_API_KEY manquante dans le fichier .env du serveur.")

    def _run() -> str:
        model = genai.GenerativeModel(
            model_name="gemini-flash-latest",
            generation_config=genai.GenerationConfig(
                temperature=0.3,
                max_output_tokens=4096,
            ),
        )
        response = model.generate_content(prompt)
        return response.text

    try:
        loop = asyncio.get_event_loop()
        raw  = await loop.run_in_executor(ThreadPoolExecutor(max_workers=1), _run)
        raw  = raw.strip()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur Gemini SDK : {e}")

    # Extrait le JSON même si Gemini a ajouté du texte autour
    start = raw.find("[")
    end   = raw.rfind("]") + 1
    if start == -1 or end == 0:
        raise HTTPException(status_code=502, detail=f"Pas de tableau JSON dans la réponse Gemini. Reçu : {raw[:300]}")

    try:
        return json.loads(raw[start:end])
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"JSON non parsable : {e} — Reçu : {raw[start:start+300]}")


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {"status": "ok", "service": "AgroPilot API"}


'''
@app.post("/subventions/suggestions", response_model=List[SubventionCard])
async def get_subvention_suggestions(profile: ProfilePayload):
    """
    Reçoit le profil de l'exploitant, interroge Tavily pour les aides
    récentes, puis demande à Claude de retourner des cartes structurées
    d'éligibilité personnalisées.
    """
    async with httpx.AsyncClient() as client:
        # 1. Recherches Tavily en parallèle
        queries = build_search_queries(profile)
        tasks   = [tavily_search(q, client) for q in queries]
        results_nested = await asyncio.gather(*tasks)

        # Déduplique par URL
        seen   = set()
        search_results = []
        for batch in results_nested:
            for r in batch:
                url = r.get("url", "")
                if url not in seen:
                    seen.add(url)
                    search_results.append(r)

        # 2. Prompt + appel Claude
        prompt = build_claude_prompt(profile, search_results)
        cards  = await call_gemini(prompt)

    # Valide et nettoie
    validated = []
    for c in cards:
        try:
            validated.append(SubventionCard(**c))
        except Exception:
            pass  # ignore les cartes mal formées

    return validated
'''



# ─── Endpoint de démo (données simulées) ─────────────────────────────────────
@app.post("/subventions/suggestions", response_model=List[SubventionCard])
async def get_subvention_suggestions(profile: ProfilePayload):
    """
    MODE DÉMO : Renvoie des données simulées pour éviter l'erreur de quota 429.
    """
    # 1. On prépare une réponse "Fake" ultra réaliste pour ta démo
    mock_cards = [
        {
            "nom": "Dotation Jeunes Agriculteurs (DJA)",
            "organisme": "ASP / État",
            "description": "Aide principale à l'installation pour soutenir les nouveaux exploitants.",
            "montant_label": "Jusqu'à 35 000 €",
            "pourquoi_eligible": f"Adapté à votre profil {profile.type_exploitation or 'agricole'} en zone {profile.region or 'France'}.",
            "demarches": "Dépôt du Plan d'Entreprise (PE) auprès de la DDT.",
            "url": "https://www.economie.gouv.fr",
            "categorie": "national",
            "score": 5
        },
        {
            "nom": "Éco-Régime PAC 2025",
            "organisme": "Europe / ASP",
            "description": "Prime versée aux agriculteurs respectant des pratiques favorables à l'environnement.",
            "montant_label": "82 € / hectare",
            "pourquoi_eligible": "Calculé selon vos méthodes de production.",
            "demarches": "Déclaration annuelle via Télépac avant le 15 mai.",
            "url": "https://www.telepac.agriculture.gouv.fr",
            "categorie": "pac",
            "score": 4
        }
    ]

    # 2. On attend juste 1.5 seconde pour simuler une réflexion de l'IA (plus pro en démo)
    await asyncio.sleep(1.5)

    # 3. On retourne les données simulées
    return [SubventionCard(**c) for c in mock_cards]