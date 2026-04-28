from pydantic import BaseModel, Field
from typing import List

class RequeteTop3(BaseModel):
    hectares: float
    type_sol: str         
    latitude: float
    longitude: float

class RecommandationCulture(BaseModel):
    nom_culture: str = Field(description="Le nom de la culture (ex: Blé tendre)")
    rendement_total_tonnes: float = Field(description="Le rendement total ajusté selon le sol")
    marge_brute_euros: float = Field(description="La marge brute totale estimée en euros")
    justification_sol: str = Field(description="Pourquoi cette culture est adaptée à ce sol (1 ligne)")
    conseil_meteo: str = Field(description="Conseil de semis basé sur la météo à 7 jours")
    statut_meteo: str = Field(description="Doit être 'FEU VERT', 'FEU ROUGE', ou 'ATTENTE'")

class Top3Reponse(BaseModel):
    classement: List[RecommandationCulture] = Field(description="La liste strictement limitée aux 3 cultures les plus rentables")