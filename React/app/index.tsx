/**
 * app/index.tsx — Page d'accueil AgroPilot
 * Présentation claire de l'application et de sa valeur pour l'agriculteur.
 * Guard de navigation : géré par _layout.tsx (pas de redirect ici).
 */
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/layout';

// ─── Carte fonctionnalité ─────────────────────────────────────────────────────

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <View style={s.featureCard}>
      <View style={s.featureIconBox}>
        <Text style={s.featureIconEmoji}>{icon}</Text>
      </View>
      <Text style={s.featureTitle}>{title}</Text>
      <Text style={s.featureDesc}>{desc}</Text>
    </View>
  );
}

// ─── Chiffre clé ─────────────────────────────────────────────────────────────

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.headerBg} />

      <ScrollView
        contentContainerStyle={[s.container, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ─── HERO ───────────────────────────────────────────────────────── */}
        <View style={[s.hero, { paddingTop: insets.top + 36 }]}>
          {/* Logo — remplacer par <Image source={require('@/assets/images/logo-light.png')} /> */}
          <View style={s.logoRow}>
            <View style={s.logoSquare}>
              <Text style={s.logoLetter}>A</Text>
            </View>
            <View>
              <Text style={s.logoName}>AgroPilot</Text>
              <Text style={s.logoTagline}>PRÉVISION AGRICOLE</Text>
            </View>
          </View>

          <Text style={s.heroTitle}>
            Gérez votre exploitation{'\n'}avec un coup d'avance
          </Text>
          <Text style={s.heroSub}>
            Volatilité des marchés, explosion des coûts, dossiers d'aides
            complexes — AgroPilot vous aide à voir clair et à décider au bon moment.
          </Text>

          <TouchableOpacity
            style={s.btnPrimary}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.88}
          >
            <Text style={s.btnPrimaryText}>Commencer gratuitement</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.btnSecondary}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.88}
          >
            <Text style={s.btnSecondaryText}>J'ai déjà un compte →</Text>
          </TouchableOpacity>
        </View>

        {/* ─── STATS ──────────────────────────────────────────────────────── */}
        <View style={s.statsCard}>
          <StatBox value="7 j" label="Prévisions météo" />
          <View style={s.statDivider} />
          <StatBox value="PAC" label="Aides EU incluses" />
          <View style={s.statDivider} />
          <StatBox value="100%" label="Gratuit" />
        </View>

        {/* ─── PROBLÈME ───────────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionEyebrow}>POUR QUOI FAIRE ?</Text>
          <Text style={s.sectionTitle}>Votre exploitation mérite mieux qu'un tableur</Text>
          <Text style={s.sectionBody}>
            Entre les prix du blé qui varient du simple au double en quelques mois,
            les charges qui augmentent et les dossiers PAC à remplir, prendre les
            bonnes décisions est devenu un travail à plein temps.{'\n\n'}
            AgroPilot centralise les données qui comptent et fait le calcul à votre place.
          </Text>
        </View>

        {/* ─── FONCTIONNALITÉS ────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionEyebrow}>CE QU'ON FAIT POUR VOUS</Text>

          <FeatureCard
            icon="📈"
            title="Tendances de marché"
            desc="Suivez les prix du blé, maïs, colza et soja. Comparez avec vos coûts de production pour vendre au bon moment."
          />
          <FeatureCard
            icon="🧮"
            title="Simulation de rentabilité"
            desc="Avant de semer, calculez votre marge nette par hectare en croisant charges réelles, rendement estimé et prix de marché."
          />
          <FeatureCard
            icon="💶"
            title="Subventions PAC & régionales"
            desc="L'IA identifie les aides disponibles pour votre exploitation et vous dit si vous êtes éligible, sans que vous ayez à chercher."
          />
          <FeatureCard
            icon="🌦️"
            title="Météo agricole détaillée"
            desc="ETP, température du sol, risque de gel, conditions de traitement phytosanitaire — toutes les données utiles sur le terrain."
          />
        </View>

        {/* ─── PROMESSE ───────────────────────────────────────────────────── */}
        <View style={s.promiseBlock}>
          <Text style={s.promiseTitle}>Conçu pour les agriculteurs,{'\n'}pas pour les comptables</Text>
          <Text style={s.promiseBody}>
            Pas de jargon financier inutile. Des chiffres clairs, des alertes au bon
            moment, et des recommandations que vous pouvez comprendre sans être expert.
          </Text>
        </View>

        {/* ─── CTA BAS ────────────────────────────────────────────────────── */}
        <View style={s.bottomCta}>
          <TouchableOpacity
            style={s.btnFull}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.88}
          >
            <Text style={s.btnFullText}>Créer mon compte gratuitement</Text>
          </TouchableOpacity>
          <Text style={s.bottomNote}>Sans carte bancaire · Sans engagement</Text>
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1 },

  // Hero
  hero: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: Layout.headerRadius,
    borderBottomRightRadius: Layout.headerRadius,
    gap: 16,
  },

  // Logo
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  logoSquare: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontSize: 24, fontWeight: '900', color: '#fff' },
  logoName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  logoTagline: { fontSize: 9, color: Colors.headerTextMuted, letterSpacing: 2.5, marginTop: 1 },

  // Hero textes
  heroTitle: { fontSize: 28, fontWeight: '900', color: '#fff', lineHeight: 35, marginTop: 4 },
  heroSub: { fontSize: 15, color: Colors.headerTextMuted, lineHeight: 23 },

  // Boutons hero
  btnPrimary: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 17, alignItems: 'center', marginTop: 4 },
  btnPrimaryText: { fontSize: 16, fontWeight: '800', color: Colors.primaryDark },
  btnSecondary: { paddingVertical: 10, alignItems: 'center' },
  btnSecondaryText: { fontSize: 15, color: Colors.headerTextMuted, fontWeight: '600' },

  // Stats card
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    marginTop: -20,
    borderRadius: Layout.cardRadius,
    paddingVertical: 18,
    paddingHorizontal: 14,
    ...Layout.cardShadow,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '900', color: Colors.primaryDark },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },
  statDivider: { width: 1, height: 34, backgroundColor: Colors.border },

  // Sections
  section: { paddingHorizontal: 22, paddingTop: 38, gap: 14 },
  sectionEyebrow: { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 23, fontWeight: '800', color: Colors.primaryDark, lineHeight: 29, marginTop: -2 },
  sectionBody: { fontSize: 15, color: Colors.textMuted, lineHeight: 23 },

  // Feature cards
  featureCard: {
    backgroundColor: Colors.white,
    borderRadius: Layout.cardRadius,
    padding: 20,
    gap: 8,
    ...Layout.softShadow,
  },
  featureIconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  featureIconEmoji: { fontSize: 22 },
  featureTitle: { fontSize: 16, fontWeight: '700', color: Colors.primaryDark },
  featureDesc: { fontSize: 14, color: Colors.textMuted, lineHeight: 21 },

  // Promise block
  promiseBlock: {
    marginHorizontal: 22,
    marginTop: 36,
    backgroundColor: Colors.aiCardBg,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.aiCardBorder,
    padding: 22,
    gap: 10,
  },
  promiseTitle: { fontSize: 19, fontWeight: '800', color: Colors.primaryDark, lineHeight: 25 },
  promiseBody: { fontSize: 14, color: Colors.textMuted, lineHeight: 21 },

  // Bottom CTA
  bottomCta: { paddingHorizontal: 22, paddingTop: 40, gap: 12 },
  btnFull: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  btnFullText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  bottomNote: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
});
