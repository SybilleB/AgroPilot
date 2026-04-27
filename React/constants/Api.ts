/**
 * constants/Api.ts — Routes FastAPI
 *
 * URL sélectionnée automatiquement selon la plateforme :
 *  - EXPO_PUBLIC_API_URL dans .env → priorité absolue (prod / device physique)
 *  - iOS simulateur  → 127.0.0.1  (localhost ne résout pas sur iOS)
 *  - Android émulateur → 10.0.2.2 (passerelle vers la machine hôte)
 *  - Web             → localhost
 *
 * Sur device physique, définir EXPO_PUBLIC_API_URL=http://<IP_DU_MAC>:8000
 */
import { Platform } from 'react-native';

function resolveApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'ios')     return 'http://127.0.0.1:8000';
  if (Platform.OS === 'android') return 'http://10.0.2.2:8000';
  return 'http://localhost:8000';
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
