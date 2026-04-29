"""
FastAPI — AgroPilot backend
Endpoints :
  GET  /                          -> healthcheck
  POST /subventions/suggestions   -> analyse IA (Tavily + Gemini) des aides eligibles
  POST /marche/analyse            -> analyse marches (vrais prix Yahoo Finance + news + IA)
  POST /marche/recherche          -> recherche libre sur n'importe quel sujet agricole
  POST /api/ia/recommandations    -> recommandations de cultures (Top 3)
  POST /api/ia/generer-conseil    -> conseil sur une culture specifique
"""

import os
import json
import asyncio
import datetime
from typing import List
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
from google import genai
from google.genai import types
from dotenv import load_dotenv

from schemas import *
from services import get_previsions_meteo

load_dotenv()

app = FastAPI(title="AgroPilot API", version="1.0.0")
_executor = ThreadPoolExecutor(max_workers=4)

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
    print("ATTENTION : GOOGLE_API_KEY absent du .env !")

client_gemini = genai.Client(api_key=GOOGLE_API_KEY)

try:
    with open("data/cultures.json", "r", encoding="utf-8") as f:
        CULTURES_DB = json.load(f)
except FileNotFoundError:
    print("data/cultures.json introuvable !")
    CULTURES_DB = {"cultures": []}


TYPE_LABELS = {
    "grandes_cultures": "grandes cultures (cereales, oleagineux)",
    "elevage_bovin":    "elevage bovin",
    "elevage_porcin":   "elevage porcin",
    "elevage_avicole":  "elevage avicole",
    "viticulture":      "viticulture",
    "maraichage":       "maraichage",
    "arboriculture":    "arboriculture",
    "mixte":            "exploitation mixte",
}

METHODE_LABELS = {
    "conventionnelle": "agriculture conventionnelle",
    "raisonnee":       "agriculture raisonnee",
    "hve":             "HVE (Haute Valeur Environnementale)",
    "bio":             "agriculture biologique",
    "biodynamie":      "biodynamie",
}

CULTURE_LABELS = {
    "ble_tendre":     "ble tendre",
    "ble_dur":        "ble dur",
    "mais":           "mais",
    "colza":          "colza",
    "soja":           "soja",
    "orge":           "orge",
    "tournesol":      "tournesol",
    "pois":           "pois proteagineux",
    "lin":            "lin",
    "betterave":      "betterave sucriere",
    "pomme_de_terre": "pomme de terre",
    "vigne":          "vigne",
    "prairie":        "prairies / fourrage",
}


def calculer_marges_rapide(cultures_db, hec, sol):
    if "cultures" not in cultures_db:
        return {}
    marges = {}
    for c in cultures_db["cultures"]:
        try:
            revenu_ha  = c["rendement_optimal_t_ha"] * c["prix_vente_t"]
            charges_ha = c["charges_ha"].get(sol, {}).get("total", 0)
            marges[c["label"]] = (revenu_ha - charges_ha) * hec
        except KeyError:
            continue
    return marges


async def tavily_search(query: str, client: httpx.AsyncClient) -> List[dict]:
    if not TAVILY_API_KEY:
        return []
    try:
        resp = await client.post(
            "https://api.tavily.com/search",
            json={
                "api_key":        TAVILY_API_KEY,
                "query":          query,
                "max_results":    4,
                "search_depth":   "advanced",
                "include_answer": True,
            },
            timeout=15.0,
        )
        return resp.json().get("results", [])
    except Exception:
        return []


_BUSHEL_TO_TONNE = {
    "ZW=F": 36.744,
    "ZC=F": 39.368,
    "ZS=F": 36.744,
}

_COMMODITIES = [
    {"name": "Ble tendre", "ticker": "ZW=F",  "marche": "CBOT"},
    {"name": "Mais",       "ticker": "ZC=F",  "marche": "CBOT"},
    {"name": "Soja",       "ticker": "ZS=F",  "marche": "CBOT"},
    {"name": "Colza",      "ticker": "ECO=F", "marche": "MATIF"},
    {"name": "Petrole",    "ticker": "BZ=F",  "marche": "ICE", "unit": "USDbaril"},
]


