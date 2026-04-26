/**
 * app/index.tsx — Landing page (utilisateur non connecté)
 */
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';

const FEATURES = [
  {
    icon: '📊',
    label: 'Simulation de rentabilité',
    desc: 'Croisez vos charges et rendements pour anticiper vos marges',
  },
  {
    icon: '💶',
    label: 'Aide aux subventions',
    desc: 'Découvrez toutes les aides auxquelles vous avez droit',
  },
  {
    icon: '🌤️',
    label: 'Météo locale',
    desc: 'Conditions météo en temps réel pour votre exploitation',
  },
];

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Pas de redirect ici — le guard _layout.tsx est la seule autorité de navigation.
  // Si l'utilisateur a une session active, le guard le renvoie vers /(app) directement.
  // Si l'utilisateur vient de se déconnecter, il doit voir cette page sans bounce-back.

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 32 }]} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>🌾</Text>
          <Text style={styles.heroTitle}>AgroPilot</Text>
          <Text style={styles.heroSubtitle}>Votre copilote financier agricole</Text>
          <Text style={styles.heroDesc}>
            Prenez les meilleures décisions face à la volatilité des marchés,
            l'explosion des coûts et la complexité administrative.
          </Text>
        </View>

        {/* Fonctionnalités */}
        <View style={styles.features}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureCard}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureLabel}>{f.label}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={styles.cta}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Je m'inscris</Text>
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Déjà un compte ? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.loginLink}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.white },
  container: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 48 },
  // Hero
  hero:         { alignItems: 'center', marginBottom: 40 },
  heroIcon:     { fontSize: 64, marginBottom: 12 },
  heroTitle:    { fontSize: 38, fontWeight: '800', color: Colors.primaryDark, letterSpacing: 0.5 },
  heroSubtitle: { fontSize: 16, color: Colors.primary, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  heroDesc:     { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 21, marginTop: 12, paddingHorizontal: 8 },
  // Features
  features:     { gap: 12, marginBottom: 40 },
  featureCard:  { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.primaryBg, borderRadius: 14, padding: 16, gap: 14 },
  featureIcon:  { fontSize: 28, lineHeight: 34 },
  featureText:  { flex: 1 },
  featureLabel: { fontSize: 14, fontWeight: '700', color: Colors.primaryDark, marginBottom: 3 },
  featureDesc:  { fontSize: 13, color: Colors.primaryMuted, lineHeight: 18 },
  // CTA
  cta:           { alignItems: 'center', gap: 20 },
  primaryBtn:    { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 18, width: '100%', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  primaryBtnText:{ color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },
  loginRow:      { flexDirection: 'row', alignItems: 'center' },
  loginText:     { color: Colors.textMuted, fontSize: 14 },
  loginLink:     { color: Colors.primary, fontSize: 14, fontWeight: '600' },
});
