/**
 * app/index.tsx — Page d'accueil AgroPilot
 */
import { Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { Colors } from '@/constants/Colors';

// ─── Ligne fonctionnalité ──────────────────────────────────────────────────────

function FeatureRow({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <View style={s.featureRow}>
      <View style={s.featureNum}>
        <Text style={s.featureNumText}>{num}</Text>
      </View>
      <View style={s.featureText}>
        <Text style={s.featureTitle}>{title}</Text>
        <Text style={s.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

// ─── Témoignage / proof ────────────────────────────────────────────────────────

function ProofPill({ text }: { text: string }) {
  return (
    <View style={s.proofPill}>
      <Text style={s.proofPillText}>{text}</Text>
    </View>
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={s.root}>
      <Head>
        <title>AgroPilot — Votre copilote financier agricole</title>
        <link rel="icon" type="image/png" href="/favicon.png" />
      </Head>
      <StatusBar barStyle="light-content" backgroundColor={Colors.headerBg} />

      <ScrollView
        contentContainerStyle={[s.container, { paddingBottom: insets.bottom + 56 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ─── HERO ───────────────────────────────────────────────────────── */}
        <View style={[s.hero, { paddingTop: insets.top + 28 }]}>

          {/* Logo */}
          <View style={s.logoRow}>
            <Image
              source={require('@/assets/images/AgroPilot_icon_white.png')}
              style={s.logoIcon}
              resizeMode="contain"
            />
            <View>
              <Text style={s.logoName}>AgroPilot</Text>
              <Text style={s.logoTagline}>PRÉVISION AGRICOLE</Text>
            </View>
          </View>

          {/* Badge */}
          <View style={s.heroBadge}>
            <View style={s.heroBadgeDot} />
            <Text style={s.heroBadgeText}>Copilote financier pour agriculteurs</Text>
          </View>

          {/* Titre */}
          <Text style={s.heroTitle}>
            Prenez les{'\n'}bonnes décisions{'\n'}
            <Text style={s.heroTitleAccent}>avant tout le monde</Text>
          </Text>

          <Text style={s.heroSub}>
            Marchés volatils, charges en hausse, dossiers PAC complexes —
            AgroPilot fait les calculs pour vous et vous alerte quand il faut agir.
          </Text>

          {/* Pills preuve */}
          <View style={s.proofRow}>
            <ProofPill text="Prix céréales en temps réel" />
            <ProofPill text="PAC & aides régionales" />
            <ProofPill text="Météo agricole 7 j" />
          </View>

          {/* CTA */}
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
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={s.statVal}>7 j</Text>
            <Text style={s.statLbl}>de prévisions météo</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.statItem}>
            <Text style={s.statVal}>100%</Text>
            <Text style={s.statLbl}>gratuit</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.statItem}>
            <Text style={s.statVal}>IA</Text>
            <Text style={s.statLbl}>analyse de subventions</Text>
          </View>
        </View>

        {/* ─── PROBLÈME ───────────────────────────────────────────────────── */}
        <View style={s.problemBlock}>
          <Text style={s.eyebrow}>LE PROBLÈME</Text>
          <Text style={s.blockTitle}>Votre exploitation mérite mieux qu'un tableur</Text>
          <Text style={s.blockBody}>
            Entre les prix du blé qui doublent en quelques mois, les charges qui augmentent
            et les dossiers PAC à remplir, prendre les bonnes décisions est devenu un travail
            à plein temps.
          </Text>
          <View style={s.problemHighlight}>
            <Text style={s.problemHighlightText}>
              AgroPilot centralise les données qui comptent et fait le calcul à votre place.
            </Text>
          </View>
        </View>

        {/* ─── FONCTIONNALITÉS ────────────────────────────────────────────── */}
        <View style={s.featuresBlock}>
          <Text style={s.eyebrow}>CE QU'ON FAIT POUR VOUS</Text>
          <Text style={s.blockTitle}>Tout ce dont vous avez besoin, réuni au même endroit</Text>

          <View style={s.featureList}>
            <FeatureRow
              num="01"
              title="Tendances de marché"
              desc="Prix du blé, maïs, colza et soja. Comparez avec vos coûts de production pour vendre au bon moment."
            />
            <View style={s.featureDivider} />
            <FeatureRow
              num="02"
              title="Simulation de rentabilité"
              desc="Calculez votre marge nette par hectare en croisant charges réelles, rendement estimé et prix de marché."
            />
            <View style={s.featureDivider} />
            <FeatureRow
              num="03"
              title="Subventions PAC & régionales"
              desc="L'IA identifie les aides disponibles pour votre exploitation et vérifie votre éligibilité automatiquement."
            />
            <View style={s.featureDivider} />
            <FeatureRow
              num="04"
              title="Météo agricole détaillée"
              desc="ETP, température du sol, gel, conditions phyto — toutes les données utiles pour votre terrain."
            />
          </View>
        </View>

        {/* ─── PROMESSE ───────────────────────────────────────────────────── */}
        <View style={s.promiseBlock}>
          <Text style={s.promiseLabel}>NOTRE PROMESSE</Text>
          <Text style={s.promiseTitle}>Conçu pour les agriculteurs, pas pour les comptables</Text>
          <Text style={s.promiseBody}>
            Pas de jargon inutile. Des chiffres clairs, des alertes au bon moment,
            des recommandations que vous pouvez comprendre sans formation.
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
  root:      { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1 },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: 26,
    paddingBottom: 52,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    gap: 18,
  },

  logoRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  logoIcon:   { width: 42, height: 42, borderRadius: 11 },
  logoName:   { fontSize: 18, fontWeight: '800', color: '#fff' },
  logoTagline:{ fontSize: 9, color: Colors.headerTextMuted, letterSpacing: 2.5, marginTop: 1 },

  heroBadge:     { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  heroBadgeDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7EC854' },
  heroBadgeText: { fontSize: 12, color: Colors.headerTextMuted, fontWeight: '600', letterSpacing: 0.3 },

  heroTitle:       { fontSize: 34, fontWeight: '900', color: '#fff', lineHeight: 40 },
  heroTitleAccent: { color: '#A8D96A' },
  heroSub:         { fontSize: 15, color: Colors.headerTextMuted, lineHeight: 23, marginTop: -4 },

  proofRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -4 },
  proofPill:{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  proofPillText:{ fontSize: 11, color: 'rgba(255,255,255,0.80)', fontWeight: '600' },

  btnPrimary:     { backgroundColor: '#A8D96A', borderRadius: 14, paddingVertical: 17, alignItems: 'center', marginTop: 4 },
  btnPrimaryText: { fontSize: 16, fontWeight: '800', color: '#1A3A0F' },
  btnSecondary:   { paddingVertical: 8, alignItems: 'center' },
  btnSecondaryText: { fontSize: 15, color: 'rgba(255,255,255,0.60)', fontWeight: '500' },

  // ── Stats ─────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    marginHorizontal: 22,
    marginTop: -22,
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  statItem:  { flex: 1, alignItems: 'center', gap: 3 },
  statVal:   { fontSize: 22, fontWeight: '900', color: Colors.primaryDark },
  statLbl:   { fontSize: 11, color: Colors.textMuted, textAlign: 'center', lineHeight: 15 },
  statDiv:   { width: 1, height: 38, backgroundColor: Colors.border, alignSelf: 'center' },

  // ── Blocks ────────────────────────────────────────────────────────────────
  eyebrow:   { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 2.5, textTransform: 'uppercase' },
  blockTitle:{ fontSize: 22, fontWeight: '800', color: Colors.primaryDark, lineHeight: 28, marginTop: 6 },
  blockBody: { fontSize: 15, color: Colors.textMuted, lineHeight: 23 },

  problemBlock: {
    marginHorizontal: 22,
    marginTop: 40,
    gap: 12,
  },
  problemHighlight: {
    backgroundColor: Colors.primaryBg,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    marginTop: 4,
  },
  problemHighlightText: { fontSize: 15, fontWeight: '600', color: Colors.primaryDark, lineHeight: 22 },

  // ── Features ──────────────────────────────────────────────────────────────
  featuresBlock: {
    marginHorizontal: 22,
    marginTop: 40,
    gap: 12,
  },
  featureList: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginTop: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  featureRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingVertical: 20 },
  featureNum:     { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  featureNumText: { fontSize: 11, fontWeight: '800', color: Colors.primary, letterSpacing: 0.5 },
  featureText:    { flex: 1, gap: 4 },
  featureTitle:   { fontSize: 15, fontWeight: '700', color: Colors.primaryDark },
  featureDesc:    { fontSize: 13, color: Colors.textMuted, lineHeight: 20 },
  featureDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 48 },

  // ── Promise ───────────────────────────────────────────────────────────────
  promiseBlock: {
    marginHorizontal: 22,
    marginTop: 36,
    backgroundColor: Colors.headerBg,
    borderRadius: 20,
    padding: 26,
    gap: 10,
  },
  promiseLabel: { fontSize: 10, fontWeight: '700', color: '#A8D96A', letterSpacing: 2.5, textTransform: 'uppercase' },
  promiseTitle: { fontSize: 20, fontWeight: '800', color: '#fff', lineHeight: 26 },
  promiseBody:  { fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 21 },

  // ── CTA bas ───────────────────────────────────────────────────────────────
  bottomCta:  { paddingHorizontal: 22, paddingTop: 36, gap: 12 },
  btnFull:    { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  btnFullText:{ fontSize: 16, fontWeight: '800', color: '#fff' },
  bottomNote: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
});