def _sync_fetch_prices() -> List[dict]:
    try:
        import yfinance as yf
    except ImportError:
        print("yfinance non installe")
        return []

    try:
        eurusd = yf.Ticker("EURUSD=X").fast_info.get("last_price") or 1.08
        if not eurusd or eurusd <= 0:
            eurusd = 1.08
    except Exception:
        eurusd = 1.08

    results = []
    for c in _COMMODITIES:
        try:
            fi    = yf.Ticker(c["ticker"]).fast_info
            price = fi.get("last_price") or fi.get("regularMarketPrice")
            prev  = fi.get("previous_close") or fi.get("regularMarketPreviousClose")
            if not price:
                continue

            unit = c.get("unit", "USDbushel")
            if unit == "USDbushel":
                conv      = _BUSHEL_TO_TONNE.get(c["ticker"], 36.744)
                price_eur = round((price * conv) / eurusd, 1)
                prev_eur  = round((prev * conv) / eurusd, 1) if prev else None
                label     = str(price_eur) + " EUR/t"
            elif unit == "USDbaril":
                price_eur = round(price / eurusd, 2)
                prev_eur  = round(prev / eurusd, 2) if prev else None
                label     = str(price_eur) + " EUR/baril"
            else:
                price_eur = round(price, 1)
                prev_eur  = round(prev, 1) if prev else None
                label     = str(price_eur) + " EUR/t"

            if prev_eur and prev_eur > 0:
                pct       = (price_eur - prev_eur) / prev_eur * 100
                tendance  = "hausse" if pct > 0.3 else "baisse" if pct < -0.3 else "stable"
                variation = ("+" if pct >= 0 else "") + "{:.2f}%".format(pct)
            else:
                tendance  = "stable"
                variation = None

            results.append({
                "name":       c["name"],
                "marche":     c["marche"],
                "prix_label": label,
                "prix_num":   price_eur,
                "tendance":   tendance,
                "variation":  variation,
            })
        except Exception as e:
            print("yfinance {}: {}".format(c["ticker"], e))
            continue

    return results


async def fetch_commodity_prices_real() -> List[dict]:
    loop = asyncio.get_event_loop()
    try:
        return await loop.run_in_executor(_executor, _sync_fetch_prices)
    except Exception as e:
        print("fetch_commodity_prices_real: {}".format(e))
        return []


def build_search_queries(p: ProfilePayload) -> List[str]:
    type_label   = TYPE_LABELS.get(p.type_exploitation or "", p.type_exploitation or "agriculteur")
    methode      = METHODE_LABELS.get(p.methode_production or "", "")
    localisation = p.region or p.departement or "France"
    queries = [
        "subventions aides agricoles " + type_label + " 2024 2025 France",
        "aides PAC eco-regimes " + type_label + " " + localisation + " 2025",
    ]
    if p.methode_production in ("bio", "hve", "biodynamie", "raisonnee"):
        queries.append("aides financieres " + methode + " agriculteur France 2025")
    if p.certifications:
        queries.append("subventions certification " + " ".join(p.certifications) + " exploitation agricole France")
    if p.region or p.departement:
        queries.append("aides regionales agriculteurs " + localisation + " 2025 conseil regional")
    return queries[:5]


def build_claude_prompt(p: ProfilePayload, search_results: List[dict]) -> str:
    profile_lines = []
    if p.type_exploitation:  profile_lines.append("- Type : " + TYPE_LABELS.get(p.type_exploitation, p.type_exploitation))
    if p.methode_production:  profile_lines.append("- Methode : " + METHODE_LABELS.get(p.methode_production, p.methode_production))
    if p.surface_ha:          profile_lines.append("- Surface : " + str(p.surface_ha) + " ha")
    if p.certifications:      profile_lines.append("- Certifications : " + ", ".join(p.certifications).upper())
    if p.cultures:            profile_lines.append("- Cultures : " + ", ".join(p.cultures).replace("_", " "))
    if p.departement or p.region:
        profile_lines.append("- Localisation : " + " / ".join(filter(None, [p.departement, p.region])))
    profile_summary = "\n".join(profile_lines) if profile_lines else "Profil non renseigne"
    snippets = ["[" + r.get("title","") + "]\n" + r.get("content","")[:400] + "\nURL: " + r.get("url","") for r in search_results[:12]]
    tavily_block = "\n\n---\n".join(snippets) if snippets else "Aucun resultat de recherche disponible."
    return (
        "Tu es un conseiller agricole expert en aides et subventions.\n"
        "## Profil de l exploitant\n" + profile_summary + "\n\n"
        "## Sources recentes (Tavily)\n" + tavily_block + "\n\n"
        "## Ta mission\n"
        'Retourne une liste JSON de 4 a 8 subventions/aides pour cet exploitant.\n'
        'Format: [{"nom":"...","organisme":"...","description":"...","montant_label":"...","pourquoi_eligible":"...","demarches":"...","url":"...","categorie":"...","score":5}]\n'
    )


