from pydantic import BaseModel, Field
from datetime import date
from typing import List, Optional
from enum import Enum

class SolType(str, Enum):
    ARGILEUX = "argileux"
    SABLEUX = "sableux"
    LIMONEUX = "limoneux"
    CALCAIRE = "calcaire"

class CultureType(str, Enum):
    BLE = "ble_tendre"
    MAIS = "mais_grain"
    COLZA = "colza"
    VIGNE = "vigne"

class RecommendationRequest(BaseModel):
    latitude: float = Field(..., description="Latitude de la parcelle", example=44.837)
    longitude: float = Field(..., description="Longitude de la parcelle", example=-0.579)
    culture: CultureType
    type_sol: SolType
    
class Intervention(BaseModel):
    date_prevue: date
    action: str
    produit_ou_engrais: str
    quantite: str
    unite: str 

class RecommendationResponse(BaseModel):
    date_semis_optimale: date
    variete_recommandee: str
    explication_meteo: str
    plan_fertilisation: List[Intervention]
    plan_phytosanitaire: List[Intervention]
    score_confiance: float = Field(..., ge=0, le=1)