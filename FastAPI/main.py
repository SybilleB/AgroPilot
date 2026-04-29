"""
FastAPI — AgroPilot backend
Endpoints :
  GET  /                          -> healthcheck
  POST /subventions/suggestions   -> analyse IA (Groq/Llama + Tavily) des aides eligibles
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
from dotenv import load_dotenv

# google-genai optionnel (fallback uniquement)
try:
    from google import genai as _genai
    from google.genai import types as _gtypes
except ImportError:
    _genai = None
    _gtypes = None

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

GROQ_API_KEY    = os.getenv("GROQ_API_KEY", "")
GOOGLE_API_KEY  = os.getenv("GOOGLE_API_KEY", "")   # gardé en fallback
TAVILY_API_KEY  = os.getenv("TAVILY_API_KEY", "")

if not GROQ_API_KEY:
    print("ATTENTION : GROQ_API_KEY absent du .env ! (console.groq.com → gratuit)")
if not TAVILY_API_KEY:
    print("ATTENTION : TAVILY_API_KEY absent du .env !")

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

# Mapping culture clé → ticker Yahoo Finance pour l'affichage temps réel
#
# IMPORTANT — unités Yahoo Finance pour les grains CBOT :
#   ZW=F (blé), ZC=F (maïs), ZS=F (soja) → CENTS par boisseau (cents/bu)
#   Facteur de conversion = (bushels_par_tonne / 100) car cents → dollars
#   Exemple blé : 36.744 bu/t ÷ 100 = 0.36744  →  600 c/bu × 0.36744 / 1.17 ≈ 188 EUR/t ✓
#
# Colza :
#   ECO=F (MATIF) est délisté depuis 2024.
#   On utilise RS=F (ICE Canola, CAD/tonne) comme proxy.
#   Conversion : prix_eur = prix_cad × (CADUSD / EURUSD)
#
_CULTURE_TICKER_MAP = {
    "ble_tendre":  {"name": "Blé tendre", "ticker": "ZW=F", "marche": "CBOT",  "unit": "USDbushel_cents", "conv": 36.744},
    "ble_dur":     {"name": "Blé dur",    "ticker": "ZW=F", "marche": "CBOT",  "unit": "USDbushel_cents", "conv": 36.744},
    "mais":        {"name": "Maïs",       "ticker": "ZC=F", "marche": "CBOT",  "unit": "USDbushel_cents", "conv": 39.368},
    "soja":        {"name": "Soja",       "ticker": "ZS=F", "marche": "CBOT",  "unit": "USDbushel_cents", "conv": 36.744},
    "colza":       {"name": "Colza",      "ticker": "RS=F", "marche": "ICE",   "unit": "CADtonne",        "conv": 1.0},
    "orge":        {"name": "Orge",       "ticker": "ZW=F", "marche": "CBOT",  "unit": "USDbushel_cents", "conv": 36.744},
    "tournesol":   {"name": "Tournesol",  "ticker": "ZS=F", "marche": "CBOT",  "unit": "USDbushel_cents", "conv": 36.744},
    "lin":         {"name": "Lin",        "ticker": "ZS=F", "marche": "CBOT",  "unit": "USDbushel_cents", "conv": 36.744},
    "pois":        {"name": "Pois prot.", "ticker": "ZS=F", "marche": "CBOT",  "unit": "USDbushel_cents", "conv": 36.744},
}

# Cultures de référence si aucune culture utilisateur
_DEFAULT_CULTURES = ["ble_tendre", "mais", "colza", "soja"]


def _get_price_and_history(ticker_sym: str):
    """Récupère prix actuel, prix J-1 et historique 30j via yfinance.history() (plus stable que fast_info)."""
    import yfinance as yf
    t    = yf.Ticker(ticker_sym)
    hist = t.history(period="32d", interval="1d")
    if hist.empty or "Close" not in hist.columns:
        return None, None, []
    closes = hist["Close"].dropna().tolist()
    if not closes:
        return None, None, []
    price = closes[-1]
    prev  = closes[-2] if len(closes) >= 2 else None
    return price, prev, closes


def _sync_fetch_prix_live(cultures: List[str]) -> List[dict]:
    """Récupère prix actuels + historique 30j via yfinance pour les cultures données."""
    try:
        import yfinance as yf
    except ImportError:
        return []

    # ── Taux de change ──────────────────────────────────────────────────────
    try:
        eurusd_price, _, _ = _get_price_and_history("EURUSD=X")
        eurusd = eurusd_price if eurusd_price and eurusd_price > 0 else 1.10
    except Exception:
        eurusd = 1.10
    print("EUR/USD: {}".format(eurusd))

    try:
        cadusd_price, _, _ = _get_price_and_history("CADUSD=X")
        cadusd = cadusd_price if cadusd_price and cadusd_price > 0 else 0.73
    except Exception:
        cadusd = 0.73
    print("CAD/USD: {}".format(cadusd))

    seen, items = set(), []
    targets = cultures if cultures else _DEFAULT_CULTURES

    for culture_key in targets:
        info = _CULTURE_TICKER_MAP.get(culture_key)
        if not info:
            continue
        ticker_sym = info["ticker"]
        dedup_key  = (ticker_sym, culture_key)
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        try:
            price_raw, prev_raw, closes_raw = _get_price_and_history(ticker_sym)
            if not price_raw:
                print("prix_live {}: pas de données history".format(ticker_sym))
                continue

            conv = info["conv"]
            unit = info["unit"]

            if unit == "USDbushel_cents":
                # CBOT grains : yfinance retourne des cents/bushel
                # → (cents/bu ÷ 100) × bu/tonne ÷ eurusd = EUR/tonne
                factor = conv / 100.0
                price_eur  = round((price_raw * factor) / eurusd, 1)
                prev_eur   = round((prev_raw  * factor) / eurusd, 1) if prev_raw else None
                historique = [round((c * factor) / eurusd, 1) for c in closes_raw]

            elif unit == "CADtonne":
                # ICE Canola (RS=F) : CAD par tonne
                # → CAD × (CAD/USD) ÷ EUR/USD = EUR/tonne
                price_eur  = round((price_raw * cadusd) / eurusd, 1)
                prev_eur   = round((prev_raw  * cadusd) / eurusd, 1) if prev_raw else None
                historique = [round((c * cadusd) / eurusd, 1) for c in closes_raw]

            else:
                # EURtonne — déjà en EUR, pas de conversion
                price_eur  = round(price_raw, 1)
                prev_eur   = round(prev_raw, 1) if prev_raw else None
                historique = [round(c, 1) for c in closes_raw]

            if prev_eur and prev_eur > 0:
                pct      = (price_eur - prev_eur) / prev_eur * 100
                tendance = "hausse" if pct > 0.3 else "baisse" if pct < -0.3 else "stable"
            else:
                pct, tendance = 0.0, "stable"

            print("prix_live {}: {}€/t ({})".format(ticker_sym, price_eur, tendance))
            items.append({
                "culture":       info["name"],
                "culture_key":   culture_key,
                "ticker":        ticker_sym,
                "marche":        info["marche"],
                "prix_eur":      price_eur,
                "variation_pct": round(pct, 2),
                "tendance":      tendance,
                "historique":    historique,
            })
        except Exception as e:
            print("prix_live {}: {}".format(ticker_sym, e))
            continue

    return items


async def fetch_prix_live_async(cultures: List[str]) -> List[dict]:
    loop = asyncio.get_event_loop()
    try:
        return await loop.run_in_executor(_executor, _sync_fetch_prix_live, cultures)
    except Exception as e:
        print("fetch_prix_live_async:", e)
        return []


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
        "Retourne UNIQUEMENT ce JSON brut (sans markdown, sans ```) :\n"
        '{"subventions": ['
        '{"nom":"Aide PAC DPB","organisme":"FranceAgriMer","description":"...","montant_label":"XXX EUR/ha",'
        '"pourquoi_eligible":"...","demarches":"...","url":"https://...","categorie":"PAC","score":8}'
        ']}\n\n'
        "REGLES : 4 a 8 subventions/aides pertinentes pour ce profil. "
        "score entre 1 et 10 (pertinence). JSON brut uniquement.\n"
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


# ─── Groq (LLM principal — gratuit, 30 req/min) ──────────────────────────────

_GROQ_MODELS = [
    "llama-3.3-70b-versatile",   # meilleur modèle gratuit Groq
    "llama3-8b-8192",            # plus rapide, fallback
    "mixtral-8x7b-32768",        # fallback alternatif
]

_GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


async def call_ia_json(prompt: str) -> dict:
    """Appel IA principal via Groq (gratuit). Fallback Gemini REST si besoin."""
    last_error = "Aucune cle IA configuree"

    # 1) Groq (prioritaire)
    if GROQ_API_KEY:
        for model in _GROQ_MODELS:
            try:
                print("[GROQ] " + model)
                async with httpx.AsyncClient(timeout=45.0) as client:
                    resp = await client.post(
                        _GROQ_URL,
                        headers={"Authorization": "Bearer " + GROQ_API_KEY, "Content-Type": "application/json"},
                        json={
                            "model":           model,
                            "messages":        [{"role": "user", "content": prompt}],
                            "temperature":     0.2,
                            "response_format": {"type": "json_object"},
                        },
                    )
                    resp.raise_for_status()
                    text = resp.json()["choices"][0]["message"]["content"].strip()
                    return json.loads(text)
            except Exception as e:
                last_error = "[Groq {}] {}".format(model, str(e)[:200])
                print("[GROQ] " + last_error)
                await asyncio.sleep(1)

    # 2) Fallback Gemini REST (si clé dispo)
    if GOOGLE_API_KEY:
        for model in ["gemini-2.0-flash-lite", "gemini-2.0-flash"]:
            try:
                print("[GEMINI-REST] " + model)
                url = "https://generativelanguage.googleapis.com/v1/models/{}:generateContent?key={}".format(
                    model, GOOGLE_API_KEY
                )
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(url, json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
                    })
                    resp.raise_for_status()
                    text = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    if text.startswith("```"):
                        text = text.split("```")[1].lstrip("json").strip()
                    return json.loads(text)
            except Exception as e:
                last_error = "[Gemini {}] {}".format(model, str(e)[:200])
                print("[GEMINI-REST] " + last_error)
                await asyncio.sleep(1)

    raise HTTPException(status_code=502, detail="IA indisponible — " + last_error)


# Alias pour rétro-compatibilité avec le code existant
call_gemini_json = call_ia_json


@app.get("/")
def read_root():
    return {
        "status":                "ok",
        "service":               "AgroPilot API",
        "ia_provider":           "Groq" if GROQ_API_KEY else "Gemini (fallback)",
        "groq_key_present":      bool(GROQ_API_KEY),
        "google_key_present":    bool(GOOGLE_API_KEY),
        "tavily_key_present":    bool(TAVILY_API_KEY),
    }


@app.get("/test-ia")
async def test_ia():
    """Teste rapidement que l'IA repond."""
    try:
        result = await call_ia_json('Reponds uniquement avec ce JSON exact: {"ok": true, "message": "IA operationnelle"}')
        return {"status": "OK", "provider": "Groq" if GROQ_API_KEY else "Gemini", "reponse": result}
    except Exception as e:
        return {"status": "ECHEC", "erreur": str(e)[:500]}


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

    raw = await call_gemini_json(build_claude_prompt(profile, search_results))

    # Groq retourne toujours un objet JSON — extraire la liste selon la clé présente
    if isinstance(raw, dict):
        cards_list = (
            raw.get("subventions")
            or raw.get("aides")
            or raw.get("results")
            or raw.get("data")
            or next((v for v in raw.values() if isinstance(v, list)), [])
        )
    elif isinstance(raw, list):
        cards_list = raw
    else:
        cards_list = []

    validated = []
    for c in cards_list:
        try:
            validated.append(SubventionCard(**c))
        except Exception as e:
            print("SubventionCard validation:", e)
    return validated


