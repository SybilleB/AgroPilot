/**
 * app/(app)/rentabilite.tsx — Simulation de rentabilité
 *
 * Responsables : Sybille & Florian
 *
 * À implémenter :
 *  1. Formulaire : culture, surface, prix de vente, rendement estimé,
 *     charges fixes/variables par hectare.
 *  2. Appel FastAPI : POST /rentabilite/simulate (voir constants/Api.ts)
 *  3. Affichage des résultats : marge brute, marge nette, seuil de rentabilité.
 *
 * Types    : SimulationRentabilite dans @/types/index.ts
 * Route API: API_ROUTES.rentabilite.simulate dans @/constants/Api.ts
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Card } from '@/components/ui/Card';

export default function RentabiliteScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Rentabilité</Text>
        <Text style={styles.subtitle}>Simulez votre marge nette par hectare</Text>
      </View>
      <Card style={styles.card}>
        <Text style={styles.placeholder}>🚧  Formulaire de simulation à implémenter</Text>
        <Text style={styles.hint}>
          Voir @/types/index.ts → SimulationRentabilite{`\n`}et @/constants/Api.ts → API_ROUTES.rentabilite
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.white },
  container:   { paddingHorizontal: 20, paddingBottom: 32 },
  header:      { marginBottom: 24 },
  title:       { fontSize: 26, fontWeight: '800', color: Colors.primaryDark },
  subtitle:    { fontSize: 14, color: Colors.textMuted, marginTop: 4 },
  card:        { marginBottom: 14 },
  placeholder: { fontSize: 15, color: Colors.textMuted, textAlign: 'center', paddingVertical: 16 },
  hint:        { fontSize: 12, color: Colors.textPlaceholder, textAlign: 'center', marginTop: 4, lineHeight: 18 },
});
