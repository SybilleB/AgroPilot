/**
 * services/subventions.service.ts
 *
 * Envoie le profil utilisateur au backend FastAPI qui :
 *  1. Recherche les aides récentes via Tavily
 *  2. Demande à Claude d'analyser l'éligibilité
 *  3. Retourne des cartes structurées
 */
import { API_BASE_URL, API_ROUTES } from '@/constants/Api';
import { FullProfile } from '@/services/profile.service';

export interface SubventionCard {
  nom:               string;
  organisme:         string;
  description:       string;
  montant_label:     string;
  pourquoi_eligible: string;
  demarches:         string;
  url:               string | null;
  categorie:         'pac' | 'national' | 'regional' | 'certification';
  score:             number;   // 1-5
}

/** Construit le payload à envoyer à FastAPI depuis le FullProfile Supabase. */
function buildPayload(fp: FullProfile): Record<string, unknown> {
  const e = fp.exploitation;
  return {
    type_exploitation:   e?.type_exploitation   ?? null,
    methode_production:  e?.methode_production  ?? null,
    certifications:      e?.certifications      ?? [],
    surface_ha:          e?.surface_ha          ?? null,
    departement:         e?.departement         ?? null,
    region:              e?.region              ?? null,
    commune:             e?.commune             ?? null,
    cultures:            fp.cultures.map(c => c.type_culture),
    situation_familiale: fp.profile.situation_familiale ?? null,
    date_naissance:      fp.profile.date_naissance      ?? null,
    nb_enfants:          fp.profile.nb_enfants          ?? null,
  };
}

/** Appelle l'endpoint et retourne les cartes triées par score. */
export async function fetchSubventionSuggestions(
  fullProfile: FullProfile
): Promise<SubventionCard[]> {
  const payload = buildPayload(fullProfile);

  const resp = await fetch(`${API_BASE_URL}${API_ROUTES.subventions.suggestions}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.detail ?? `Erreur serveur (${resp.status})`);
  }

  const cards: SubventionCard[] = await resp.json();
  return cards.sort((a, b) => b.score - a.score);
}