@app.get("/test-prix")
async def test_prix():
    """Diagnostic Yahoo Finance via history() (méthode stable)."""
    def _test():
        results = []
        # ZW/ZC/ZS → cents/bu ; RS=F → CAD/t ; EURUSD/CADUSD → taux de change
        for ticker, unit in [("ZW=F","cents/bu"), ("ZC=F","cents/bu"), ("ZS=F","cents/bu"),
                              ("RS=F","CAD/t"), ("EURUSD=X","rate"), ("CADUSD=X","rate")]:
            try:
                price, prev, closes = _get_price_and_history(ticker)
                results.append({
                    "ticker":   ticker,
                    "unit":     unit,
                    "prix_raw": round(price, 2) if price else None,
                    "nb_jours": len(closes),
                    "status":   "OK" if price else "prix_null",
                })
            except Exception as e:
                results.append({"ticker": ticker, "status": "ECHEC", "erreur": str(e)[:200]})
        return results
    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(_executor, _test)
    return {"resultats": results}


@app.post("/marche/prix-live", response_model=PrixLiveResponse)
async def get_prix_live(req: MarcheRequest):
    """Retourne les prix Yahoo Finance en temps réel + historique 30j pour les cultures de l'exploitation."""
    cultures = req.cultures or _DEFAULT_CULTURES
    items_raw = await fetch_prix_live_async(cultures)

    timestamp = datetime.datetime.now().strftime("%H:%M")
    items = []
    for r in items_raw:
        try:
            items.append(PrixLiveItem(**r, timestamp=timestamp) if "timestamp" in PrixLiveItem.model_fields else PrixLiveItem(**r))
        except Exception:
            pass

    return PrixLiveResponse(items=items, timestamp=timestamp)


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


