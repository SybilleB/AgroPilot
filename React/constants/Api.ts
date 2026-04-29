function resolveApiUrl(): string {
  // Utilise la variable d'environnement Expo si disponible.
  // Pour tester sur téléphone physique, change EXPO_PUBLIC_API_URL dans React/.env
  // avec l'IP locale de ton PC (ex: http://192.168.1.XX:8000)
  return (process.env.EXPO_PUBLIC_API_URL ?? "http://10.111.1.14:8000").replace(/\/$/, "");
}

export const API_BASE_URL = resolveApiUrl();

export const API_ROUTES = {
  rentabilite: {
    simulate: "/rentabilite/simulate",
  },
  subventions: {
    suggestions: "/subventions/suggestions",
  },
  marche: {
    analyse:   "/marche/analyse",
    recherche: "/marche/recherche",
  },
} as const;
