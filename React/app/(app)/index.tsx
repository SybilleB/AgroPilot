/**
 * app/(app)/index.tsx — Tableau de bord principal
 */
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useProfile } from "@/hooks/useProfile";
import { Card } from "@/components/ui/Card";
import { Colors } from "@/constants/Colors";

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { fullProfile, isComplete, loading } = useProfile();

  const prenom = fullProfile?.profile?.prenom;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 16 },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Bonjour{prenom ? `, ${prenom}` : ""} 👋
          </Text>
          <Text style={styles.title}>AgroPilot</Text>
        </View>
      </View>

      {/* Bannière profil incomplet */}
      {!loading && !isComplete && (
        <TouchableOpacity
          style={styles.banner}
          onPress={() => router.push("/profile-setup")}
          activeOpacity={0.85}
        >
          <View style={styles.bannerContent}>
            <Text style={styles.bannerIcon}>📋</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Complétez votre profil</Text>
              <Text style={styles.bannerDesc}>
                Pour que lIA trouve les subventions qui vous correspondent, on a
                besoin de quelques infos sur votre exploitation.
              </Text>
            </View>
            <Text style={styles.bannerArrow}>→</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Cartes de navigation */}
      <TouchableOpacity
        onPress={() => router.push("/(app)/rentabilite")}
        activeOpacity={0.85}
      >
        <Card variant="highlight" style={styles.card}>
          <Text style={styles.cardIcon}>📊</Text>
          <Text style={styles.cardTitle}>Simulation de rentabilité</Text>
          <Text style={styles.cardDesc}>
            Estimez votre marge nette par hectare avant de semer
          </Text>
        </Card>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/(app)/meteo")}
        activeOpacity={0.85}
      >
        <Card variant="highlight" style={styles.card}>
          <Text style={styles.cardIcon}>🌤️</Text>
          <Text style={styles.cardTitle}>Météo de votre exploitation</Text>
          <Text style={styles.cardDesc}>
            Conditions en temps réel et prévisions 7 jours
          </Text>
        </Card>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/(app)/subventions")}
        activeOpacity={0.85}
      >
        <Card variant="highlight" style={styles.card}>
          <Text style={styles.cardIcon}>💶</Text>
          <Text style={styles.cardTitle}>Subventions disponibles</Text>
          <Text style={styles.cardDesc}>
            PAC, aides régionales et plan de relance — filtrées pour votre
            exploitation
          </Text>
        </Card>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },
  container: { paddingHorizontal: 20, paddingBottom: 32 },
  header: { marginBottom: 20 },
  greeting: { fontSize: 14, color: Colors.textMuted },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.primaryDark,
    marginTop: 2,
  },
  // Bannière
  banner: {
    backgroundColor: Colors.warningBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FFE082",
  },
  bannerContent: { flexDirection: "row", alignItems: "center", gap: 10 },
  bannerIcon: { fontSize: 22 },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#5D4037",
    marginBottom: 3,
  },
  bannerDesc: { fontSize: 12, color: "#795548", lineHeight: 17 },
  bannerArrow: { fontSize: 18, color: Colors.warning, fontWeight: "700" },
  // Cartes
  card: { marginBottom: 14, gap: 4 },
  cardIcon: { fontSize: 28, marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: Colors.primaryDark },
  cardDesc: { fontSize: 13, color: Colors.primaryMuted, lineHeight: 18 },
});
