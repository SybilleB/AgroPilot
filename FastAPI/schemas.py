from pydantic import BaseModel, Field
from typing import List, Optional

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
    montant_label:    str           
    pourquoi_eligible:str           
    demarches:        str           
    url:              Optional[str] = None
    categorie:        str           
    score:            int           

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
    prix_actuel:   Optional[str]  = None   
    tendance:      Optional[str]  = None   
    variation:     Optional[str]  = None   
    contexte:      Optional[str]  = None

class Recommandation(BaseModel):
    titre:   str
    detail:  str
    urgence: str  

class Actualite(BaseModel):
    titre:      str
    resume:     str
    source:     Optional[str] = None
    url:        Optional[str] = None
    importance: str  

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