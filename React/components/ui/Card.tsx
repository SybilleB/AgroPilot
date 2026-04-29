/**
 * components/ui/Card.tsx — Carte conteneur
 *
 * Variants :
 *  - default   : fond blanc avec ombre légère
 *  - highlight : fond vert très clair (primaryBg)
 *  - flat      : fond blanc sans ombre
 */
import { StyleSheet, View, ViewProps } from 'react-native';
import { Colors } from '@/constants/Colors';

interface CardProps extends ViewProps {
  variant?: 'default' | 'highlight' | 'flat';
}

export function Card({ variant = 'default', style, children, ...props }: CardProps) {
  return (
    <View
      style={[
        styles.base,
        variant === 'highlight' && styles.highlight,
        variant === 'flat'      && styles.flat,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  highlight: { backgroundColor: Colors.primaryBg, shadowOpacity: 0 },
  flat:      { shadowOpacity: 0, elevation: 0 },
});
