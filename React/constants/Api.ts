/**
 * constants/Api.ts — Routes FastAPI
 *
 * À compléter quand le backend sera prêt.
 * Format : API_BASE_URL + la route (ex: API_ROUTES.rentabilite.simulate)
 */

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export const API_ROUTES = {
  rentabilite: {
    simulate: '/rentabilite/simulate',
  },
  subventions: {
    search: '/subventions/search',
  },
  marches: {
    prix: '/marches/prix',
  },
} as const;
