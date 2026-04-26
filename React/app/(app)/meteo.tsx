/**
 * app/(app)/meteo.tsx — Écran Météo
 *
 * Responsables : Kelyan + Maïlys
 * À implémenter : météo actuelle + prévisions 7 jours via API externe.
 * Service : @/services/meteo.service.ts
 */
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

export default function MeteoScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.icon}>🌤️</Text>
      <Text style={styles.title}>Météo</Text>
      <Text style={styles.subtitle}>À venir</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', gap: 8 },
  icon:      { fontSize: 48 },
  title:     { fontSize: 22, fontWeight: '700', color: Colors.primaryDark },
  subtitle:  { fontSize: 14, color: Colors.textMuted },
});