def build_marche_queries(req: MarcheRequest) -> List[str]:
    today        = datetime.date.today().strftime("%B %Y")
    cultures_lbl = [CULTURE_LABELS.get(c, c.replace("_", " ")) for c in (req.cultures or [])]
    localisation = req.region or req.departement or "France"
    type_label   = TYPE_LABELS.get(req.type_exploitation or "", "agriculture")
    queries = ["cours MATIF ble tendre colza mais prix EUR/tonne " + today]
    if cultures_lbl:
        queries.append("marche " + " ".join(cultures_lbl[:3]) + " prix tendance France " + today)
    queries.append("prix engrais uree azote GNR carburant agriculteur France " + today)
    queries.append("actualites agriculture marches conjoncture " + type_label + " " + localisation + " " + today)
    return queries[:4]


def build_marche_prompt(req: MarcheRequest, search_results: List[dict], real_prices: List[dict]) -> str:
    today    = datetime.date.today().strftime("%d/%m/%Y")
    snippets = ["[" + r.get("title","") + "]\n" + r.get("content","")[:500] + "\nURL: " + r.get("url","") for r in search_results[:12]]
    tavily_block = "\n\n---\n".join(snippets) if snippets else "Pas d actualites disponibles."

    if real_prices:
        prix_lines = []
        for p in real_prices:
            line = "  - " + p["name"] + " (" + p.get("marche", "") + "): " + p["prix_label"]
            if p.get("tendance"):
                line += ", tendance: " + p["tendance"]
            if p.get("variation"):
                line += ", variation J-1: " + p["variation"]
            prix_lines.append(line)
        prix_block = "## Prix reels (Yahoo Finance, temps reel)\n" + "\n".join(prix_lines)
        prix_instr = "Les prix sont deja fournis ci-dessus - ne genere PAS de champ prix dans ta reponse."
    else:
        prix_block = "## Prix de marche\nDonnees temps reel indisponibles - extrais les prix depuis les actualites."
        prix_instr = 'Genere aussi le champ "prix" : [{"culture":"Ble tendre","prix_actuel":"XXX EUR/t","tendance":"hausse","variation":"+X%","contexte":"MATIF"}]'

    cultures_ctx = ""
    if req.cultures:
        labels = [CULTURE_LABELS.get(c, c.replace("_", " ")) for c in req.cultures]
        cultures_ctx = "\nCultures de l exploitation : " + ", ".join(labels) + "."
    if req.region:
        cultures_ctx += " Region : " + req.region + "."

    json_example = (
        '{"synthese":"2-3 phrases sur les conditions du marche...",'
        '"recommandations":[{"titre":"...","detail":"...","urgence":"normale"}],'
        '"opportunites":["..."],'
        '"risques":["..."],'
        '"actualites":[{"titre":"...","resume":"...","source":"...","url":"","importance":"normale"}],'
        '"horodatage":"' + today + '"}'
    )

    return (
        "Tu es un analyste de marche agricole expert francophone. Date du jour : " + today + "\n"
        + cultures_ctx + "\n\n"
        + prix_block + "\n\n"
        "## Actualites agricoles recentes (Tavily)\n" + tavily_block + "\n\n"
        "## Ta mission\n"
        "Retourne UNIQUEMENT cet objet JSON valide (sans balises markdown, sans ```).\n\n"
        + json_example + "\n\n"
        + prix_instr + "\n\n"
        "REGLES : urgence dans [haute,normale,basse] importance dans [haute,normale] "
        "2-4 recommandations, 2-3 opportunites/risques, 3-5 actualites. JSON brut uniquement.\n"
    )


