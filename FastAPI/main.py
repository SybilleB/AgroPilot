"""
FastAPI — AgroPilot backend
Endpoints :
  GET  /                          → healthcheck
  POST /subventions/suggestions   → analyse IA (Tavily + Gemini) des aides éligibles
  POST /marche/analyse            → analyse marchés personnalisée (prix MATIF + news + IA)
  POST /marche/recherche          → recherche libre sur n'importe quel sujet agricole
"""

import os
import json
import asyncio
import datetime
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
    """Appelle Gemini via le SDK officiel avec repli sur plusieurs modèles."""
    
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=503, detail="Clé API manquante")

    # Liste des modèles par ordre de préférence
    models_to_try = [
        "models/gemini-3.1-flash-lite-preview", # Le top du top pour la rapidité
        "models/gemini-3-flash-preview",        # Très performant
        "models/gemini-2.0-flash",              # Stable et rapide
        "models/gemini-flash-latest"
    ]

    last_error = ""

    for model_name in models_to_try:
        try:
            print(f"🤖 Tentative avec le modèle : {model_name}...")
            
            model = genai.GenerativeModel(
                model_name=model_name,
                generation_config=genai.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=4096,
                )
            )

            # Exécution thread-safe pour FastAPI
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, 
                lambda: model.generate_content(prompt)
            )
            
            raw = response.text.strip()
            
            # Extraction du JSON dans la réponse
            start = raw.find("[")
            end = raw.rfind("]") + 1
            if start != -1 and end != 0:
                return json.loads(raw[start:end])
            
        except Exception as e:
            last_error = str(e)
            print(f"❌ Échec avec {model_name} : {last_error}")
            continue 

    raise HTTPException(
        status_code=502, 
        detail=f"Échec critique IA. Dernière erreur : {last_error}"
    )


# ─── Modèles Marchés ──────────────────────────────────────────────────────────

class MarcheRequest(BaseModel):
    cultures:           Optional[List[str]] = []
    type_exploitation:  Optional[str]       = None
    methode_production: Optional[str]       = None
    region:             Optional[str]       = None
    departement:        Optional[str]       = None
    surface_ha:         Optional[float]     = None

class RechercheRequest(BaseModel):
    question: str
    cultures: Optional[List[str]] = []
    region:   Optional[str]       = None

class PrixCulture(BaseModel):
    culture:       str
    prix_actuel:   Optional[str]  = None   # ex: "215 €/t"
    tendance:      Optional[str]  = None   # "hausse" | "baisse" | "stable"
    variation:     Optional[str]  = None   # ex: "+2.3%"
    contexte:      Optional[str]  = None

class Recommandation(BaseModel):
    titre:   str
    detail:  str
    urgence: str  # "haute" | "normale" | "basse"

class Actualite(BaseModel):
    titre:      str
    resume:     str
    source:     Optional[str] = None
    url:        Optional[str] = None
    importance: str  # "haute" | "normale"

class MarcheAnalyse(BaseModel):
    prix:             List[PrixCulture]
    synthese:         str
    recommandations:  List[Recommandation]
    opportunites:     List[str]
    risques:          List[str]
    actualites:       List[Actualite]
    horodatage:       str

class RechercheResultat(BaseModel):
    question:  str
    reponse:   str
    sources:   List[dict]
    horodatage: str

# ─── Helpers Marchés ──────────────────────────────────────────────────────────

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

def build_marche_queries(req: MarcheRequest) -> List[str]:
    """Génère des requêtes Tavily ciblées sur les marchés agricoles."""
    today = datetime.date.today().strftime("%B %Y")
    cultures_labels = [CULTURE_LABELS.get(c, c.replace("_", " ")) for c in (req.cultures or [])]
    localisation = req.region or req.departement or "France"
    type_label = TYPE_LABELS.get(req.type_exploitation or "", "agriculture")

    queries = []

    # Prix matières premières des cultures de l'agriculteur
    if cultures_labels:
        crops_str = " ".join(cultures_labels[:4])
        queries.append(f"cours prix {crops_str} MATIF Euronext €/tonne {today}")
        queries.append(f"tendance marché {crops_str} France prévision prix {today}")
    else:
        queries.append(f"prix céréales blé maïs colza MATIF Euronext €/tonne {today}")

    # Intrants et coûts de production
    queries.append(f"prix engrais urée azote carburant GNR agriculteur France {today}")

    # Actualités marché et conjoncture
    queries.append(f"actualités marché agricole conjoncture {type_label} {localisation} {today}")

    # Concurrence et débouchés
    if cultures_labels:
        queries.append(f"débouchés marchés export {' '.join(cultures_labels[:2])} France compétitivité {today}")

    return queries[:5]


