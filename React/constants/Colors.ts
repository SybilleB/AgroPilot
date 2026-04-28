/**
 * constants/Colors.ts — Palette de couleurs AgroPilot
 * Design system v2 — Vert forêt sombre / Fond crème chaud
 */
export const Colors = {
  // ── Marque principale ────────────────────────────────────────────────────
  primary: '#2D6A0A',   // boutons, liens, accents
  primaryDark: '#1A3A0F',   // fond header, titres foncés
  primaryLight: '#4A8C1C',   // barres graphiques, états actifs
  primaryMuted: '#5A7A3A',   // texte vert secondaire
  primaryBg: '#E8EFD8',   // fond chip actif, badges verts légers

  // ── Tokens header ────────────────────────────────────────────────────────
  headerBg: '#39811c',   // fond header AgroPilot (couleur de l'accueil)
  headerText: '#FFFFFF',
  headerTextMuted: 'rgba(255,255,255,0.65)',

  // ── Fond & surfaces ──────────────────────────────────────────────────────
  background: '#F5F0E8',   // fond général (crème chaud)
  backgroundAlt: '#EDE8DC',   // surfaces légèrement plus foncées
  backgroundCard: '#FFFFFF',   // fond des cards

  // ── Carte "Analyse IA" ───────────────────────────────────────────────────
  aiCardBg: '#E8EFD8',   // fond sage clair
  aiCardBorder: '#3A6418',   // bordure gauche verte

  // ── Texte ────────────────────────────────────────────────────────────────
  text: '#1A1A1A',
  textMuted: '#6B7561',
  textPlaceholder: '#9FAD8A',
  textOnDark: '#FFFFFF',

  // ── Bordures ─────────────────────────────────────────────────────────────
  border: '#DDD8CC',
  borderStrong: '#B8B0A0',

  // ── Onglets navigation ───────────────────────────────────────────────────
  tabActive: '#1A3A0F',
  tabInactive: '#9E9E9E',
  tabBackground: '#FFFFFF',

  // ── États ────────────────────────────────────────────────────────────────
  error: '#C0392B',
  errorDark: '#922B21',
  errorBg: '#FDEDEC',
  warning: '#D68910',
  warningBg: '#FEF9E7',
  success: '#1E8449',
  successBg: '#EAFAF1',

  // ── Blanc ────────────────────────────────────────────────────────────────
  white: '#FFFFFF',
} as const;