def build_recherche_prompt(question: str, cultures: List[str], search_results: List[dict]) -> str:
    today    = datetime.date.today().strftime("%d/%m/%Y")
    snippets = ["[" + r.get("title","") + "]\n" + r.get("content","")[:600] + "\nURL: " + r.get("url","") for r in search_results[:10]]
    tavily_block = "\n\n---\n".join(snippets) if snippets else "Aucune source trouvee."
    return (
        "Tu es un expert agricole. Date : " + today + "\n"
        "## Question : " + question + "\n"
        "## Sources (Tavily) : " + tavily_block + "\n"
        '## Ta mission : Reponds en texte libre structure. Retourne UN JSON: {"reponse": "...", "points_cles": ["..."], "sources_utilisees": ["..."]}\n'
    )


_GEMINI_MODELS = [
    "gemini-2.5-flash-preview-04-17",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
]


async def call_gemini_schema(prompt: str, schema) -> dict:
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=503, detail="Cle API manquante")
    for model_name in _GEMINI_MODELS:
        try:
            print("[SCHEMA] " + model_name)
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
            print("[SCHEMA] " + model_name + ": " + str(e))
            await asyncio.sleep(1)
    raise HTTPException(status_code=502, detail="IA indisponible (Schema)")


async def call_gemini_json(prompt: str):
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=503, detail="Cle API manquante")
    for model_name in _GEMINI_MODELS:
        try:
            print("[JSON] " + model_name)
            reponse = await client_gemini.aio.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    response_mime_type="application/json",
                ),
            )
            text = reponse.text.strip()
            if text.startswith("```"):
                parts = text.split("```")
                text  = parts[1] if len(parts) > 1 else parts[0]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()
            return json.loads(text)
        except Exception as e:
            print("[JSON] " + model_name + ": " + str(e))
            await asyncio.sleep(1)
    raise HTTPException(status_code=502, detail="IA indisponible (JSON)")


@app.get("/")
def read_root():
    return {"status": "ok", "service": "AgroPilot API"}


@app.post("/subventions/suggestions", response_model=List[SubventionCard])
async def get_subvention_suggestions(profile: ProfilePayload):
    async with httpx.AsyncClient() as client:
        tasks          = [tavily_search(q, client) for q in build_search_queries(profile)]
        results_nested = await asyncio.gather(*tasks)

    seen, search_results = set(), []
    for batch in results_nested:
        for r in batch:
            url = r.get("url", "")
            if url not in seen:
                seen.add(url)
                search_results.append(r)

    cards = await call_gemini_json(build_claude_prompt(profile, search_results))
    validated = []
    if isinstance(cards, list):
        for c in cards:
            try:
                validated.append(SubventionCard(**c))
            except Exception:
                pass
    return validated


@app.post("/marche/analyse", response_model=MarcheAnalyse)
async def get_marche_analyse(req: MarcheRequest):
    async with httpx.AsyncClient() as client:
        tavily_tasks = [tavily_search(q, client) for q in build_marche_queries(req)]
        results_nested, real_prices = await asyncio.gather(
            asyncio.gather(*tavily_tasks),
            fetch_commodity_prices_real(),
        )

    seen, search_results = set(), []
    for batch in results_nested:
        for r in batch:
            url = r.get("url", "")
            if url not in seen:
                seen.add(url)
                search_results.append(r)

    print("Prix reels recuperes : " + str(len(real_prices)) + " commodites")

    prompt = build_marche_prompt(req, search_results, real_prices)
    data   = await call_gemini_json(prompt)

    if not isinstance(data, dict):
        data = {}

    prix_list = []
    if real_prices:
        for p in real_prices:
            try:
                prix_list.append(PrixCulture(
                    culture     = p["name"],
                    prix_actuel = p["prix_label"],
                    tendance    = p.get("tendance", "stable"),
                    variation   = p.get("variation"),
                    contexte    = p.get("marche"),
                ))
            except Exception:
                pass
    else:
        for item in data.get("prix", []):
            try:
                prix_list.append(PrixCulture(**item))
            except Exception:
                pass

    recommandations = []
    for item in data.get("recommandations", []):
        try:
            recommandations.append(Recommandation(**item))
        except Exception:
            pass

    actualites = []
    for item in data.get("actualites", []):
        try:
            actualites.append(ActualiteMarche(**item))
        except Exception:
            pass

    return MarcheAnalyse(
        synthese        = data.get("synthese", "Analyse du marche agricole en cours..."),
        prix            = prix_list,
        recommandations = recommandations,
        opportunites    = data.get("opportunites", []),
        risques         = data.get("risques", []),
        actualites      = actualites,
        horodatage      = data.get("horodatage", datetime.date.today().strftime("%d/%m/%Y")),
    )