def build_marche_prompt(req: MarcheRequest, search_results: List[dict]) -> str:
    """Construit le prompt Gemini pour l'analyse de marché personnalisée."""
    today = datetime.date.today().strftime("%d/%m/%Y")
    cultures_labels = [CULTURE_LABELS.get(c, c.replace("_", " ")) for c in (req.cultures or [])]
    type_label = TYPE_LABELS.get(req.type_exploitation or "", "agriculteur")
    methode = METHODE_LABELS.get(req.methode_production or "", "")
    localisation = req.region or req.departement or "France"

    profile_lines = [f"- Type : {type_label}"]
    if methode:
        profile_lines.append(f"- Méthode : {methode}")
    if req.surface_ha:
        profile_lines.append(f"- Surface : {req.surface_ha} ha")
    if cultures_labels:
        profile_lines.append(f"- Cultures : {', '.join(cultures_labels)}")
    profile_lines.append(f"- Localisation : {localisation}")

    snippets = []
    for r in search_results[:15]:
        title   = r.get("title", "")
        content = r.get("content", "")[:500]
        url     = r.get("url", "")
        snippets.append(f"[{title}]\n{content}\nURL: {url}")
    tavily_block = "\n\n---\n".join(snippets) if snippets else "Pas de résultats disponibles."

    return f"""Tu es un analyste de marché agricole expert pour les exploitants français.
Date du jour : {today}

## Profil de l'exploitant
{chr(10).join(profile_lines)}

## Sources de marché récentes (Tavily)
{tavily_block}

## Ta mission
Analyse ces données et retourne UN OBJET JSON UNIQUE (pas un tableau) avec l'analyse complète.

IMPORTANT : retourne UNIQUEMENT un objet JSON valide, sans texte avant ni après, sans balises markdown.

Format exact :
{{
  "prix": [
    {{
      "culture": "Nom lisible de la culture",
      "prix_actuel": "ex: 215 €/t ou 'données indisponibles'",
      "tendance": "hausse" ou "baisse" ou "stable",
      "variation": "ex: +2.3% sur 1 mois ou null",
      "contexte": "1 phrase expliquant pourquoi ce prix (météo Ukraine, demande export, etc.)"
    }}
  ],
  "synthese": "Paragraphe de 3-4 phrases sur la situation globale du marché pour CET exploitant aujourd'hui",
  "recommandations": [
    {{
      "titre": "Action concrète courte",
      "detail": "Explication pratique en 1-2 phrases — quand agir, pourquoi, comment",
      "urgence": "haute" ou "normale" ou "basse"
    }}
  ],
  "opportunites": [
    "Opportunité concrète en 1 phrase"
  ],
  "risques": [
    "Risque concret en 1 phrase à surveiller"
  ],
  "actualites": [
    {{
      "titre": "Titre court de l'actualité",
      "resume": "Résumé en 1-2 phrases et son impact pour cet exploitant",
      "source": "Nom du site source",
      "url": "URL ou null",
      "importance": "haute" ou "normale"
    }}
  ],
  "horodatage": "{today}"
}}

Règles :
- Les prix doivent être ceux de MATIF/Euronext (marché européen, en €/t) si disponibles dans les sources
- Inclure les prix pour TOUTES les cultures du profil + blé/maïs/colza comme référence
- 3 à 5 recommandations concrètes et actionnables immédiatement
- 2 à 4 opportunités et 2 à 4 risques
- 3 à 6 actualités récentes pertinentes pour ce profil
- Adapter le ton à un agriculteur, pas à un financier"""


