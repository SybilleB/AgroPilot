import { Platform } from "react-native";

function resolveApiUrl(): string {
  return "http://10.111.1.32:8000/"; // Remplace par l'IP de ton serveur local (carte réseau de ton PC sur le meme réseau que ton téléphone)
}

export const API_BASE_URL = resolveApiUrl();

export const API_ROUTES = {
  rentabilite: {
    simulate: "/rentabilite/simulate",
  },
  subventions: {
    suggestions: "/subventions/suggestions",
  },
  marches: {
    prix: "/marches/prix",
  },
} as const;
