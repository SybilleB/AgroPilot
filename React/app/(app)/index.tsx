/**
 * app/(app)/index.tsx — Tableau de bord AgroPilot
 */
import React, { useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfile } from '@/hooks/useProfile';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/layout';

// ─── Composant Widget Météo ───────────────────────────────────

function MeteoWidget({ commune, condition, temp, onPress }: { commune?: string, condition: string, temp: string, onPress: () => void }) {
  const getMeteoStyle = () => {
    const cond = condition.toLowerCase();
    if (cond.includes("nuage") || cond.includes("couvert"))
      return { icon: "☁️", advice: "Ciel couvert : idéal pour l'entretien du matériel." };
    if (cond.includes("pluie") || cond.includes("averse"))
      return { icon: "🌧️", advice: "Risque de lessivage : différez l'épandage." };
    if (cond.includes("vent"))
      return { icon: "💨", advice: "Vent fort : attention à la dérive des produits." };
    if (cond.includes("orage") || cond.includes("grêle"))
      return { icon: "⛈️", advice: "Alerte orage : mettez le matériel à l'abri." };

    return { icon: "☀️", advice: "Conditions optimales pour les travaux de sol." };
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

// ─── Composant Widget Subvention ──────────────────────────────

function SubventionWidget({ card, loading, onPress }: { card: any, loading: boolean, onPress: () => void }) {
  if (loading) {
    return <View style={s.meteoWidget}><ActivityIndicator color={Colors.primary} /></View>;
  }

  if (!card) {
    return (
      <TouchableOpacity style={s.meteoWidget} onPress={onPress} activeOpacity={0.9}>
        <View style={s.subHeader}>
          <Text style={s.aiLabelMeteo}>SUBVENTIONS DISPONIBLES</Text>
          <View style={s.badgePill}><Text style={s.badgePillText}>0 aide</Text></View>
        </View>
        <Text style={s.subAmountText}>0 € <Text style={s.subLabelSmall}>potentiel total</Text></Text>
        <View style={s.meteoDivider} />
        <View style={s.subFooter}>
          <Text style={[s.meteoAdviceText, { color: Colors.primary }]}>Lancer l'analyse IA du profil</Text>
          <Text style={s.subArrow}>→</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[s.meteoWidget, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 1 }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={s.subHeader}>
        <Text style={s.aiLabelMeteo}>TOP ÉLIGIBILITÉ</Text>
        <Text style={s.subScore}>⭐ {card.score}/5</Text>
      </View>
      <Text style={s.subTitleText}>{card.nom}</Text>
      <Text style={s.subAmountText}>{card.montant_label}</Text>
      <View style={s.meteoDivider} />
      <View style={s.subFooter}>
        <Text style={s.meteoAdviceText}>Voir les détails et démarches</Text>
        <Text style={s.subArrow}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Carte de navigation ──────────────────────────────────────

function NavCard({ icon, title, desc, badge, onPress }: any) {
  return (
    <TouchableOpacity style={s.navCard} onPress={onPress} activeOpacity={0.85}>
      <View style={s.navCardLeft}>
        <View style={s.navIconBox}><Text style={s.navIcon}>{icon}</Text></View>
        <View style={s.navCardText}>
          <Text style={s.navCardTitle}>{title}</Text>
          <Text style={s.navCardDesc}>{desc}</Text>
        </View>
      </View>
      <View style={s.navCardArrow}>
        {badge && <View style={s.badgePill}><Text style={s.badgePillText}>{badge}</Text></View>}
        <Text style={s.arrowText}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Écran Principal ──────────────────────────────────────────

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { fullProfile } = useProfile();

  const [topSub, setTopSub] = useState<any>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [meteo, setMeteo] = useState({ temp: "--°C", condition: "Chargement..." });

  useFocusEffect(
    useCallback(() => {
      const loadFreshData = async () => {
        try {
          const meteoCache = await AsyncStorage.getItem('agropilot_meteo_cache');
          if (meteoCache) setMeteo(JSON.parse(meteoCache));

          const subData = await AsyncStorage.getItem('agropilot_subventions_cache');
          if (subData) {
            const subs = JSON.parse(subData);
            const best = subs.sort((a: any, b: any) => b.score - a.score)[0];
            setTopSub(best);
          }
        } catch (e) { console.error(e); } finally { setSubLoading(false); }
      };
      loadFreshData();
    }, [])
  );

  const exploitation = fullProfile?.exploitation;
  const salut = new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir';

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>

      {/* HEADER VERT FONCÉ */}
      <View style={[s.header, { paddingTop: insets.top + 24 }]}>
        <View style={s.headerTop}>
          <View style={s.logoRow}>
            <View style={s.logoSquare}><Text style={s.logoLetter}>A</Text></View>
            <View>
              <Text style={s.logoName}>AgroPilot</Text>
              <Text style={s.logoTagline}>PRÉVISION AGRICOLE</Text>
            </View>
          </View>
          <View style={s.greetingBox}>
            <Text style={s.greeting}>{salut}{fullProfile?.profile?.prenom ? `, ${fullProfile.profile.prenom}` : ''}</Text>
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
        </View>
      </View>

      <MeteoWidget
        commune={exploitation?.commune}
        condition={meteo.condition}
        temp={meteo.temp}
        onPress={() => router.push('/(app)/meteo')}
      />

      <SubventionWidget card={topSub} loading={subLoading} onPress={() => router.push('/(app)/subventions')} />

      <Text style={s.sectionLabel}>VOS OUTILS</Text>
      <NavCard icon="📈" title="Simulation de rentabilité" desc="Calculez votre marge nette par hectare" onPress={() => router.push('/(app)/rentabilite')} />
      <NavCard icon="💶" title="Toutes les subventions" desc="Catalogue complet PAC et aides régionales" onPress={() => router.push('/(app)/subventions')} />

    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAF8' }, // Fond gris-vert très clair
  header: {
    backgroundColor: '#39811c', // VERT FONCÉ D'ORIGINE
    paddingHorizontal: 22,
    paddingBottom: 32,
    borderBottomLeftRadius: Layout.headerRadius,
    borderBottomRightRadius: Layout.headerRadius,
    marginBottom: 22,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoSquare: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#2E5A1C', alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontSize: 20, fontWeight: '900', color: '#fff' },
  logoName: { fontSize: 16, fontWeight: '800', color: '#fff' },
  logoTagline: { fontSize: 8, color: 'rgba(255,255,255,0.6)', letterSpacing: 2 },
  greetingBox: { alignItems: 'flex-end' },
  greeting: { fontSize: 15, fontWeight: '700', color: '#fff' },
  greetingSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  metricsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 14 },
  metricBox: { flex: 1, alignItems: 'center' },
  metricValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  metricLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  metricDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center' },

  meteoWidget: {
    marginHorizontal: 22,
    marginBottom: 20,
    backgroundColor: '#FFF',
    borderRadius: Layout.cardRadius,
    padding: 20,
    ...Layout.cardShadow,
  },
  meteoMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meteoCity: { fontSize: 14, fontWeight: '600', color: '#666', textTransform: 'uppercase' },
  meteoTemp: { fontSize: 38, fontWeight: '800', color: '#39811c' },
  meteoBigIcon: { fontSize: 45 },
  meteoDivider: { height: 1, backgroundColor: '#EEE', marginVertical: 15 },
  meteoAdviceRow: { gap: 4 },
  aiLabelMeteo: { fontSize: 10, fontWeight: '700', color: '#2E5A1C', letterSpacing: 1.5 },
  meteoAdviceText: { fontSize: 13, color: '#39811c', fontWeight: '600' },

  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  subScore: { fontSize: 12, fontWeight: '700', color: '#39811c' },
  subTitleText: { fontSize: 16, fontWeight: '700', color: '#39811c' },
  subAmountText: { fontSize: 24, fontWeight: '800', color: '#39811c', marginTop: 4 },
  subLabelSmall: { fontSize: 12, color: '#666' },
  subFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subArrow: { fontSize: 18, color: '#39811c', fontWeight: '700' },

  sectionLabel: { marginHorizontal: 22, marginBottom: 12, fontSize: 11, fontWeight: '700', color: '#2E5A1C', letterSpacing: 2 },
  navCard: { marginHorizontal: 22, marginBottom: 10, backgroundColor: '#fff', borderRadius: Layout.cardRadius, padding: 18, flexDirection: 'row', alignItems: 'center', ...Layout.softShadow },
  navCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 14 },
  navIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' },
  navIcon: { fontSize: 22 },
  navCardText: { flex: 1 },
  navCardTitle: { fontSize: 15, fontWeight: '700', color: '#1A3A0F' },
  navCardDesc: { fontSize: 12, color: '#666' },
  navCardArrow: { alignItems: 'center', gap: 6 },
  arrowText: { fontSize: 22, color: '#CCC' },
  badgePill: { backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  badgePillText: { fontSize: 10, fontWeight: '700', color: '#2E5A1C' },
});