/**
 * components/ui/Input.tsx — Champ de saisie avec label et message d'erreur
 */
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Colors } from '@/constants/Colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={Colors.textPlaceholder}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:    { marginBottom: 16 },
  label:      { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  inputError: { borderColor: Colors.error },
  error:      { fontSize: 12, color: Colors.error, marginTop: 4 },
});
