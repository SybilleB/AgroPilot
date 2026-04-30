/**
 * app/(app)/marche.tsx — Marchés & Simulateur de rentabilité
 *
 * Deux onglets :
 *  → Marchés   : prix MATIF, analyse IA, actualités, recherche libre
 *  → Simulateur: Top 3 cultures + conseil agronome personnalisé
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Keyboard, Linking, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Head from 'expo-router/head';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '@/hooks/useProfile';
import {
  fetchMarcheAnalyse, fetchMarcheRecherche, fetchPrixLive,
  MarcheAnalyse, RechercheResultat, Recommandation, Actualite, PrixCulture,
  PrixLiveItem, PrixLiveResponse,
} from '@/services/marche.service';
import {
  fetchRecommandations, fetchConseil,
  RecommandationCulture, ConseilAgricole, RequeteTop3,
} from '@/services/rentabilite.service';
import { geocodeCommune } from '@/services/meteo.service';
import { PillSelect } from '@/components/ui/PillSelect';
import { Colors } from '@/constants/Colors';

const CACHE_MARCHE       = 'agropilot_marche_cache';
const CACHE_RENTABILITE  = 'agropilot_rentabilite_cache';
const CACHE_TTL          = 24 * 60 * 60 * 1000;

const SOLS = [
  { value: 'argileux', label: 'Argileux' },
  { value: 'limoneux', label: 'Limoneux' },
  { value: 'sableux',  label: 'Sableux'  },
];

type PageTab = 'marche' | 'simulateur';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEuros(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}
function meteoColor(s: string) {
  if (s === 'Favorable')   return { text: Colors.success, bg: Colors.successBg };
  if (s === 'Défavorable') return { text: Colors.error,   bg: Colors.errorBg   };
  return                          { text: Colors.warning, bg: Colors.warningBg };
}

// ─── Composants Marchés ───────────────────────────────────────────────────────

// ─── Sparkline (mini graphique View-based, pas de lib SVG requise) ────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 3) return <View style={{ height: 36 }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const BAR_H = 32;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: BAR_H + 4, gap: 2 }}>
      {data.map((v, i) => {
        const h = Math.max(3, Math.round(((v - min) / range) * BAR_H));
        const isLast = i === data.length - 1;
        return (
          <View key={i} style={{
            width: 3, height: h,
            backgroundColor: isLast ? color : color + '55',
            borderRadius: 2,
          }} />
        );
      })}
    </View>
  );
}

// ─── PrixLiveCard ─────────────────────────────────────────────────────────────

function PrixLiveCard({ item }: { item: PrixLiveItem }) {
  const isHausse  = item.tendance === 'hausse';
  const isBaisse  = item.tendance === 'baisse';
  const mainColor = isHausse ? '#1A7A2A' : isBaisse ? '#C62828' : Colors.textMuted;
  const bgColor   = isHausse ? '#E8F5E9' : isBaisse ? '#FFEBEE' : Colors.backgroundAlt;
  const arrow     = isHausse ? '↑' : isBaisse ? '↓' : '→';
  const varSign   = (item.variation_pct ?? 0) >= 0 ? '+' : '';
  const varLabel  = item.variation_pct != null
    ? `${varSign}${item.variation_pct.toFixed(2)}%`
    : null;

  return (
    <View style={[pl.card, { backgroundColor: bgColor }]}>
      <View style={pl.top}>
        <View style={pl.titleRow}>
          <Text style={pl.culture}>{item.culture}</Text>
          <View style={pl.marcheBadge}>
            <Text style={pl.marcheText}>{item.marche}</Text>
          </View>
        </View>
        <View style={pl.priceRow}>
          <Text style={[pl.price, { color: mainColor }]}>
            {item.prix_eur.toFixed(1)} €/t
          </Text>
          {varLabel && (
            <View style={[pl.varBadge, { backgroundColor: isHausse ? '#C8E6C9' : isBaisse ? '#FFCDD2' : Colors.border }]}>
              <Text style={[pl.varText, { color: mainColor }]}>{arrow} {varLabel}</Text>
            </View>
          )}
        </View>
      </View>
      {item.historique.length > 2 && (
        <View style={pl.chart}>
          <Sparkline data={item.historique} color={mainColor} />
          <View style={pl.chartLabels}>
            <Text style={pl.chartLbl}>30j</Text>
            <Text style={[pl.chartLbl, { color: mainColor, fontWeight: '700' }]}>
              {item.historique[item.historique.length - 1]?.toFixed(0)} €
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
const pl = StyleSheet.create({
  card:        { borderRadius: 16, padding: 16, gap: 10, flex: 1, minWidth: 160 },
  top:         { gap: 6 },
  titleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  culture:     { fontSize: 13, fontWeight: '800', color: Colors.primaryDark, flex: 1 },
  marcheBadge: { backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  marcheText:  { fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 },
  priceRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  price:       { fontSize: 20, fontWeight: '900' },
  varBadge:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  varText:     { fontSize: 11, fontWeight: '700' },
  chart:       { gap: 4 },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  chartLbl:    { fontSize: 10, color: Colors.textMuted },
});

// ─── Composants anciens (Analyse IA) ─────────────────────────────────────────

function PrixPill({ item }: { item: PrixCulture }) {
  const isHausse = item.tendance === 'hausse';
  const isBaisse = item.tendance === 'baisse';
  const color    = isHausse ? '#1A7A2A' : isBaisse ? Colors.error : Colors.textMuted;
  const bg       = isHausse ? '#E8F5E9' : isBaisse ? Colors.errorBg : Colors.backgroundAlt;
  const arrow    = isHausse ? '↑' : isBaisse ? '↓' : '→';
  return (
    <View style={[pp.pill, { backgroundColor: bg }]}>
      <View style={pp.pillTop}>
        <Text style={[pp.culture, { color: Colors.primaryDark }]}>{item.culture}</Text>
        {item.contexte ? <Text style={pp.marche}>{item.contexte}</Text> : null}
      </View>
      <Text style={[pp.prix, { color }]}>{item.prix_actuel ?? '—'}</Text>
      {item.variation
        ? <Text style={[pp.variation, { color }]}>{arrow} {item.variation}</Text>
        : <Text style={[pp.variation, { color: Colors.textMuted }]}>{arrow} stable</Text>
      }
    </View>
  );
}
const pp = StyleSheet.create({
  pill:      { borderRadius: 14, padding: 14, minWidth: 140, gap: 4 },
  pillTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  culture:   { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  marche:    { fontSize: 9, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  prix:      { fontSize: 18, fontWeight: '900' },
  variation: { fontSize: 11, fontWeight: '600' },
});

function RecoCard({ item, index }: { item: Recommandation; index: number }) {
  const urgColor = item.urgence === 'haute' ? '#C62828' : item.urgence === 'normale' ? Colors.primary : Colors.textMuted;
  const urgBg    = item.urgence === 'haute' ? '#FFEBEE' : item.urgence === 'normale' ? Colors.primaryBg : Colors.backgroundAlt;
  return (
    <View style={rc.card}>
      <View style={rc.top}>
        <View style={[rc.numBox, { backgroundColor: urgBg }]}>
          <Text style={[rc.num, { color: urgColor }]}>{index + 1}</Text>
        </View>
        <View style={[rc.urgBadge, { backgroundColor: urgBg }]}>
          <Text style={[rc.urgText, { color: urgColor }]}>
            {item.urgence === 'haute' ? 'Urgent' : item.urgence === 'normale' ? 'Cette semaine' : 'À terme'}
          </Text>
        </View>
      </View>
      <Text style={rc.titre}>{item.titre}</Text>
      <Text style={rc.detail}>{item.detail}</Text>
    </View>
  );
}
const rc = StyleSheet.create({
  card:     { backgroundColor: Colors.white, borderRadius: 16, padding: 18, gap: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  top:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numBox:   { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  num:      { fontSize: 13, fontWeight: '900' },
  urgBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  urgText:  { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  titre:    { fontSize: 15, fontWeight: '700', color: Colors.primaryDark },
  detail:   { fontSize: 13, color: Colors.textMuted, lineHeight: 20 },
});

function ActuCard({ item }: { item: Actualite }) {
  return (
    <TouchableOpacity style={ac.card} onPress={() => item.url && Linking.openURL(item.url)} activeOpacity={item.url ? 0.8 : 1}>
      {item.importance === 'haute' && <View style={ac.badge}><Text style={ac.badgeText}>À la une</Text></View>}
      <Text style={ac.titre}>{item.titre}</Text>
      <Text style={ac.resume}>{item.resume}</Text>
      {item.source && <Text style={ac.source}>{item.source}{item.url ? ' →' : ''}</Text>}
    </TouchableOpacity>
  );
}
const ac = StyleSheet.create({
  card:      { backgroundColor: Colors.white, borderRadius: 14, padding: 16, gap: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  badge:     { alignSelf: 'flex-start', backgroundColor: '#FFF3E0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#E65100' },
  titre:     { fontSize: 14, fontWeight: '700', color: Colors.primaryDark, lineHeight: 20 },
  resume:    { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  source:    { fontSize: 11, color: Colors.primary, fontWeight: '600' },
});

// ─── Composants Simulateur ────────────────────────────────────────────────────

function CultureCard({
  item, index, onPress, selected, conseil, conseilLoading,
}: {
  item: RecommandationCulture; index: number; onPress: () => void;
  selected: boolean; conseil: ConseilAgricole | null; conseilLoading: boolean;
}) {
  const meteo   = meteoColor(item.statut_meteo);
  const positif = item.marge_brute_euros >= 0;
  return (
    <TouchableOpacity style={[sim.card, selected && sim.cardSel]} onPress={onPress} activeOpacity={0.85}>
      <View style={sim.top}>
        <View style={[sim.rank, { backgroundColor: index === 0 ? '#FFF3E0' : Colors.primaryBg }]}>
          <Text style={[sim.rankTxt, { color: index === 0 ? '#E65100' : Colors.primary }]}>#{index + 1}</Text>
        </View>
        <Text style={sim.nom}>{item.nom_culture}</Text>
        <View style={[sim.meteoBadge, { backgroundColor: meteo.bg }]}>
          <Text style={[sim.meteoTxt, { color: meteo.text }]}>{item.statut_meteo}</Text>
        </View>
      </View>
      <View style={sim.metrics}>
        <View style={sim.metric}>
          <Text style={sim.mVal}>{item.rendement_total_tonnes.toFixed(1)} t</Text>
          <Text style={sim.mLbl}>Rendement</Text>
        </View>
        <View style={sim.mDiv} />
        <View style={sim.metric}>
          <Text style={sim.mVal}>{formatEuros(item.chiffre_affaires_euros)}</Text>
          <Text style={sim.mLbl}>CA</Text>
        </View>
        <View style={sim.mDiv} />
        <View style={sim.metric}>
          <Text style={[sim.mVal, { color: positif ? Colors.success : Colors.error }]}>
            {formatEuros(item.marge_brute_euros)}
          </Text>
          <Text style={sim.mLbl}>Marge brute</Text>
        </View>
      </View>
      <View style={sim.hint}><Text style={sim.hintTxt}>{selected ? '▲ Masquer' : '▼ Conseil IA'}</Text></View>
      {selected && (
        <View style={sim.detail}>
          <View style={sim.div} />
          {conseilLoading ? (
            <View style={sim.dLoad}><ActivityIndicator color={Colors.primary} size="small" /><Text style={sim.dLoadTxt}>Génération du conseil…</Text></View>
          ) : conseil ? (
            <>
              <Text style={sim.dLabel}>CONSEIL AGRONOME</Text>
              <Text style={sim.dText}>{conseil.conseil_action}</Text>
              <View style={sim.dMetrics}>
                <View style={sim.dm}><Text style={sim.dmV}>{formatEuros(conseil.charges_totales_euros)}</Text><Text style={sim.dmL}>Charges</Text></View>
                <View style={sim.dm}><Text style={[sim.dmV, { color: conseil.marge_brute_euros >= 0 ? Colors.success : Colors.error }]}>{formatEuros(conseil.marge_brute_euros)}</Text><Text style={sim.dmL}>Marge nette</Text></View>
              </View>
            </>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}
const sim = StyleSheet.create({
  card:      { backgroundColor: Colors.white, borderRadius: 16, padding: 18, gap: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3, borderWidth: 2, borderColor: 'transparent' },
  cardSel:   { borderColor: Colors.primary },
  top:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank:      { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  rankTxt:   { fontSize: 12, fontWeight: '800' },
  nom:       { flex: 1, fontSize: 15, fontWeight: '800', color: Colors.primaryDark },
  meteoBadge:{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  meteoTxt:  { fontSize: 10, fontWeight: '700' },
  metrics:   { flexDirection: 'row', backgroundColor: Colors.backgroundAlt, borderRadius: 10, paddingVertical: 10 },
  metric:    { flex: 1, alignItems: 'center', gap: 2 },
  mVal:      { fontSize: 12, fontWeight: '800', color: Colors.primaryDark },
  mLbl:      { fontSize: 10, color: Colors.textMuted },
  mDiv:      { width: 1, backgroundColor: Colors.border, alignSelf: 'center', height: 24 },
  hint:      { alignItems: 'center' },
  hintTxt:   { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  detail:    { gap: 10 },
  div:       { height: 1, backgroundColor: Colors.border },
  dLoad:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dLoadTxt:  { fontSize: 13, color: Colors.textMuted },
  dLabel:    { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase' },
  dText:     { fontSize: 13, color: Colors.text, lineHeight: 21 },
  dMetrics:  { flexDirection: 'row', gap: 10 },
  dm:        { flex: 1, backgroundColor: Colors.backgroundAlt, borderRadius: 10, padding: 12, gap: 3 },
  dmV:       { fontSize: 13, fontWeight: '800', color: Colors.primaryDark },
  dmL:       { fontSize: 10, color: Colors.textMuted },
});

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function MarcheScreen() {
  const insets                  = useSafeAreaInsets();
  const { fullProfile, isComplete } = useProfile();
  const [pageTab, setPageTab]   = useState<PageTab>('marche');

  // ── État Prix Live ──────────────────────────────────────────────────────────
  const [prixLive,     setPrixLive]    = useState<PrixLiveResponse | null>(null);
  const [prixLoading,  setPrixLoading] = useState(false);
  const prixIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── État Marchés ────────────────────────────────────────────────────────────
  const [analyse,     setAnalyse]     = useState<MarcheAnalyse | null>(null);
  const [mLoading,    setMLoading]    = useState(false);
  const [mError,      setMError]      = useState('');
  const [question,    setQuestion]    = useState('');
  const [searching,   setSearching]   = useState(false);
  const [resultatQ,   setResultatQ]   = useState<RechercheResultat | null>(null);
  const [searchErr,   setSearchErr]   = useState('');
  const progressM    = useRef(new Animated.Value(0)).current;
  const [mLabel,      setMLabel]      = useState('');
  const timersM      = useRef<ReturnType<typeof setTimeout>[]>([]);
  const STEPS_M = [
    { at: 500,  to: 0.15, label: 'Collecte des prix MATIF…' },
    { at: 2000, to: 0.38, label: 'Recherche des actualités…' },
    { at: 4000, to: 0.60, label: 'Analyse des tendances…' },
    { at: 6500, to: 0.80, label: 'Génération des recommandations…' },
    { at: 9000, to: 0.92, label: 'Finalisation…' },
  ];

  // ── État Simulateur ─────────────────────────────────────────────────────────
  const [hectares,     setHectares]     = useState<number>(10);
  const [typeSol,      setTypeSol]      = useState<string>('limoneux');
  const [coords,       setCoords]       = useState<{ lat: number; lon: number } | null>(null);
  const [geocoding,    setGeocoding]    = useState(false);
  const [simResultat,  setSimResultat]  = useState<RecommandationCulture[] | null>(null);
  const [simLoading,   setSimLoading]   = useState(false);
  const [simError,     setSimError]     = useState('');
  const [lastSim,      setLastSim]      = useState('');
  const [selectedIdx,  setSelectedIdx]  = useState<number | null>(null);
  const [conseil,      setConseil]      = useState<ConseilAgricole | null>(null);
  const [cLoading,     setCLoading]     = useState(false);
  const progressS   = useRef(new Animated.Value(0)).current;
  const [sLabel,      setSLabel]        = useState('');
  const timersS     = useRef<ReturnType<typeof setTimeout>[]>([]);
  const STEPS_S = [
    { at: 600,  to: 0.20, label: 'Analyse météo locale…' },
    { at: 2500, to: 0.45, label: 'Calcul des marges…' },
    { at: 5000, to: 0.70, label: 'Évaluation des conditions de sol…' },
    { at: 7500, to: 0.88, label: 'Sélection du Top 3 IA…' },
  ];

  // ── Init / Cache ────────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(CACHE_MARCHE).then(raw => { if (raw) setAnalyse(JSON.parse(raw)); }).catch(() => {});
    AsyncStorage.getItem(CACHE_RENTABILITE).then(raw => {
      if (!raw) return;
      const { data, ts, surface, sol } = JSON.parse(raw);
      if (Date.now() - ts < CACHE_TTL) {
        setSimResultat(data); setLastSim(new Date(ts).toLocaleDateString('fr-FR'));
        if (surface) setHectares(surface); if (sol) setTypeSol(sol);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const surf = fullProfile?.exploitation?.surface_ha;
    const commune = fullProfile?.exploitation?.commune ?? '';
    const cp      = fullProfile?.exploitation?.code_postal ?? '';
    if (surf) setHectares(surf);
    if (commune && !coords) {
      setGeocoding(true);
      geocodeCommune(commune, cp).then(c => { if (c) setCoords({ lat: c.lat, lon: c.lon }); })
        .catch(() => {}).finally(() => setGeocoding(false));
    }
  }, [fullProfile]);

  // ── Prix Live : fetch au montage + refresh toutes les 2 minutes ────────────
  const buildPrixReq = () => ({
    cultures: fullProfile?.cultures?.map(c => c.type_culture) ?? [],
  });

  const fetchPrix = async () => {
    setPrixLoading(true);
    try {
      const res = await fetchPrixLive(buildPrixReq());
      setPrixLive(res);
    } catch { /* silencieux si hors-ligne */ }
    finally { setPrixLoading(false); }
  };

  useEffect(() => {
    fetchPrix();
    prixIntervalRef.current = setInterval(fetchPrix, 2 * 60 * 1000);
    return () => {
      if (prixIntervalRef.current) clearInterval(prixIntervalRef.current);
    };
  }, []);

  // ── Animation loading Marchés ───────────────────────────────────────────────
  useEffect(() => {
    if (mLoading) {
      progressM.setValue(0); setMLabel('Initialisation…');
      timersM.current = STEPS_M.map(s => setTimeout(() => {
        setMLabel(s.label);
        Animated.timing(progressM, { toValue: s.to, duration: 800, useNativeDriver: false }).start();
      }, s.at));
    } else {
      timersM.current.forEach(clearTimeout);
      Animated.timing(progressM, { toValue: 1, duration: 400, useNativeDriver: false })
        .start(() => setTimeout(() => progressM.setValue(0), 600));
    }
    return () => { timersM.current.forEach(clearTimeout); };
  }, [mLoading]);

  // ── Animation loading Simulateur ────────────────────────────────────────────
  useEffect(() => {
    if (simLoading) {
      progressS.setValue(0); setSLabel('Initialisation…');
      timersS.current = STEPS_S.map(s => setTimeout(() => {
        setSLabel(s.label);
        Animated.timing(progressS, { toValue: s.to, duration: 700, useNativeDriver: false }).start();
      }, s.at));
    } else {
      timersS.current.forEach(clearTimeout);
      Animated.timing(progressS, { toValue: 1, duration: 400, useNativeDriver: false })
        .start(() => setTimeout(() => progressS.setValue(0), 500));
    }
    return () => { timersS.current.forEach(clearTimeout); };
  }, [simLoading]);

  // ── Handlers Marchés ────────────────────────────────────────────────────────
  const buildMarcheReq = () => {
    const e = fullProfile?.exploitation;
    return {
      cultures:           fullProfile?.cultures?.map(c => c.type_culture) ?? [],
      type_exploitation:  e?.type_exploitation  ?? undefined,
      methode_production: e?.methode_production ?? undefined,
      region:             e?.region             ?? undefined,
      departement:        e?.departement        ?? undefined,
      surface_ha:         e?.surface_ha         ?? undefined,
    };
  };

  const handleAnalyse = async () => {
    setMError(''); setMLoading(true);
    try {
      const result = await fetchMarcheAnalyse(buildMarcheReq());
      setAnalyse(result);
      await AsyncStorage.setItem(CACHE_MARCHE, JSON.stringify(result));
    } catch (e: any) { setMError(e?.message ?? 'Erreur inattendue.'); }
    finally { setMLoading(false); }
  };

  const handleRecherche = async () => {
    if (!question.trim()) return;
    Keyboard.dismiss(); setSearchErr(''); setResultatQ(null); setSearching(true);
    try {
      const req = buildMarcheReq();
      const result = await fetchMarcheRecherche({ question: question.trim(), cultures: req.cultures, region: req.region });
      setResultatQ(result);
    } catch (e: any) { setSearchErr(e?.message ?? 'Erreur inattendue.'); }
    finally { setSearching(false); }
  };

  // ── Handlers Simulateur ─────────────────────────────────────────────────────
  const handleSimuler = useCallback(async () => {
    if (!coords)                    { setSimError('Commune introuvable — vérifiez votre profil.'); return; }
    if (!hectares || hectares <= 0) { setSimError('Saisissez une surface valide.'); return; }
    setSimError(''); setSimResultat(null); setSelectedIdx(null); setConseil(null); setSimLoading(true);
    const req: RequeteTop3 = { hectares, type_sol: typeSol, latitude: coords.lat, longitude: coords.lon };
    try {
      const res = await fetchRecommandations(req);
      setSimResultat(res.cultures_validees);
      setLastSim(new Date().toLocaleDateString('fr-FR'));
      await AsyncStorage.setItem(CACHE_RENTABILITE, JSON.stringify({
        data: res.cultures_validees, ts: Date.now(), surface: hectares, sol: typeSol,
      }));
    } catch (e: any) { setSimError(e?.message ?? 'Erreur inattendue. Vérifiez que le serveur est démarré.'); }
    finally { setSimLoading(false); }
  }, [coords, hectares, typeSol]);

  const handleSelectCulture = useCallback(async (idx: number, culture: RecommandationCulture) => {
    if (selectedIdx === idx) { setSelectedIdx(null); setConseil(null); return; }
    setSelectedIdx(idx); setConseil(null);
    if (!coords) return;
    setCLoading(true);
    try {
      const res = await fetchConseil({ hectares, type_sol: typeSol, latitude: coords.lat, longitude: coords.lon, culture: culture.nom_culture });
      setConseil(res);
    } catch { /* silence */ } finally { setCLoading(false); }
  }, [selectedIdx, coords, hectares, typeSol]);

  const commune = fullProfile?.exploitation?.commune ?? '';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
    <Head><title>Marchés & Rentabilité — AgroPilot</title></Head>
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.container, { paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >

      {/* ─── HEADER ──────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 24 }]}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.headerTitle}>
              {pageTab === 'marche' ? 'Marchés agricoles' : 'Simulateur de rentabilité'}
            </Text>
            <Text style={s.headerSub}>
              {pageTab === 'marche'
                ? (analyse ? `Mis à jour le ${analyse.horodatage}` : 'Analyse IA en temps réel')
                : (commune ? `${commune} · ${hectares} ha` : 'Configurez votre exploitation')
              }
            </Text>
          </View>
          {pageTab === 'marche' && (
            <TouchableOpacity
              style={[s.refreshBtn, mLoading && s.refreshBtnOff]}
              onPress={handleAnalyse}
              disabled={mLoading}
            >
              <Text style={s.refreshBtnTxt}>{mLoading ? '…' : analyse ? '↻' : 'Analyser'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Prix pills */}
        {pageTab === 'marche' && analyse?.prix && analyse.prix.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.prixScroll} contentContainerStyle={s.prixRow}>
            {analyse.prix.map((p, i) => <PrixPill key={i} item={p} />)}
          </ScrollView>
        )}

        {/* Onglets de page */}
        <View style={s.pageTabs}>
          <TouchableOpacity
            style={[s.pageTab, pageTab === 'marche' && s.pageTabOn]}
            onPress={() => setPageTab('marche')}
          >
            <Text style={[s.pageTabTxt, pageTab === 'marche' && s.pageTabTxtOn]}>📊 Marchés</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.pageTab, pageTab === 'simulateur' && s.pageTabOn]}
            onPress={() => setPageTab('simulateur')}
          >
            <Text style={[s.pageTabTxt, pageTab === 'simulateur' && s.pageTabTxtOn]}>🌾 Simulateur</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB : MARCHÉS                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {pageTab === 'marche' && (
        <>
          {/* ── PRIX EN DIRECT ──────────────────────────────────────────────── */}
          <View style={s.liveSection}>
            <View style={s.liveTitleRow}>
              <View style={s.liveDot} />
              <Text style={s.liveSectionLabel}>COURS EN DIRECT</Text>
              <Text style={s.liveTimestamp}>
                {prixLive ? `Mis à jour ${prixLive.timestamp}` : prixLoading ? 'Chargement…' : ''}
              </Text>
              <TouchableOpacity onPress={fetchPrix} disabled={prixLoading} style={s.liveRefreshBtn}>
                <Text style={s.liveRefreshTxt}>{prixLoading ? '…' : '↻'}</Text>
              </TouchableOpacity>
            </View>

            {prixLoading && !prixLive && (
              <View style={s.liveLoadRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={s.liveLoadTxt}>Connexion Yahoo Finance…</Text>
              </View>
            )}

            {prixLive && prixLive.items.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.liveRow}>
                {prixLive.items.map((item, i) => (
                  <PrixLiveCard key={i} item={item} />
                ))}
              </ScrollView>
            )}

            {prixLive && prixLive.items.length === 0 && !prixLoading && (
              <View style={s.liveEmpty}>
                <Text style={s.liveEmptyTxt}>Cours indisponibles — vérifiez le serveur</Text>
              </View>
            )}
          </View>

          {/* Progression */}
          {mLoading && (
            <View style={s.loadCard}>
              <Text style={s.loadTitle}>Analyse en cours…</Text>
              <Text style={s.loadLabel}>{mLabel}</Text>
              <View style={s.progressTrack}>
                <Animated.View style={[s.progressFill, {
                  width: progressM.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }]} />
              </View>
              <Text style={s.loadNote}>Tavily + Groq / IA analysent les marchés</Text>
            </View>
          )}

          {/* Erreur */}
          {!!mError && (
            <View style={s.errorBox}>
              <Text style={s.errorTitle}>Erreur</Text>
              <Text style={s.errorText}>{mError}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={handleAnalyse}>
                <Text style={s.retryText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* État vide */}
          {!mLoading && !analyse && !mError && (
            <View style={s.emptyBlock}>
              <View style={s.emptyIcon}><Text style={s.emptyIconTxt}>📊</Text></View>
              <Text style={s.emptyTitle}>Votre veille marché personnalisée</Text>
              <Text style={s.emptyBody}>Prix MATIF en temps réel, recommandations IA, actualités filtrées pour votre exploitation.</Text>
              {!isComplete && <View style={s.warnBox}><Text style={s.warnText}>Complétez votre profil pour une analyse sur-mesure.</Text></View>}
              <TouchableOpacity style={s.ctaBtn} onPress={handleAnalyse}><Text style={s.ctaBtnTxt}>Lancer l'analyse</Text></TouchableOpacity>
            </View>
          )}

          {/* Synthèse — toujours affichée quand analyse est disponible */}
          {analyse && !mLoading && (
            <View style={s.synthCard}>
              <Text style={s.sectionEyebrow}>SYNTHÈSE DU MARCHÉ</Text>
              <Text style={s.synthText}>{analyse.synthese || 'Données de marché chargées.'}</Text>
            </View>
          )}

          {/* Recommandations */}
          {analyse?.recommandations && analyse.recommandations.length > 0 && !mLoading && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>RECOMMANDATIONS IA</Text>
              <View style={s.list}>{analyse.recommandations.map((r, i) => <RecoCard key={i} item={r} index={i} />)}</View>
            </View>
          )}

          {/* Opportunités & Risques */}
          {analyse && !mLoading && (
            <View style={s.orRow}>
              {analyse.opportunites?.length > 0 && (
                <View style={[s.orCard, { backgroundColor: '#E8F5E9' }]}>
                  <Text style={s.orLabel}>OPPORTUNITÉS</Text>
                  {analyse.opportunites.map((o, i) => (
                    <View key={i} style={s.orItem}>
                      <View style={[s.orDot, { backgroundColor: '#2E7D32' }]} />
                      <Text style={s.orText}>{o}</Text>
                    </View>
                  ))}
                </View>
              )}
              {analyse.risques?.length > 0 && (
                <View style={[s.orCard, { backgroundColor: '#FFEBEE' }]}>
                  <Text style={s.orLabel}>RISQUES</Text>
                  {analyse.risques.map((r, i) => (
                    <View key={i} style={s.orItem}>
                      <View style={[s.orDot, { backgroundColor: '#C62828' }]} />
                      <Text style={s.orText}>{r}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Actualités */}
          {analyse?.actualites && analyse.actualites.length > 0 && !mLoading && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>ACTUALITÉS AGRICOLES</Text>
              <View style={s.list}>{analyse.actualites.map((a, i) => <ActuCard key={i} item={a} />)}</View>
            </View>
          )}

          {/* Recherche libre */}
          <View style={s.searchSection}>
            <Text style={s.sectionLabel}>POSEZ VOTRE QUESTION</Text>
            <Text style={s.searchHint}>Prix d'un intrant, débouchés, réglementation, export…</Text>
            <View style={s.searchBar}>
              <TextInput
                style={s.searchInput}
                placeholder="Ex : quel est le prix actuel de l'urée ?"
                placeholderTextColor={Colors.textPlaceholder}
                value={question}
                onChangeText={setQuestion}
                onSubmitEditing={handleRecherche}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={[s.searchBtn, (!question.trim() || searching) && s.searchBtnOff]}
                onPress={handleRecherche}
                disabled={!question.trim() || searching}
              >
                {searching ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.searchBtnTxt}>→</Text>}
              </TouchableOpacity>
            </View>
            {!resultatQ && !searching && (
              <View style={s.suggestRow}>
                {["Prix engrais azotés", "Tendance blé France", "Coût GNR agricole", "Marché colza EU"].map(q => (
                  <TouchableOpacity key={q} style={s.suggestPill} onPress={() => setQuestion(q)}>
                    <Text style={s.suggestTxt}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {searching && <View style={s.searchLoad}><ActivityIndicator color={Colors.primary} /><Text style={s.searchLoadTxt}>Recherche en cours…</Text></View>}
            {!!searchErr && <View style={s.errorBox}><Text style={s.errorText}>{searchErr}</Text></View>}
            {resultatQ && !searching && (
              <View style={s.resultatCard}>
                <Text style={s.resultatQ}>« {resultatQ.question} »</Text>
                <Text style={s.resultatR}>{resultatQ.reponse}</Text>
                {resultatQ.sources?.length > 0 && (
                  <View style={s.sourcesList}>
                    <Text style={s.sourcesLbl}>Sources</Text>
                    {resultatQ.sources.filter(src => src.url).map((src, i) => (
                      <TouchableOpacity key={i} onPress={() => Linking.openURL(src.url)}>
                        <Text style={s.sourceLink}>{src.titre || src.url}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <TouchableOpacity style={s.clearBtn} onPress={() => { setResultatQ(null); setQuestion(''); }}>
                  <Text style={s.clearBtnTxt}>Nouvelle recherche</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB : SIMULATEUR                                                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {pageTab === 'simulateur' && (
        <>
          {/* Formulaire */}
          <View style={s.formCard}>
            <Text style={s.formTitle}>Paramètres de simulation</Text>

            <View style={s.field}>
              <Text style={s.fieldLbl}>Surface exploitée (ha)</Text>
              <View style={s.stepperRow}>
                <TouchableOpacity style={s.stepBtn} onPress={() => setHectares(h => Math.max(1, Math.round(h - 5)))}>
                  <Text style={s.stepBtnTxt}>−</Text>
                </TouchableOpacity>
                <View style={s.stepperVal}>
                  <Text style={s.stepperValTxt}>{hectares} ha</Text>
                </View>
                <TouchableOpacity style={s.stepBtn} onPress={() => setHectares(h => Math.round(h + 5))}>
                  <Text style={s.stepBtnTxt}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.fieldLbl}>Type de sol</Text>
              <PillSelect options={SOLS} value={typeSol} onChange={v => setTypeSol(v as string)} multi={false} />
            </View>

            <View style={s.locRow}>
              <Text style={s.locIcon}>{geocoding ? '⏳' : coords ? '📍' : '⚠️'}</Text>
              <Text style={s.locText}>
                {geocoding ? 'Géolocalisation…' : coords ? commune || 'Localisation détectée' : 'Commune non configurée dans le profil'}
              </Text>
            </View>

            {!!simError && <View style={s.errorBox}><Text style={s.errorText}>{simError}</Text></View>}

            <TouchableOpacity
              style={[s.ctaBtn, (simLoading || geocoding || !coords) && s.ctaBtnOff]}
              onPress={handleSimuler}
              disabled={simLoading || geocoding || !coords}
            >
              {simLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaBtnTxt}>🌾 Lancer la simulation IA</Text>}
            </TouchableOpacity>

            {lastSim ? <Text style={s.lastSim}>Dernière simulation : {lastSim}</Text> : null}
          </View>

          {/* Progression simulateur */}
          {simLoading && (
            <View style={s.loadCard}>
              <Text style={s.loadTitle}>Analyse IA en cours…</Text>
              <Text style={s.loadLabel}>{sLabel}</Text>
              <View style={s.progressTrack}>
                <Animated.View style={[s.progressFill, {
                  width: progressS.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }]} />
              </View>
              <Text style={s.loadNote}>Météo + base cultures + Groq / IA · ~10s</Text>
            </View>
          )}

          {/* Top 3 résultats */}
          {!simLoading && simResultat && simResultat.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>TOP {simResultat.length} CULTURES RECOMMANDÉES</Text>
              <Text style={s.simHint}>Appuyez sur une carte pour voir le conseil détaillé</Text>
              <View style={s.list}>
                {simResultat.map((item, idx) => (
                  <CultureCard
                    key={idx} item={item} index={idx}
                    selected={selectedIdx === idx}
                    conseil={selectedIdx === idx ? conseil : null}
                    conseilLoading={selectedIdx === idx ? cLoading : false}
                    onPress={() => handleSelectCulture(idx, item)}
                  />
                ))}
              </View>
            </View>
          )}

          {!simLoading && simResultat && simResultat.length === 0 && (
            <View style={s.emptyBlock}>
              <Text style={{ fontSize: 48 }}>🌱</Text>
              <Text style={s.emptyTitle}>Aucune culture recommandée</Text>
              <Text style={s.emptyBody}>Les conditions actuelles ne favorisent aucune culture. Essayez un autre type de sol.</Text>
            </View>
          )}
        </>
      )}

    </ScrollView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.background },
  container: { paddingHorizontal: 0 },

  header: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: 22,
    paddingBottom: 6,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    gap: 14,
    marginBottom: 18,
  },
  headerTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 0 },
  headerTitle:     { fontSize: 22, fontWeight: '900', color: '#fff' },
  headerSub:       { fontSize: 12, color: Colors.headerTextMuted, marginTop: 3 },
  refreshBtn:      { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  refreshBtnOff:   { opacity: 0.5 },
  refreshBtnTxt:   { color: '#fff', fontSize: 14, fontWeight: '700' },
  prixScroll:      { marginHorizontal: -22 },
  prixRow:         { paddingHorizontal: 22, gap: 10, flexDirection: 'row' },

  // Onglets de page (dans le header)
  pageTabs:    { flexDirection: 'row', gap: 8, paddingBottom: 14 },
  pageTab:     { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center' },
  pageTabOn:   { backgroundColor: '#fff' },
  pageTabTxt:  { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  pageTabTxtOn:{ color: Colors.primaryDark },

  // Loading
  loadCard: {
    marginHorizontal: 22, marginBottom: 16,
    backgroundColor: Colors.white, borderRadius: 18, padding: 22, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  loadTitle:     { fontSize: 17, fontWeight: '800', color: Colors.primaryDark },
  loadLabel:     { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  progressTrack: { height: 8, backgroundColor: Colors.primaryBg, borderRadius: 4, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  loadNote:      { fontSize: 12, color: Colors.textMuted },

  // Erreur
  errorBox:   { marginHorizontal: 22, backgroundColor: Colors.errorBg, borderRadius: 12, padding: 16, borderLeftWidth: 3, borderLeftColor: Colors.error, gap: 8, marginBottom: 16 },
  errorTitle: { fontSize: 14, fontWeight: '700', color: Colors.errorDark },
  errorText:  { fontSize: 13, color: Colors.errorDark, lineHeight: 19 },
  retryBtn:   { alignSelf: 'flex-start', backgroundColor: Colors.error, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  retryText:  { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Vide
  emptyBlock: { marginHorizontal: 22, alignItems: 'center', paddingVertical: 20, gap: 14 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  emptyIconTxt: { fontSize: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.primaryDark, textAlign: 'center' },
  emptyBody:  { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  warnBox:    { backgroundColor: Colors.warningBg, borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: Colors.warning, alignSelf: 'stretch' },
  warnText:   { fontSize: 13, color: '#7B5800', lineHeight: 19 },
  ctaBtn:     { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaBtnOff:  { backgroundColor: Colors.border },
  ctaBtnTxt:  { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Synthèse
  synthCard: {
    marginHorizontal: 22, marginBottom: 20,
    backgroundColor: Colors.aiCardBg, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: Colors.aiCardBorder,
    padding: 20, gap: 10,
  },
  sectionEyebrow: { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase' },
  synthText:      { fontSize: 14, color: Colors.primaryDark, lineHeight: 22 },

  // Sections génériques
  section:      { marginHorizontal: 22, marginBottom: 20, gap: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase' },
  list:         { gap: 10 },

  // Opportunités / Risques
  orRow:  { flexDirection: 'row', marginHorizontal: 22, gap: 12, marginBottom: 20 },
  orCard: { flex: 1, borderRadius: 14, padding: 16, gap: 10 },
  orLabel:{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: Colors.textMuted },
  orItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  orDot:  { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  orText: { fontSize: 12, color: Colors.text, lineHeight: 18, flex: 1 },

  // Recherche libre
  searchSection: { marginHorizontal: 22, marginBottom: 20, gap: 12 },
  searchHint:    { fontSize: 13, color: Colors.textMuted, marginTop: -4 },
  searchBar:     { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchInput:   { flex: 1, backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  searchBtn:     { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  searchBtnOff:  { backgroundColor: Colors.border },
  searchBtnTxt:  { color: '#fff', fontSize: 20, fontWeight: '700' },
  suggestRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestPill:   { backgroundColor: Colors.white, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border },
  suggestTxt:    { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  searchLoad:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  searchLoadTxt: { fontSize: 14, color: Colors.textMuted },
  resultatCard:  { backgroundColor: Colors.white, borderRadius: 16, padding: 20, gap: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  resultatQ:     { fontSize: 14, fontWeight: '700', color: Colors.primary, fontStyle: 'italic' },
  resultatR:     { fontSize: 14, color: Colors.text, lineHeight: 22 },
  sourcesList:   { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, gap: 6 },
  sourcesLbl:    { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  sourceLink:    { fontSize: 12, color: Colors.primary, lineHeight: 18 },
  clearBtn:      { alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  clearBtnTxt:   { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },

  // Formulaire simulateur
  formCard: {
    marginHorizontal: 22, marginBottom: 16,
    backgroundColor: Colors.white, borderRadius: 20, padding: 22, gap: 18,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  formTitle:      { fontSize: 16, fontWeight: '800', color: Colors.primaryDark },
  field:          { gap: 10 },
  fieldLbl:       { fontSize: 13, fontWeight: '700', color: Colors.primaryDark },
  stepperRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn:        { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  stepBtnTxt:     { fontSize: 22, fontWeight: '700', color: Colors.primary },
  stepperVal:     { flex: 1, height: 44, backgroundColor: Colors.backgroundAlt, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepperValTxt:  { fontSize: 18, fontWeight: '800', color: Colors.primaryDark },
  locRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.backgroundAlt, borderRadius: 10, padding: 12 },
  locIcon:        { fontSize: 14 },
  locText:        { fontSize: 13, color: Colors.textMuted, flex: 1 },
  lastSim:        { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: -8 },
  simHint:        { fontSize: 12, color: Colors.textMuted, marginTop: -4 },

  // ── Section prix en direct ────────────────────────────────────────────────
  liveSection:     { marginHorizontal: 22, marginBottom: 20, gap: 12 },
  liveTitleRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2ECC40' },
  liveSectionLabel:{ fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase', flex: 1 },
  liveTimestamp:   { fontSize: 10, color: Colors.textMuted },
  liveRefreshBtn:  { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  liveRefreshTxt:  { fontSize: 14, color: Colors.primary, fontWeight: '700' },
  liveLoadRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  liveLoadTxt:     { fontSize: 13, color: Colors.textMuted },
  liveRow:         { gap: 10, flexDirection: 'row', paddingBottom: 4 },
  liveEmpty:       { backgroundColor: Colors.backgroundAlt, borderRadius: 12, padding: 14, alignItems: 'center' },
  liveEmptyTxt:    { fontSize: 13, color: Colors.textMuted },
});