def build_recherche_prompt(question: str, cultures: List[str], search_results: List[dict]) -> str:
    """Prompt pour la recherche libre."""
    today = datetime.date.today().strftime("%d/%m/%Y")
    cultures_labels = [CULTURE_LABELS.get(c, c.replace("_", " ")) for c in cultures]

    snippets = []
    for r in search_results[:10]:
        title   = r.get("title", "")
        content = r.get("content", "")[:600]
        url     = r.get("url", "")
        snippets.append(f"[{title}]\n{content}\nURL: {url}")
    tavily_block = "\n\n---\n".join(snippets) if snippets else "Aucune source trouvée."

    profile_ctx = f"Cultures : {', '.join(cultures_labels)}" if cultures_labels else ""

    return f"""Tu es un expert agricole et analyste de marché pour les agriculteurs français.
Date : {today}
{profile_ctx}

## Question de l'agriculteur
{question}

## Sources trouvées (Tavily)
{tavily_block}

## Ta mission
Réponds à la question de manière claire, concrète et utile pour un agriculteur.
Retourne UN OBJET JSON UNIQUE :

{{
  "reponse": "Réponse complète, structurée, en texte libre (peut contenir des sauts de ligne \\n). Min 150 mots, max 400 mots. Concret, chiffré si possible, actionnable.",
  "points_cles": ["Point clé 1", "Point clé 2", "Point clé 3"],
  "sources_utilisees": ["nom source 1", "nom source 2"]
}}

IMPORTANT : retourne UNIQUEMENT le JSON, sans texte avant ni après."""


async def call_gemini_json(prompt: str) -> dict:
    """Appelle Gemini et retourne un objet JSON (dict)."""
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=503, detail="Clé API Google manquante")

    models_to_try = [
        "models/gemini-2.0-flash",
        "models/gemini-1.5-flash",
        "models/gemini-flash-latest",
    ]
    last_error = ""

    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(
                model_name=model_name,
                generation_config=genai.GenerationConfig(temperature=0.25, max_output_tokens=4096),
            )
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, lambda: model.generate_content(prompt))
            raw = response.text.strip()

            # Nettoyage des balises markdown si présentes
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1]
                raw = raw.rsplit("```", 1)[0].strip()

            # Extraction de l'objet JSON
            start = raw.find("{")
            end   = raw.rfind("}") + 1
            if start != -1 and end > start:
                return json.loads(raw[start:end])

        except Exception as e:
            last_error = str(e)
            print(f"❌ {model_name} : {last_error}")
            continue

    raise HTTPException(status_code=502, detail=f"Échec IA : {last_error}")


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {"status": "ok", "service": "AgroPilot API"}



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


# ─── Endpoint Marchés : analyse personnalisée ─────────────────────────────────

@app.post("/marche/analyse", response_model=MarcheAnalyse)
async def get_marche_analyse(req: MarcheRequest):
    """
    Analyse de marché personnalisée :
    1. Recherches Tavily : prix MATIF, intrants, actualités, débouchés
    2. Gemini génère une analyse structurée avec prix, recommandations, risques
    """
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

    return MarcheAnalyse(
        prix            = [PrixCulture(**p) for p in data.get("prix", [])],
        synthese        = data.get("synthese", ""),
        recommandations = [Recommandation(**r) for r in data.get("recommandations", [])],
        opportunites    = data.get("opportunites", []),
        risques         = data.get("risques", []),
        actualites      = [Actualite(**a) for a in data.get("actualites", [])],
        horodatage      = data.get("horodatage", today),
    )


# ─── Endpoint Marchés : recherche libre ──────────────────────────────────────

@app.post("/marche/recherche", response_model=RechercheResultat)
async def recherche_marche(req: RechercheRequest):
    """
    Recherche libre : l'agriculteur pose n'importe quelle question
    (prix d'un intrant, comparaison concurrents, tendance export, etc.)
    """
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
'''