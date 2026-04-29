/**
 * app/(app)/index.tsx — Tableau de bord principal
 */
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Head from 'expo-router/head';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useProfile } from '@/hooks/useProfile';
import { Colors } from '@/constants/Colors';

// ─── Carte de navigation ──────────────────────────────────────────────────────

function NavCard({
  icon, title, desc, badge, onPress,
}: {
  icon: string; title: string; desc: string; badge?: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.navCard} onPress={onPress} activeOpacity={0.85}>
      <View style={s.navCardLeft}>
        <View style={s.navIconBox}>
          <Text style={s.navIcon}>{icon}</Text>
        </View>
        <View style={s.navCardText}>
          <Text style={s.navCardTitle}>{title}</Text>
          <Text style={s.navCardDesc}>{desc}</Text>
        </View>
      </View>
      <View style={s.navCardArrow}>
        {badge ? <View style={s.badgePill}><Text style={s.badgePillText}>{badge}</Text></View> : null}
        <Text style={s.arrowText}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { fullProfile, isComplete, loading } = useProfile();

  const prenom = fullProfile?.profile?.prenom;
  const exploitation = fullProfile?.exploitation;

  const now    = new Date();
  const hour   = now.getHours();
  const salut  = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  if (loading) {
    return (
      <View style={s.loadScreen}>
        <View style={[s.header, { paddingTop: insets.top + 24, paddingHorizontal: 22, paddingBottom: 32 }]}>
          <View style={s.headerTop}>
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
          </View>
        </View>
        <View style={s.loadCenter}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={s.loadText}>Chargement de votre exploitation…</Text>
        </View>
      </View>
    );
  }

  return (
    <>
    <Head><title>Accueil — AgroPilot</title></Head>
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.container, { paddingBottom: 32 }]}
      showsVerticalScrollIndicator={false}
    >

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 24 }]}>

        {/* Logo + salutation */}
        <View style={s.headerTop}>
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
          <View style={s.greetingBox}>
            <Text style={s.greeting}>{salut}{prenom ? `, ${prenom}` : ''}</Text>
            {exploitation?.commune
              ? <Text style={s.greetingSub}>{exploitation.commune}</Text>
              : <Text style={s.greetingSub}>Votre exploitation</Text>
            }
          </View>
        </View>

        {/* Métriques rapides */}
        <View style={s.metricsRow}>
          <View style={s.metricBox}>
            <Text style={s.metricValue}>{exploitation?.surface_ha ?? '—'}</Text>
            <Text style={s.metricLabel}>ha exploités</Text>
          </View>
          <View style={s.metricDivider} />
          <View style={s.metricBox}>
            <Text style={s.metricValue}>{fullProfile?.cultures?.length ?? '—'}</Text>
            <Text style={s.metricLabel}>cultures</Text>
          </View>
          <View style={s.metricDivider} />
          <View style={s.metricBox}>
            <Text style={s.metricValue}>{exploitation?.type_exploitation ? 'Actif' : '—'}</Text>
            <Text style={s.metricLabel}>statut</Text>
          </View>
        </View>
      </View>

      {/* ─── BANNIÈRE PROFIL INCOMPLET ───────────────────────────────────── */}
      {!loading && !isComplete && (
        <TouchableOpacity
          style={s.banner}
          onPress={() => router.push('/profile-setup')}
          activeOpacity={0.88}
        >
          <View style={s.bannerLeft}>
            <View style={s.bannerDot} />
            <View style={{ flex: 1 }}>
              <Text style={s.bannerTitle}>Complétez votre profil</Text>
              <Text style={s.bannerDesc}>
                Pour que l'IA trouve les subventions qui vous correspondent, on a besoin de quelques infos sur votre exploitation.
              </Text>
            </View>
          </View>
          <Text style={s.bannerArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* ─── SECTION "VOS OUTILS" ────────────────────────────────────────── */}
      <Text style={s.sectionLabel}>VOS OUTILS</Text>

      <NavCard
        icon="📈"
        title="Marchés & Rentabilité"
        desc="Prix MATIF en temps réel + simulateur de marge par culture"
        onPress={() => router.push('/(app)/marche')}
      />

      <NavCard
        icon="🌦️"
        title="Météo de l'exploitation"
        desc="Conditions en temps réel, radar et prévisions 7 jours"
        onPress={() => router.push('/(app)/meteo')}
      />

      {/* ─── SECTION "SUBVENTIONS" (distincte) ─────────────────────────── */}
      <Text style={[s.sectionLabel, { marginTop: 10 }]}>SUBVENTIONS & AIDES</Text>

      <TouchableOpacity
        style={s.subvCard}
        onPress={() => router.push('/(app)/subventions')}
        activeOpacity={0.85}
      >
        <View style={s.subvLeft}>
          <View style={s.subvIconBox}>
            <Text style={s.subvIcon}>💶</Text>
          </View>
          <View style={s.subvText}>
            <Text style={s.subvTitle}>Trouver mes subventions</Text>
            <Text style={s.subvDesc}>
              L'IA analyse votre profil et identifie toutes les aides auxquelles vous avez droit — PAC, aides régionales, certifications.
            </Text>
          </View>
        </View>
        <Text style={s.subvArrow}>›</Text>
      </TouchableOpacity>

      {/* ─── BLOC "ANALYSE IA" ───────────────────────────────────────────── */}
      <View style={s.aiCard}>
        <Text style={s.aiLabel}>ANALYSE IA</Text>
        <Text style={s.aiTitle}>Votre copilote financier est prêt</Text>
        <Text style={s.aiBody}>
          {isComplete
            ? `Votre profil est complet. L'IA peut désormais analyser vos subventions et simuler vos marges en tenant compte de votre exploitation.`
            : `Complétez votre profil pour débloquer l'analyse complète de vos subventions et simuler vos marges avec précision.`
          }
        </Text>
        {!isComplete && (
          <TouchableOpacity style={s.aiBtn} onPress={() => router.push('/profile-setup')}>
            <Text style={s.aiBtnText}>Configurer mon exploitation</Text>
          </TouchableOpacity>
        )}
      </View>

    </ScrollView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.background },
  container: { paddingHorizontal: 0 },
  loadScreen:{ flex: 1, backgroundColor: Colors.background },
  loadCenter:{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadText:  { fontSize: 14, color: Colors.textMuted },

  // Header
  header: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: 22,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    gap: 20,
    marginBottom: 22,
  },
  headerTop:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  logoRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon:    { width: 38, height: 38, borderRadius: 10 },
  logoName:    { fontSize: 16, fontWeight: '800', color: '#fff' },
  logoTagline: { fontSize: 8, color: Colors.headerTextMuted, letterSpacing: 2, marginTop: 1 },

  greetingBox: { alignItems: 'flex-end' },
  greeting:    { fontSize: 15, fontWeight: '700', color: '#fff' },
  greetingSub: { fontSize: 12, color: Colors.headerTextMuted, marginTop: 2 },

  // Métriques
  metricsRow:    { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12 },
  metricBox:     { flex: 1, alignItems: 'center' },
  metricValue:   { fontSize: 20, fontWeight: '800', color: '#fff' },
  metricLabel:   { fontSize: 11, color: Colors.headerTextMuted, marginTop: 2 },
  metricDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center' },

  // Bannière
  banner: {
    marginHorizontal: 22,
    marginBottom: 20,
    backgroundColor: Colors.warningBg,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F0D080',
  },
  bannerLeft:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
  bannerDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.warning, marginTop: 5 },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: '#5D3000', marginBottom: 3 },
  bannerDesc:  { fontSize: 12, color: '#7A4500', lineHeight: 17 },
  bannerArrow: { fontSize: 22, color: Colors.warning, fontWeight: '700', paddingLeft: 8 },

  // Section
  sectionLabel: {
    marginHorizontal: 22,
    marginBottom: 12,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Nav cards
  navCard: {
    marginHorizontal: 22,
    marginBottom: 10,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  navCardLeft:  { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  navIconBox:   { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  navIcon:      { fontSize: 22 },
  navCardText:  { flex: 1, gap: 3 },
  navCardTitle: { fontSize: 15, fontWeight: '700', color: Colors.primaryDark },
  navCardDesc:  { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  navCardArrow: { alignItems: 'center', gap: 6 },
  arrowText:    { fontSize: 22, color: Colors.textMuted, fontWeight: '300' },
  badgePill:    { backgroundColor: Colors.primaryBg, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  badgePillText:{ fontSize: 10, fontWeight: '700', color: Colors.primary },

  // Carte subventions (distincte)
  subvCard: {
    marginHorizontal: 22,
    marginBottom: 10,
    backgroundColor: '#1A3A0F',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  subvLeft:    { flexDirection: 'row', alignItems: 'flex-start', gap: 14, flex: 1 },
  subvIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  subvIcon:    { fontSize: 22 },
  subvText:    { flex: 1, gap: 4 },
  subvTitle:   { fontSize: 15, fontWeight: '800', color: '#fff' },
  subvDesc:    { fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 17 },
  subvArrow:   { fontSize: 26, color: 'rgba(255,255,255,0.5)', fontWeight: '300', paddingLeft: 8 },

  // Bloc IA
  aiCard: {
    marginHorizontal: 22,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: Colors.aiCardBg,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.aiCardBorder,
    padding: 20,
    gap: 8,
  },
  aiLabel: { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase' },
  aiTitle: { fontSize: 17, fontWeight: '800', color: Colors.primaryDark },
  aiBody:  { fontSize: 13, color: Colors.textMuted, lineHeight: 20 },
  aiBtn:   { marginTop: 4, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  aiBtnText:{ color: '#fff', fontSize: 14, fontWeight: '700' },
});
