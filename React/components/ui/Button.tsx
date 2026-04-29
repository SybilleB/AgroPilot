/**
 * components/ui/Button.tsx — Bouton réutilisable AgroPilot
 *
 * Variants : primary (fond vert) | outline (bordure) | ghost (texte seul)
 * Props supplémentaires : loading (affiche ActivityIndicator)
 */
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { Colors } from '@/constants/Colors';

interface ButtonProps {
  onPress: () => void;
  children: string;
  variant?: 'primary' | 'outline' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  onPress,
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'outline' && styles.outline,
        variant === 'ghost'   && styles.ghost,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={variant === 'primary' ? '#fff' : Colors.primary} />
        : <Text style={[
            styles.label,
            variant === 'primary' && styles.labelPrimary,
            variant === 'outline' && styles.labelOutline,
            variant === 'ghost'   && styles.labelGhost,
          ]}>
            {children}
          </Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primary: { backgroundColor: Colors.primary },
  outline: { borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: 'transparent' },
  ghost:   { backgroundColor: 'transparent' },
  disabled: { opacity: 0.5 },
  label:        { fontSize: 15, fontWeight: '600' },
  labelPrimary: { color: '#fff' },
  labelOutline: { color: Colors.primary },
  labelGhost:   { color: Colors.primary },
});
