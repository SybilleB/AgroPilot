import { Platform } from 'react-native';

function resolveApiUrl(): string {
  return 'http://10.111.1.57:8000'; // Remplace par l'IP de ton serveur local (carte rÃ©seau de ton PC sur le meme rÃ©seau que ton tÃ©lÃ©phone)
}

export const API_BASE_URL = resolveApiUrl();

export const API_ROUTES = {
  rentabilite: {
    simulate: '/rentabilite/simulate',
  },
  subventions: {
    suggestions: '/subventions/suggestions',
  },
  marches: {
    prix: '/marches/prix',
  },
} as const;