@app.post("/marche/recherche", response_model=RechercheResultat)
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

    # Sources construites depuis les résultats Tavily (titre + url réels)
    sources = [
        {"titre": r.get("title", r.get("url", "")), "url": r.get("url", "")}
        for r in search_results[:5]
        if r.get("url")
    ]

    return RechercheResultat(
        question   = req.question,
        reponse    = data.get("reponse", "Aucune reponse disponible."),
        sources    = sources,
        horodatage = datetime.date.today().strftime("%d/%m/%Y"),
    )


@app.post("/api/ia/recommandations", response_model=ResultatRecommandations)
async def get_recommandations(payload: RequeteTop3):
    sol = payload.type_sol
    hec = payload.hectares

    # Marges estimées depuis la base locale
    marges = calculer_marges_rapide(CULTURES_DB, hec, sol)
    marges_txt = "\n".join(
        ["  - " + k + ": " + "{:,.0f}".format(v).replace(",", " ") + " EUR/an" for k, v in sorted(marges.items(), key=lambda x: -x[1])[:5]]
    ) if marges else "  Donnees non disponibles."

    # Météo locale
    meteo_txt = "Donnees meteo non disponibles."
    try:
        meteo = await get_previsions_meteo(lat=payload.latitude, lon=payload.longitude)
        if meteo and meteo.get("temperature_2m_max"):
            temps  = meteo["temperature_2m_max"]
            pluies = meteo.get("precipitation_sum", [])
            avg_t  = sum(temps) / len(temps) if temps else 0
            tot_p  = sum(pluies) if pluies else 0
            meteo_txt = "Previsions 7j : temp max moy {:.1f}C, precipitations {:.1f}mm.".format(avg_t, tot_p)
    except Exception as e:
        print("Meteo erreur recommandations:", e)

    # ── Paramètres de simulation ─────────────────────────────────────────────
    mode_prod       = payload.mode_production or "conventionnel"
    irrigation      = payload.irrigation or False
    cultures_cibles = payload.cultures_souhaitees or []
    prix_custom     = payload.prix_vente_custom or {}

    # Données économiques réelles de l'agriculteur
    rendement_ha    = payload.rendement_habituel_t_ha    # t/ha connu, ou None
    prix_vise       = payload.prix_vente_vise_eur_t      # €/t cible, ou None
    fermage         = payload.fermage_eur_ha or 0        # €/ha loyer
    charges_var     = payload.charges_variables_eur_ha   # €/ha phyto+engrais+semences, ou None
    mode_vente      = payload.mode_vente or "negoce"

    # Mode de production
    if mode_prod == "bio":
        mode_ctx = "Mode BIO : prix de vente x2 a x3, rendements reduits de 20-30%, charges de certification et main d oeuvre supplementaires. Utiliser prix bio realistes."
    elif mode_prod == "raisonne":
        mode_ctx = "Mode RAISONNE : intrants reduits de 20-30%, prix legerement superieurs au conventionnel (+5-10%), rendements quasi equivalents."
    else:
        mode_ctx = "Mode CONVENTIONNEL."

    # Irrigation
    irrig_ctx = "Irrigation : OUI — majorer rendements de 15-25% pour mais, tournesol, betterave." if irrigation \
                else "Irrigation : NON — privilegier cultures tolerantes secheresse, ne pas surestimer les rendements."

    # Mode de vente → impact sur le prix net recu
    vente_ctx_map = {
        "cooperative":    "Vente en cooperative : prix secu mais cotisation ~2-4%.",
        "negoce":         "Vente au negoce : prix spot, negociable.",
        "circuit_court":  "Circuit court : prix x2 a x3, mais volumes limites et couts logistique.",
        "contrat":        "Contrat fixe : prix garanti mais moins de flexibilite.",
    }
    vente_ctx = vente_ctx_map.get(mode_vente, "")

    # Cultures ciblées
    if cultures_cibles:
        labels_cibles = [CULTURE_LABELS.get(c, c.replace("_", " ")) for c in cultures_cibles]
        cultures_ctx = "CULTURES A ANALYSER (uniquement celles demandees par l exploitant) : " + ", ".join(labels_cibles) + "."
    else:
        cultures_ctx = "Choisir les 2-3 meilleures cultures adaptees au profil."

    # Données économiques réelles → bloc pour l'IA
    donnees_reelles = []
    if rendement_ha:
        donnees_reelles.append("Rendement habituel declare par l agriculteur : {:.1f} t/ha — UTILISER CE RENDEMENT comme base de calcul, ne pas l inventer.".format(rendement_ha))
    if prix_vise:
        donnees_reelles.append("Prix de vente vise : {:.0f} EUR/t — UTILISER CE PRIX pour le chiffre d affaires.".format(prix_vise))
    if fermage > 0:
        donnees_reelles.append("Fermage / loyer foncier : {:.0f} EUR/ha soit {:.0f} EUR pour {} ha — a integrer dans les charges totales.".format(fermage, fermage * hec, hec))
    if charges_var:
        donnees_reelles.append("Charges variables declareees : {:.0f} EUR/ha (phyto + engrais + semences) soit {:.0f} EUR pour {} ha.".format(charges_var, charges_var * hec, hec))
    if prix_custom:
        for k, v in prix_custom.items():
            donnees_reelles.append("Prix contractualise {} : {:.0f} EUR/t.".format(CULTURE_LABELS.get(k, k), v))

    donnees_bloc = ""
    if donnees_reelles:
        donnees_bloc = "\n## DONNEES REELLES DE L EXPLOITANT (priorite absolue)\n" + "\n".join(["  - " + d for d in donnees_reelles]) + "\n"
    else:
        donnees_bloc = "\n## Donnees exploitant\n  - Aucune donnee reelle fournie : utiliser les valeurs moyennes nationales.\n"

    prompt = (
        "Tu es un conseiller agronomique et financier expert. Simule la rentabilite de cultures pour cette exploitation.\n\n"
        "## Exploitation\n"
        "Surface : " + str(hec) + " ha | Sol : " + sol + "\n"
        + mode_ctx + "\n"
        + irrig_ctx + "\n"
        + vente_ctx + "\n"
        + cultures_ctx + "\n"
        + donnees_bloc
        + "\n## Contexte agronomique\n"
        "Meteo locale : " + meteo_txt + "\n"
        "Marges de reference base de donnees locale :\n" + marges_txt + "\n\n"
        "## Format de reponse attendu\n"
        "Retourne UNIQUEMENT ce JSON brut (sans markdown, sans ```) :\n"
        '{"cultures_validees": ['
        '{"nom_culture": "Ble tendre", '
        '"rendement_total_tonnes": 200.0, '
        '"chiffre_affaires_euros": 44000.0, '
        '"charges_totales_euros": 28000.0, '
        '"marge_brute_euros": 16000.0, '
        '"conseil_action": "Conseil agronomique et financier sur 3 phrases : itineraire, opportunites, vigilances specifiques.", '
        '"statut_meteo": "Favorable", '
        '"recommandation_globale": "recommande"}'
        "]}\n\n"
        "REGLES STRICTES :\n"
        "- rendement_total_tonnes = TOTAL sur " + str(hec) + " ha (pas par hectare)\n"
        "- charges_totales_euros DOIT inclure fermage (" + str(int(fermage * hec)) + " EUR) si fourni\n"
        "- marge_brute_euros = chiffre_affaires_euros - charges_totales_euros\n"
        + ("- Utiliser le rendement declare : " + str(rendement_ha) + " t/ha, soit " + str(round(rendement_ha * hec, 1)) + " t total\n" if rendement_ha else "")
        + ("- Utiliser le prix vise : " + str(prix_vise) + " EUR/t\n" if prix_vise else "")
        + "- Mode production : " + mode_prod + " — ajuster prix et rendements en consequence\n"
        + ("- Irrigation : oui\n" if irrigation else "- Irrigation : non\n")
        + "- statut_meteo : 'Favorable' | 'Defavorable' | 'Incertain'\n"
        "- recommandation_globale : 'recommande' | 'non recommande'\n"
        "- Valeurs numeriques realistes et coherentes, JSON brut uniquement\n"
    )

    data = await call_gemini_json(prompt)
    cultures = []
    raw_list = []
    if isinstance(data, dict):
        raw_list = data.get("cultures_validees", data.get("recommandations", []))
    elif isinstance(data, list):
        raw_list = data
    for item in raw_list:
        try:
            cultures.append(RecommandationCulture(**item))
        except Exception as e:
            print("Validation RecommandationCulture:", e)
    return ResultatRecommandations(cultures_validees=cultures)


