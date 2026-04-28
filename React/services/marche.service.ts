/**
 * services/marche.service.ts — Analyse de marché agricole
 * Appelle /marche/analyse (analyse personnalisée) et /marche/recherche (libre)
 */
import { API_BASE_URL } from '@/constants/Api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PrixCulture {
  culture:     string;
  prix_actuel: string | null;
  tendance:    'hausse' | 'baisse' | 'stable' | null;
  variation:   string | null;
  contexte:    string | null;
}

export interface Recommandation {
  titre:   string;
  detail:  string;
  urgence: 'haute' | 'normale' | 'basse';
}

export interface Actualite {
  titre:      string;
  resume:     string;
  source:     string | null;
  url:        string | null;
  importance: 'haute' | 'normale';
}

export interface MarcheAnalyse {
  prix:            PrixCulture[];
  synthese:        string;
  recommandations: Recommandation[];
  opportunites:    string[];
  risques:         string[];
  actualites:      Actualite[];
  horodatage:      string;
}

export interface RechercheResultat {
  question:   string;
  reponse:    string;
  sources:    { titre: string; url: string }[];
  horodatage: string;
}

export interface MarcheRequest {
  cultures?:           string[];
  type_exploitation?:  string;
  methode_production?: string;
  region?:             string;
  departement?:        string;
  surface_ha?:         number;
}

export interface RechercheRequest {
  question: string;
  cultures?: string[];
  region?:   string;
}

// ─── Appels API ───────────────────────────────────────────────────────────────

export async function fetchMarcheAnalyse(req: MarcheRequest): Promise<MarcheAnalyse> {
  const res = await fetch(`${API_BASE_URL}/marche/analyse`, {
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

export async function fetchMarcheRecherche(req: RechercheRequest): Promise<RechercheResultat> {
  const res = await fetch(`${API_BASE_URL}/marche/recherche`, {
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
