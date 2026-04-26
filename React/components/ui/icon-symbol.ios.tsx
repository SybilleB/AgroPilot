/**
 * components/ui/icon-symbol.ios.tsx — Icônes natives SF Symbols (iOS uniquement)
 *
 * Sur iOS, Metro charge automatiquement ce fichier à la place de icon-symbol.tsx.
 * Utilise les SF Symbols natifs pour un rendu pixel-perfect.
 */
import { SymbolView, SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { StyleProp, ViewStyle } from 'react-native';

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
}: {
  name: SymbolViewProps['name'];
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <SymbolView
      weight={weight}
      tintColor={color}
      resizeMode="scaleAspectFit"
      name={name}
      style={[{ width: size, height: size }, style]}
    />
  );
}
