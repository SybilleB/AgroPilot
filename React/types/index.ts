/**
 * types/index.ts — Types TypeScript partagés dans toute l'app
 *
 * Correspondent aux tables Supabase.
 * Toute l'équipe doit importer depuis ici pour rester cohérente.
 */

// ─── Profil utilisateur ────────────────────────────────────────────────────

export interface Profile {
  id: string;                        // UUID Supabase auth
  prenom: string;
  nom: string;
  phone?: string;
  date_naissance?: string;           // ISO date (YYYY-MM-DD)
  situation_familiale?: SituationFamiliale;
  nb_enfants?: number;
  created_at?: string;
  updated_at?: string;
}

export type SituationFamiliale =
  | 'celibataire'
  | 'marie'
  | 'pacse'
  | 'divorce'
  | 'veuf';

// ─── Exploitation ──────────────────────────────────────────────────────────

export interface Exploitation {
  id?: string;
  user_id: string;
  nom_exploitation?: string;
  commune?: string;
  code_postal?: string;
  departement?: string;
  region?: string;
  surface_ha?: number;
  type_exploitation?: TypeExploitation;
  methode_production?: MethodeProduction;
  certifications?: Certification[];
}

export type TypeExploitation =
  | 'grandes_cultures'
  | 'elevage_bovin'
  | 'elevage_porcin'
  | 'elevage_avicole'
  | 'viticulture'
  | 'maraichage'
  | 'arboriculture'
  | 'mixte';

export type MethodeProduction =
  | 'conventionnelle'
  | 'raisonnee'
  | 'hve'
  | 'bio'
  | 'biodynamie';

export type Certification =
  | 'hve'
  | 'ab'
  | 'label_rouge'
  | 'aoc_aop'
  | 'igp';

// ─── Cultures (assolement) ─────────────────────────────────────────────────

export interface CultureExploitation {
  id?: string;
  exploitation_id: string;
  type_culture: TypeCulture;
  surface_ha?: number;         // surface dédiée à cette culture
}

// ─── Historique des cultures ───────────────────────────────────────────────

export interface HistoriqueCulture {
  id?: string;
  exploitation_id: string;
  annee: number;               // ex : 2023
  type_culture: TypeCulture;
  surface_ha?: number;         // ha cultivés cette année-là
  rendement?: number;          // t/ha réalisé (optionnel)
}

export type TypeCulture =
  | 'ble_tendre'
  | 'ble_dur'
  | 'orge_hiver'
  | 'orge_printemps'
  | 'mais'
  | 'tournesol'
  | 'colza'
  | 'soja'
  | 'betterave'
  | 'pomme_de_terre'
  | 'lin'
  | 'pois'
  | 'luzerne'
  | 'prairie'
  | 'autre';

// ─── Simulation de rentabilité ─────────────────────────────────────────────

export interface SimulationRentabilite {
  id?: string;
  user_id: string;
  culture: TypeCulture;
  surface_ha: number;
  prix_vente_tonne: number;    // €/t
  rendement_estime: number;    // t/ha
  charges_fixes: number;       // €/ha
  charges_variables: number;   // €/ha
  // Calculé côté backend :
  chiffre_affaires?: number;
  charges_totales?: number;
  marge_brute?: number;
  marge_nette?: number;
  created_at?: string;
}

// ─── Subventions ───────────────────────────────────────────────────────────

export interface Subvention {
  id: string;
  nom: string;
  organisme: string;
  description: string;
  montant_max?: number;
  date_limite?: string;
  eligible?: boolean;          // calculé par l'IA en fonction du profil
  url?: string;
}
