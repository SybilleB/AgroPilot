from pydantic import BaseModel, Field
from typing import List

class RequeteTop3(BaseModel):
    hectares: float
    type_sol: str         
    latitude: float
    longitude: float

class RecommandationCulture(BaseModel):
    nom_culture: str = Field(description="Le nom de la culture (ex: Blé tendre)")
    rendement_total_tonnes: float = Field(description="Le rendement total estimé en tonnes")
    chiffre_affaires_euros: float = Field(description="Le CA total estimé")
    charges_totales_euros: float = Field(description="Les charges totales estimées")
    marge_brute_euros: float = Field(description="La marge brute totale")
    conseil_action: str = Field(description="Conseil agronomique court (3 lignes max) basé sur la météo")
    statut_meteo: str = Field(description="Conditions météo : 'Favorable', 'Défavorable', ou 'Incertain'")
    recommandation_globale: str = Field(description="Verdict final du projet. Doit être strictement 'recommandé' ou 'non recommandé'")

class ResultatRecommandations(BaseModel):
    cultures_validees: List[RecommandationCulture] = Field(
        description="Liste de toutes les cultures jugées 'recommandées'. Peut être vide si aucune ne convient."
    )
class RequeteIA(BaseModel):
    hectares: float
    culture: str
    type_sol: str
    latitude: float
    longitude: float

class ConseilAgricole(BaseModel):
    rendement_total_tonnes: float = Field(description="Le rendement total estimé en tonnes")
    chiffre_affaires_euros: float = Field(description="Le CA total estimé")
    charges_totales_euros: float = Field(description="Les charges totales estimées")
    marge_brute_euros: float = Field(description="La marge brute totale")
    conseil_action: str = Field(description="Conseil agronomique court (3 lignes max) basé sur la météo")
    statut_meteo: str = Field(description="Conditions météo : 'Favorable', 'Défavorable', ou 'Incertain'")    
    recommandation_globale: str = Field(description="Verdict final du projet. Doit être strictement 'recommandé' ou 'non recommandé'")