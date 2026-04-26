/**
 * constants/Colors.ts — Palette de couleurs AgroPilot
 * Importer depuis ici dans tous les écrans et composants.
 */
export const Colors = {
  // Verts principaux
  primary:        '#2E7D32',
  primaryDark:    '#1B5E20',
  primaryLight:   '#4CAF50',
  primaryMuted:   '#558B2F',
  primaryBg:      '#F1F8E9',

  // Texte
  text:           '#212121',
  textMuted:      '#757575',
  textPlaceholder:'#BDBDBD',

  // Fond
  white:          '#FFFFFF',
  background:     '#F9FBF5',
  border:         '#E0E0E0',

  // Onglets
  tabActive:      '#2E7D32',
  tabInactive:    '#9E9E9E',
  tabBackground:  '#FFFFFF',

  // États
  error:          '#E53935',
  errorDark:      '#B71C1C',
  errorBg:        '#FFEBEE',
  warning:        '#F9A825',
  warningBg:      '#FFF8E1',
  success:        '#2E7D32',
  successBg:      '#E8F5E9',
} as const;
