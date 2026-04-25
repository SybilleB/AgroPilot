from fastapi import FastAPI, Query
from datetime import date, timedelta
from schemas import RecommendationRequest, RecommendationResponse, Intervention
from services import get_historique_meteo

app = FastAPI(
    title="API Co-pilote Agricole",
    description="API pour les recommandations agronomiques",
    version="1.0.0"
)

@app.post(
    "/api/recommandations/semis", 
    response_model=RecommendationResponse,
    summary="Obtenir une recommandation de semis et fertilisation"
)
async def obtenir_recommandation(donnees: RecommendationRequest):
    """
    Cette route reçoit les données de la parcelle (GPS, sol, culture)
    et renvoie l'optimum technico-économique (bouchonné pour le moment).
    """
    
    aujourd_hui = date.today()
    
    reponse_mock = RecommendationResponse(
        date_semis_optimale=aujourd_hui + timedelta(days=5),
        variete_recommandee=f"Variété standard adaptée au sol {donnees.type_sol.value}",
        explication_meteo="Les prévisions indiquent 15mm de pluie dans 5 jours, idéal pour la levée.",
        plan_fertilisation=[
            Intervention(
                date_prevue=aujourd_hui + timedelta(days=20),
                action="1er apport azoté",
                produit_ou_engrais="Ammonitrate",
                quantite="40",
                unite="kg/ha"
            )
        ],
        plan_phytosanitaire=[],
        score_confiance=0.85
    )
    
    return reponse_mock

@app.get(
    "/api/meteo/historique", 
    summary="Récupérer l'historique météo (Open-Meteo)"
)
async def route_historique_meteo(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    jours_en_arriere: int = Query(30, description="Combien de jours d'historique ?")
):
    """
    Route proxy pour récupérer la météo passée d'une parcelle.
    """
    date_fin = date.today() - timedelta(days=2) 
    date_debut = date_fin - timedelta(days=jours_en_arriere)
    
    donnees_meteo = await get_historique_meteo(lat, lon, date_debut, date_fin)
    
    return {
        "parcelle": {"latitude": lat, "longitude": lon},
        "periode": {"debut": date_debut, "fin": date_fin},
        "donnees": donnees_meteo
    }
    
@app.post("/api/parcelles", summary="Sauvegarder une nouvelle parcelle")
async def sauvegarder_parcelle(parcelle: RecommendationRequest, nom: str):
    """
    Enregistre les coordonnées et les choix de l'agriculteur dans Supabase.
    """
    nouvelle_entree = {
        "nom": nom,
        "latitude": parcelle.latitude,
        "longitude": parcelle.longitude,
        "culture_code": parcelle.culture.value,
        "type_sol": parcelle.type_sol.value
    }

    resultat = supabase.table("parcelles").insert(nouvelle_entree).execute()
    
    return {"status": "success", "data": resultat.data}