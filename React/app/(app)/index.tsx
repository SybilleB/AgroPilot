/**
 * app/(app)/index.tsx — Tableau de bord principal AgroPilot
 */
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useProfile } from '@/hooks/useProfile';
import { Colors } from '@/constants/Colors';

// ─── Composant Widget Météo Interactif ────────────────────────────────────────

function MeteoWidget({ commune, condition, temp, onPress }: { commune?: string, condition: string, temp: string, onPress: () => void }) {

  const getMeteoStyle = () => {
    // On passe tout en minuscule pour être sûr de matcher les mots-clés
    const cond = condition.toLowerCase();

    if (cond.includes("nuage") || cond.includes("couvert")) {
      return { icon: "☁️", advice: "Ciel couvert : idéal pour l'entretien du matériel." };
    }
    if (cond.includes("pluie") || cond.includes("averse")) {
      return { icon: "🌧️", advice: "Risque de lessivage : différez l'épandage." };
    }
    if (cond.includes("vent")) {
      return { icon: "💨", advice: "Vent fort : attention à la dérive des produits." };
    }
    if (cond.includes("orage") || cond.includes("grêle")) {
      return { icon: "⛈️", advice: "Alerte orage : surveillez vos parcelles." };
    }

    // Valeur par défaut si rien ne correspond (Soleil)
    return { icon: "☀️", advice: "Aucune intempérie à venir : conditions optimales." };
  };

  const { icon, advice } = getMeteoStyle();

  return (
    <TouchableOpacity style={s.meteoWidget} onPress={onPress} activeOpacity={0.9}>
      <View style={s.meteoMain}>
        <View>
          <Text style={s.meteoCity}>{commune || "Ma ferme"}</Text>
          <Text style={s.meteoTemp}>{temp}</Text>
        </View>
        <Text style={s.meteoBigIcon}>{icon}</Text>
      </View>
      <View style={s.meteoDivider} />
      <View style={s.meteoAdviceRow}>
        <Text style={s.aiLabelMeteo}>CONSEIL IA</Text>
        <Text style={s.meteoAdviceText}>{advice}</Text>
      </View>
    </TouchableOpacity>
  );
}

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

