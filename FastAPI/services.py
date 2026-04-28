import httpx
from datetime import date
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url = os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
key = os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

async def get_historique_meteo(lat: float, lon: float, date_debut: date, date_fin: date):
    """
    Interroge l'API Open-Meteo Archive pour récupérer les températures et la pluie
    sur une période donnée.
    """
    url = "https://archive-api.open-meteo.com/v1/archive"
    
    parametres = {
        "latitude": lat,
        "longitude": lon,
        "start_date": date_debut.strftime("%Y-%m-%d"),
        "end_date": date_fin.strftime("%Y-%m-%d"),
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
        "timezone": "Europe/Paris"
    }

    async with httpx.AsyncClient() as client:
        reponse = await client.get(url, params=parametres)
        reponse.raise_for_status() 
        
        donnees = reponse.json()
        return donnees["daily"]
    
async def get_previsions_meteo(lat: float, lon: float):
    """
    Récupère les prévisions météo pour les 7 prochains jours.
    Inclut la température du sol (crucial pour le semis).
    """
    url = "https://api.open-meteo.com/v1/forecast"
    
    parametres = {
        "latitude": lat,
        "longitude": lon,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
        "timezone": "Europe/Paris",
        "forecast_days": 7
    }

    async with httpx.AsyncClient() as client:
        reponse = await client.get(url, params=parametres)
        reponse.raise_for_status()
        return reponse.json()["daily"]