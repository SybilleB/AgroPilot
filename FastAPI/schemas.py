from pydantic import BaseModel, Field
from typing import List, Optional, Dict

class RequeteTop3(BaseModel):
    # ── Exploitation ─────────────────────────────────────────────────────────
    hectares:             float
    type_sol:             str
    latitude:             float
    longitude:            float
    # ── Production ───────────────────────────────────────────────────────────
    cultures_souhaitees:  Optional[List[str]]        = None   # cultures ciblées
    mode_production:      Optional[str]              = None   # conventionnel | raisonne | bio
    irrigation:           Optional[bool]             = None   # accès à l'irrigation
    # ── Données économiques réelles de l'agriculteur ──────────────────────────
    rendement_habituel_t_ha: Optional[float]         = None   # rendement moyen connu (t/ha)
    prix_vente_vise_eur_t:   Optional[float]         = None   # prix de vente visé (€/t)
    fermage_eur_ha:          Optional[float]         = None   # loyer foncier (€/ha/an)
    charges_variables_eur_ha: Optional[float]        = None   # phyto+engrais+semences (€/ha)
    mode_vente:              Optional[str]           = None   # cooperative|negoce|circuit_court|contrat
    prix_vente_custom:    Optional[Dict[str, float]] = None   # €/t par culture (legacy)

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

class RequeteConseil(RequeteTop3):
    """Requête conseil culture — étend RequeteTop3 avec la culture ciblée."""
    culture: str

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

class PrixLiveItem(BaseModel):
    culture:       str
    culture_key:   str
    ticker:        str
    marche:        str
    prix_eur:      float
    variation_pct: Optional[float] = None
    tendance:      str                   # hausse / baisse / stable
    historique:    List[float] = []      # 30 dernières clôtures en EUR/t

class PrixLiveResponse(BaseModel):
    items:     List[PrixLiveItem]
    timestamp: str                       # heure de la requête HH:MM