// ─── Écran Principal ──────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { fullProfile, isComplete, loading } = useProfile();

  const prenom = fullProfile?.profile?.prenom;
  const exploitation = fullProfile?.exploitation;

  const now = new Date();
  const hour = now.getHours();
  const salut = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.container, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 24 }]}>
        <View style={s.headerTop}>
          <View style={s.logoRow}>
            <View style={s.logoSquare}>
              <Text style={s.logoLetter}>A</Text>
            </View>
            <View>
              <Text style={s.logoName}>AgroPilot</Text>
              <Text style={s.logoTagline}>PRÉVISION AGRICOLE</Text>
            </View>
          </View>
          <View style={s.greetingBox}>
            <Text style={s.greeting}>{salut}{prenom ? `, ${prenom}` : ''}</Text>
            <Text style={s.greetingSub}>{exploitation?.commune || "Votre exploitation"}</Text>
          </View>
        </View>

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

      {/* ─── WIDGET MÉTÉO ───────────────────────────────────────────────── */}
      <MeteoWidget
        commune={exploitation?.commune}
        condition="Nuageux" // <--- TEST : Remplace par "Pluie" ou "Orage" pour voir l'emoji changer !
        temp="14°C"        // <--- Tu peux aussi changer la température ici
        onPress={() => router.push('/(app)/meteo')}
      />

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
                Nécessaire pour l'analyse IA des subventions et calculs de marges.
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
        title="Simulation de rentabilité"
        desc="Calculez votre marge nette par hectare"
        badge="Nouveau"
        onPress={() => router.push('/(app)/rentabilite')}
      />

      <NavCard
        icon="🌦️"
        title="Météo de l'exploitation"
        desc="Radar et prévisions agricoles à 7 jours"
        onPress={() => router.push('/(app)/meteo')}
      />

      <NavCard
        icon="💶"
        title="Subventions disponibles"
        desc="PAC et aides régionales filtrées pour vous"
        onPress={() => router.push('/(app)/subventions')}
      />

      {/* ─── BLOC "ANALYSE IA" ───────────────────────────────────────────── */}
      <View style={s.aiCard}>
        <Text style={s.aiLabel}>ANALYSE IA</Text>
        <Text style={s.aiTitle}>Votre copilote financier est prêt</Text>
        <Text style={s.aiBody}>
          {isComplete
            ? `Votre profil est complet. L'IA peut désormais analyser vos subventions en temps réel.`
            : `Complétez votre profil pour débloquer l'analyse complète de vos subventions.`
          }
        </Text>
        {!isComplete && (
          <TouchableOpacity style={s.aiBtn} onPress={() => router.push('/profile-setup')}>
            <Text style={s.aiBtnText}>Configurer mon exploitation</Text>
          </TouchableOpacity>
        )}
      </View>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { paddingHorizontal: 0 },

  header: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: 22,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    gap: 20,
    marginBottom: 22,
  },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoSquare: { width: 38, height: 38, borderRadius: 11, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontSize: 20, fontWeight: '900', color: '#fff' },
  logoName: { fontSize: 16, fontWeight: '800', color: '#fff' },
  logoTagline: { fontSize: 8, color: Colors.headerTextMuted, letterSpacing: 2, marginTop: 1 },

  greetingBox: { alignItems: 'flex-end' },
  greeting: { fontSize: 15, fontWeight: '700', color: '#fff' },
  greetingSub: { fontSize: 12, color: Colors.headerTextMuted, marginTop: 2 },

  metricsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12 },
  metricBox: { flex: 1, alignItems: 'center' },
  metricValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  metricLabel: { fontSize: 11, color: Colors.headerTextMuted, marginTop: 2 },
  metricDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center' },

  // Styles Widget Météo
  meteoWidget: {
    marginHorizontal: 22,
    marginBottom: 25,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  meteoMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meteoCity: { fontSize: 14, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase' },
  meteoTemp: { fontSize: 38, fontWeight: '800', color: Colors.primaryDark },
  meteoBigIcon: { fontSize: 45 },
  meteoDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 15, opacity: 0.5 },
  meteoAdviceRow: { gap: 4 },
  aiLabelMeteo: { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 1.5 },
  meteoAdviceText: { fontSize: 13, color: Colors.primaryDark, fontWeight: '600', lineHeight: 18 },

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
  bannerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
  bannerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.warning, marginTop: 5 },
  bannerTitle: { fontSize: 14, fontWeight: '700', color: '#5D3000', marginBottom: 3 },
  bannerDesc: { fontSize: 12, color: '#7A4500', lineHeight: 17 },
  bannerArrow: { fontSize: 22, color: Colors.warning, fontWeight: '700', paddingLeft: 8 },

  sectionLabel: {
    marginHorizontal: 22,
    marginBottom: 12,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

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
    elevation: 2,
  },
  navCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  navIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  navIcon: { fontSize: 22 },
  navCardText: { flex: 1, gap: 3 },
  navCardTitle: { fontSize: 15, fontWeight: '700', color: Colors.primaryDark },
  navCardDesc: { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  navCardArrow: { alignItems: 'center', gap: 6 },
  arrowText: { fontSize: 22, color: Colors.textMuted, fontWeight: '300' },
  badgePill: { backgroundColor: Colors.primaryBg, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  badgePillText: { fontSize: 10, fontWeight: '700', color: Colors.primary },

  aiCard: {
    marginHorizontal: 22,
    marginTop: 10,
    marginBottom: 20,
    backgroundColor: Colors.aiCardBg,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.aiCardBorder,
    padding: 20,
    gap: 8,
  },
  aiLabel: { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase' },
  aiTitle: { fontSize: 17, fontWeight: '800', color: Colors.primaryDark },
  aiBody: { fontSize: 13, color: Colors.textMuted, lineHeight: 20 },
  aiBtn: { marginTop: 4, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  aiBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});