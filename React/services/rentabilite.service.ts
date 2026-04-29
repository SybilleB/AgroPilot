/**
 * services/rentabilite.service.ts — Simulation de rentabilité IA
 * Appelle /api/ia/recommandations (Top 3) et /api/ia/generer-conseil (détail)
 */
import { API_BASE_URL } from '@/constants/Api';

// ─── Types (miroir des schémas FastAPI) ───────────────────────────────────────

export interface RecommandationCulture {
  nom_culture:              string;
  rendement_total_tonnes:   number;
  chiffre_affaires_euros:   number;
  charges_totales_euros:    number;
  marge_brute_euros:        number;
  conseil_action:           string;
  statut_meteo:             'Favorable' | 'Défavorable' | 'Incertain';
  recommandation_globale:   'recommandé' | 'non recommandé';
}

export interface ResultatRecommandations {
  cultures_validees: RecommandationCulture[];
}

export interface ConseilAgricole {
  rendement_total_tonnes:   number;
  chiffre_affaires_euros:   number;
  charges_totales_euros:    number;
  marge_brute_euros:        number;
  conseil_action:           string;
  statut_meteo:             'Favorable' | 'Défavorable' | 'Incertain';
  recommandation_globale:   'recommandé' | 'non recommandé';
}

export interface RequeteTop3 {
  // Exploitation
  hectares:             number;
  type_sol:             string;
  latitude:             number;
  longitude:            number;
  // Production
  cultures_souhaitees?:      string[];
  mode_production?:          string;          // conventionnel | raisonne | bio
  irrigation?:               boolean;
  // Données économiques réelles
  rendement_habituel_t_ha?:  number;          // t/ha connu de l'agriculteur (0 = non renseigné)
  prix_vente_vise_eur_t?:    number;          // €/t cible (0 = non renseigné)
  fermage_eur_ha?:            number;          // loyer foncier €/ha/an
  charges_variables_eur_ha?: number;          // phyto+engrais+semences €/ha (0 = non renseigné)
  mode_vente?:               string;          // cooperative | negoce | circuit_court | contrat
  prix_vente_custom?:        Record<string, number>;
}

export interface RequeteConseil extends RequeteTop3 {
  culture: string;
}

// ─── Appels API ───────────────────────────────────────────────────────────────

export async function fetchRecommandations(req: RequeteTop3): Promise<ResultatRecommandations> {
  const res = await fetch(`${API_BASE_URL}/api/ia/recommandations`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? `Erreur serveur (${res.status})`);
  }
  return res.json();
}

export async function fetchConseil(req: RequeteConseil): Promise<ConseilAgricole> {
  const res = await fetch(`${API_BASE_URL}/api/ia/generer-conseil`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail ?? `Erreur serveur (${res.status})`);
  }
  return res.json();
}