@app.post("/marche/recherche")
async def recherche_marche(req: RechercheRequest):
    queries = [
        req.question,
        req.question + " France agriculture 2025",
        req.question + " prix marche agriculteur",
    ]
    async with httpx.AsyncClient() as client:
        tasks          = [tavily_search(q, client) for q in queries[:3]]
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
    if not isinstance(data, dict):
        data = {}

    return {
        "reponse":           data.get("reponse", "Aucune reponse disponible."),
        "points_cles":       data.get("points_cles", []),
        "sources_utilisees": data.get("sources_utilisees", []),
    }


@app.post("/api/ia/recommandations")
async def get_recommandations(payload: RecommandationPayload):
    type_label = TYPE_LABELS.get(payload.type_exploitation or "", "agriculteur")
    sol        = payload.type_sol or "limoneux"
    hec        = payload.surface_ha or 100
    region     = payload.region or payload.departement or "France"
    methode    = METHODE_LABELS.get(payload.methode_production or "", "agriculture conventionnelle")

    marges = calculer_marges_rapide(CULTURES_DB, hec, sol)
    marges_txt = "\n".join(
        ["  - " + k + ": " + "{:,.0f}".format(v).replace(",", " ") + " EUR/an (estime)" for k, v in sorted(marges.items(), key=lambda x: -x[1])[:5]]
    ) if marges else "  Donnees de marges non disponibles."

    prompt = (
        "Tu es un conseiller agronomique expert. Donne les 3 meilleures cultures a recommander.\n"
        "## Exploitation\n"
        "- Type : " + type_label + "\n"
        "- Surface : " + str(hec) + " ha\n"
        "- Sol : " + sol + "\n"
        "- Region : " + region + "\n"
        "- Methode : " + methode + "\n\n"
        "## Marges estimees (base de donnees locale)\n" + marges_txt + "\n\n"
        'Retourne UNIQUEMENT un JSON: {"recommandations": ['
        '{"culture":"...","score":8,"raison_principale":"...","marge_estimee":"... EUR/ha","risques":"...","opportunites":"..."}'
        ']}\n'
    )
    data = await call_gemini_json(prompt)
    if not isinstance(data, dict):
        data = {}
    return {"recommandations": data.get("recommandations", [])}


@app.post("/api/ia/generer-conseil")
async def generer_conseil(payload: ConseilPayload):
    type_label = TYPE_LABELS.get(payload.type_exploitation or "", "agriculteur")
    sol        = payload.type_sol or "limoneux"
    hec        = payload.surface_ha or 100
    region     = payload.region or payload.departement or "France"
    methode    = METHODE_LABELS.get(payload.methode_production or "", "agriculture conventionnelle")
    culture    = CULTURE_LABELS.get(payload.culture or "", payload.culture or "culture")

    prompt = (
        "Tu es un conseiller agronomique expert. Genere un conseil detaille pour :\n"
        "## Exploitation\n"
        "- Type : " + type_label + "\n"
        "- Culture choisie : " + culture + "\n"
        "- Surface : " + str(hec) + " ha\n"
        "- Sol : " + sol + "\n"
        "- Region : " + region + "\n"
        "- Methode : " + methode + "\n\n"
        'Retourne UNIQUEMENT un JSON:\n'
        '{"titre":"Conseil pour ' + culture + '","introduction":"...","etapes":[{"titre":"...","detail":"...","periode":"..."}],'
        '"points_vigilance":["..."],"estimation_charges":"... EUR/ha","estimation_rendement":"... t/ha","estimation_marge":"... EUR/ha"}\n'
    )
    data = await call_gemini_json(prompt)
    if not isinstance(data, dict):
        data = {"titre": "Conseil " + culture, "introduction": "Donnees insuffisantes.", "etapes": []}
    return data


@app.get("/meteo")
async def get_meteo(commune: str = "Paris", lat: float = None, lon: float = None):
    try:
        result = await get_previsions_meteo(commune=commune, lat=lat, lon=lon)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