@app.post("/api/ia/generer-conseil", response_model=ConseilAgricole)
async def generer_conseil(payload: RequeteIA):
    sol     = payload.type_sol or "limoneux"
    hec     = payload.hectares
    culture = CULTURE_LABELS.get(payload.culture or "", payload.culture or "culture")

    # Météo locale
    meteo_txt = "Donnees meteo non disponibles."
    try:
        meteo = await get_previsions_meteo(lat=payload.latitude, lon=payload.longitude)
        if meteo and meteo.get("temperature_2m_max"):
            temps  = meteo["temperature_2m_max"]
            pluies = meteo.get("precipitation_sum", [])
            avg_t  = sum(temps) / len(temps) if temps else 0
            tot_p  = sum(pluies) if pluies else 0
            meteo_txt = "Previsions 7j : temp max moy {:.1f}C, precipitations {:.1f}mm.".format(avg_t, tot_p)
    except Exception as e:
        print("Meteo erreur conseil:", e)

    # Paramètres enrichis
    mode_prod       = getattr(payload, "mode_production", None) or "conventionnel"
    irrigation      = getattr(payload, "irrigation", None) or False
    rendement_ha    = getattr(payload, "rendement_habituel_t_ha", None)
    prix_vise       = getattr(payload, "prix_vente_vise_eur_t", None)
    fermage         = getattr(payload, "fermage_eur_ha", None) or 0
    charges_var     = getattr(payload, "charges_variables_eur_ha", None)
    mode_vente      = getattr(payload, "mode_vente", None) or "negoce"
    prix_custom     = getattr(payload, "prix_vente_custom", None) or {}

    # Prix spécifique à cette culture
    prix_culture = prix_custom.get(payload.culture) or prix_vise

    # Construction du contexte
    donnees = []
    if rendement_ha:
        donnees.append("Rendement habituel : {:.1f} t/ha → {:.1f} t total sur {} ha (UTILISER CE CHIFFRE)".format(rendement_ha, rendement_ha * hec, hec))
    if prix_culture:
        donnees.append("Prix de vente vise : {:.0f} EUR/t (UTILISER CE PRIX)".format(prix_culture))
    if fermage > 0:
        donnees.append("Fermage : {:.0f} EUR/ha soit {:.0f} EUR pour {} ha (inclure dans charges)".format(fermage, fermage * hec, hec))
    if charges_var:
        donnees.append("Charges variables : {:.0f} EUR/ha soit {:.0f} EUR total (phyto+engrais+semences)".format(charges_var, charges_var * hec))

    mode_ctx  = {"bio": "BIO : prix x2-3, rendements -25%, certif+MO.", "raisonne": "RAISONNE : intrants -25%, prix +5-10%."}.get(mode_prod, "CONVENTIONNEL.")
    irrig_ctx = "Irrigation disponible." if irrigation else "Sans irrigation."
    vente_ctx = {"cooperative": "Vente cooperative.", "circuit_court": "Circuit court : prix x2-3.", "contrat": "Contrat fixe."}.get(mode_vente, "Vente negoce.")

    donnees_bloc = "\nDonnees reelles de l exploitant :\n" + "\n".join(["  - " + d for d in donnees]) + "\n" if donnees else ""

    prompt = (
        "Tu es un conseiller agronomique et financier expert. Genere une simulation de rentabilite precise et personnalisee.\n"
        "Culture : " + culture + " | Surface : " + str(hec) + " ha | Sol : " + sol + "\n"
        + mode_ctx + " " + irrig_ctx + " " + vente_ctx + "\n"
        + donnees_bloc
        + "Meteo locale : " + meteo_txt + "\n\n"
        "Retourne UNIQUEMENT ce JSON brut (sans markdown, sans ```) :\n"
        '{"rendement_total_tonnes": 200.0, '
        '"chiffre_affaires_euros": 44000.0, '
        '"charges_totales_euros": 28000.0, '
        '"marge_brute_euros": 16000.0, '
        '"conseil_action": "Conseil personnalise 3-4 phrases : itineraire technique optimal, periodes cles, risques specifiques a surveiller et recommandation commerciale.", '
        '"statut_meteo": "Favorable", '
        '"recommandation_globale": "recommande"}\n\n'
        "REGLES ABSOLUES :\n"
        "- rendement_total_tonnes = TOTAL pour " + str(hec) + " ha\n"
        + ("- Rendement IMPOSE : {:.1f} t/ha donc {:.1f} t total\n".format(rendement_ha, rendement_ha * hec) if rendement_ha else "")
        + ("- Prix IMPOSE : {:.0f} EUR/t\n".format(prix_culture) if prix_culture else "")
        + ("- Charges totales DOIVENT inclure fermage {:.0f} EUR\n".format(fermage * hec) if fermage else "")
        + "- marge = CA - charges (valeurs coherentes)\n"
        "- statut_meteo : Favorable | Defavorable | Incertain\n"
        "- recommandation_globale : recommande | non recommande\n"
        "- JSON brut uniquement\n"
    )

    data = await call_gemini_json(prompt)
    if not isinstance(data, dict):
        data = {}
    try:
        return ConseilAgricole(**data)
    except Exception as e:
        print("Validation ConseilAgricole:", e)
        raise HTTPException(status_code=502, detail="Format de reponse IA invalide")


@app.get("/meteo")
async def get_meteo(commune: str = "Paris", lat: float = None, lon: float = None):
    try:
        result = await get_previsions_meteo(lat=lat or 48.8566, lon=lon or 2.3522)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
