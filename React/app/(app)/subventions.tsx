/**
 * app/(app)/subventions.tsx — Écran Subventions
 *
 * Responsables : Pierre-Antoine & Angie
 *
 * À implémenter :
 *  1. Récupérer les subventions éligibles via le backend IA (FastAPI).
 *  2. Route : GET /subventions/search?user_id=... (voir constants/Api.ts)
 *  3. Afficher les résultats filtrés selon le profil :
 *     type exploitation, surface, certifications, département…
 *
 * Types    : Subvention dans @/types/index.ts
 * Route API: API_ROUTES.subventions.search dans @/constants/Api.ts
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { Card } from '@/components/ui/Card';

export default function SubventionsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>💶 Subventions</Text>
        <Text style={styles.subtitle}>Aides disponibles pour votre exploitation</Text>
      </View>
      <Card style={styles.card}>
        <Text style={styles.placeholder}>🚧  Moteur de recherche IA à implémenter</Text>
        <Text style={styles.hint}>
          Voir @/types/index.ts → Subvention{`\n`}et @/constants/Api.ts → API_ROUTES.subventions
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
