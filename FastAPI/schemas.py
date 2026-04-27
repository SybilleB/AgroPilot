from pydantic import BaseModel, Field

# 1. Ce que React Native t'envoie
class RequeteIA(BaseModel):
    hectares: float
    culture: str          
    type_sol: str         
    latitude: float
    longitude: float

# 2. Ce que Gemini DOIT te renvoyer (Le format strict)
class ConseilAgricole(BaseModel):
    rendement_total_tonnes: float = Field(description="Le rendement total estimé en tonnes")
    chiffre_affaires_euros: float = Field(description="Le CA total estimé")
    charges_totales_euros: float = Field(description="Les charges totales estimées")
    marge_brute_euros: float = Field(description="La marge brute totale")
    conseil_action: str = Field(description="Conseil agronomique court (3 lignes max) basé sur la météo")
    statut_meteo: str = Field(description="Doit être 'FEU VERT', 'FEU ROUGE', ou 'ATTENTE'")