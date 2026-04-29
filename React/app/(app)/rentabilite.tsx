/**
 * app/(app)/rentabilite.tsx — Simulateur de rentabilité IA
 * Responsables : Kelyan (frontend) / Sybille & Florian (backend)
 *
 * Flux :
 *  1. Formulaire auto-rempli depuis le profil (surface, commune → coords)
 *  2. POST /api/ia/recommandations  → Top 3 cultures recommandées
 *  3. Tap sur une culture → POST /api/ia/generer-conseil → conseil détaillé
 *  4. Cache AsyncStorage 24h
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Head from 'expo-router/head';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '@/hooks/useProfile';
import { geocodeCommune } from '@/services/meteo.service';
import {
  fetchRecommandations, fetchConseil,
  RecommandationCulture, ConseilAgricole, RequeteTop3,
} from '@/services/rentabilite.service';
import { PillSelect } from '@/components/ui/PillSelect';
import { Colors } from '@/constants/Colors';

const CACHE_KEY = 'agropilot_rentabilite_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

const SOLS = [
  { value: 'argileux', label: 'Argileux' },
  { value: 'limoneux', label: 'Limoneux' },
  { value: 'sableux',  label: 'Sableux'  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEuros(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function meteoColor(s: string) {
  if (s === 'Favorable')   return { text: Colors.success, bg: Colors.successBg };
  if (s === 'Défavorable') return { text: Colors.error,   bg: Colors.errorBg };
  return                          { text: Colors.warning, bg: Colors.warningBg };
}

// ─── Carte d'une culture recommandée ─────────────────────────────────────────

function CultureCard({
  item, index, onPress, selected, conseil, conseilLoading,
}: {
  item: RecommandationCulture;
  index: number;
  onPress: () => void;
  selected: boolean;
  conseil: ConseilAgricole | null;
  conseilLoading: boolean;
}) {
  const meteo   = meteoColor(item.statut_meteo);
  const positif = item.marge_brute_euros >= 0;

  return (
    <TouchableOpacity style={[cs.card, selected && cs.cardSelected]} onPress={onPress} activeOpacity={0.85}>
      <View style={cs.top}>
        <View style={[cs.rank, { backgroundColor: index === 0 ? '#FFF3E0' : Colors.primaryBg }]}>
          <Text style={[cs.rankText, { color: index === 0 ? '#E65100' : Colors.primary }]}>#{index + 1}</Text>
        </View>
        <Text style={cs.nom}>{item.nom_culture}</Text>
        <View style={[cs.meteoBadge, { backgroundColor: meteo.bg }]}>
          <Text style={[cs.meteoText, { color: meteo.text }]}>{item.statut_meteo}</Text>
        </View>
      </View>

      <View style={cs.metrics}>
        <View style={cs.metric}>
          <Text style={cs.metricVal}>{item.rendement_total_tonnes.toFixed(1)} t</Text>
          <Text style={cs.metricLbl}>Rendement</Text>
        </View>
        <View style={cs.metricDiv} />
        <View style={cs.metric}>
          <Text style={cs.metricVal}>{formatEuros(item.chiffre_affaires_euros)}</Text>
          <Text style={cs.metricLbl}>Chiffre d'affaires</Text>
        </View>
        <View style={cs.metricDiv} />
        <View style={cs.metric}>
          <Text style={[cs.metricVal, { color: positif ? Colors.success : Colors.error }]}>
            {formatEuros(item.marge_brute_euros)}
          </Text>
          <Text style={cs.metricLbl}>Marge brute</Text>
        </View>
      </View>

      <View style={cs.toggleHint}>
        <Text style={cs.toggleHintText}>{selected ? '▲ Masquer le conseil' : '▼ Voir le conseil IA'}</Text>
      </View>

      {selected && (
        <View style={cs.detail}>
          <View style={cs.divider} />
          {conseilLoading ? (
            <View style={cs.detailLoad}>
              <ActivityIndicator color={Colors.primary} size="small" />
              <Text style={cs.detailLoadTxt}>Génération du conseil agronome…</Text>
            </View>
          ) : conseil ? (
            <>
              <Text style={cs.detailLabel}>CONSEIL AGRONOME</Text>
              <Text style={cs.detailText}>{conseil.conseil_action}</Text>
              <View style={cs.detailMetrics}>
                <View style={cs.dm}>
                  <Text style={cs.dmVal}>{formatEuros(conseil.charges_totales_euros)}</Text>
                  <Text style={cs.dmLbl}>Charges totales</Text>
                </View>
                <View style={cs.dm}>
                  <Text style={[cs.dmVal, { color: conseil.marge_brute_euros >= 0 ? Colors.success : Colors.error }]}>
                    {formatEuros(conseil.marge_brute_euros)}
                  </Text>
                  <Text style={cs.dmLbl}>Marge nette estimée</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const cs = StyleSheet.create({
  card: {
    backgroundColor: Colors.white, borderRadius: 18, padding: 20, gap: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
    borderWidth: 2, borderColor: 'transparent',
  },
  cardSelected: { borderColor: Colors.primary },
  top:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank:       { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  rankText:   { fontSize: 12, fontWeight: '800' },
  nom:        { flex: 1, fontSize: 16, fontWeight: '800', color: Colors.primaryDark },
  meteoBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  meteoText:  { fontSize: 10, fontWeight: '700' },
  metrics:    { flexDirection: 'row', backgroundColor: Colors.backgroundAlt, borderRadius: 12, paddingVertical: 12 },
  metric:     { flex: 1, alignItems: 'center', gap: 3 },
  metricVal:  { fontSize: 13, fontWeight: '800', color: Colors.primaryDark },
  metricLbl:  { fontSize: 10, color: Colors.textMuted },
  metricDiv:  { width: 1, backgroundColor: Colors.border, alignSelf: 'center', height: 28 },
  toggleHint: { alignItems: 'center' },
  toggleHintText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  detail:       { gap: 10 },
  divider:      { height: 1, backgroundColor: Colors.border },
  detailLoad:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  detailLoadTxt:{ fontSize: 13, color: Colors.textMuted },
  detailLabel:  { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase' },
  detailText:   { fontSize: 13, color: Colors.text, lineHeight: 21 },
  detailMetrics:{ flexDirection: 'row', gap: 10 },
  dm:   { flex: 1, backgroundColor: Colors.backgroundAlt, borderRadius: 10, padding: 12, gap: 3 },
  dmVal:{ fontSize: 14, fontWeight: '800', color: Colors.primaryDark },
  dmLbl:{ fontSize: 10, color: Colors.textMuted },
});

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function RentabiliteScreen() {
  const insets     = useSafeAreaInsets();
  const { fullProfile } = useProfile();

  const [hectares,  setHectares]  = useState<number>(10);
  const [typeSol,   setTypeSol]   = useState<string>('limoneux');
  const [coords,    setCoords]    = useState<{ lat: number; lon: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  const [resultat,   setResultat]   = useState<RecommandationCulture[] | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [lastUpdate, setLastUpdate] = useState('');

  const [selectedIdx,    setSelectedIdx]    = useState<number | null>(null);
  const [conseil,        setConseil]        = useState<ConseilAgricole | null>(null);
  const [conseilLoading, setConseilLoading] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const [progressLabel, setProgressLabel] = useState('');
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const STEPS = [
    { at: 600,  to: 0.20, label: 'Analyse météo locale…' },
    { at: 2500, to: 0.45, label: 'Calcul des marges par culture…' },
    { at: 5000, to: 0.70, label: 'Évaluation des conditions de sol…' },
    { at: 7500, to: 0.88, label: 'Sélection du Top 3 IA…' },
  ];

  useEffect(() => {
    const surf    = fullProfile?.exploitation?.surface_ha;
    const commune = fullProfile?.exploitation?.commune ?? '';
    const cp      = fullProfile?.exploitation?.code_postal ?? '';
    if (surf) setHectares(surf);
    if (commune) {
      setGeocoding(true);
      geocodeCommune(commune, cp)
        .then(c => { if (c) setCoords({ lat: c.lat, lon: c.lon }); })
        .catch(() => {})
        .finally(() => setGeocoding(false));
    }
  }, [fullProfile]);

  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY).then(raw => {
      if (!raw) return;
      const { data, ts, surface, sol } = JSON.parse(raw);
      if (Date.now() - ts < CACHE_TTL) {
        setResultat(data);
        setLastUpdate(new Date(ts).toLocaleDateString('fr-FR'));
        if (surface) setHectares(surface);
        if (sol) setTypeSol(sol);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (loading) {
      progressAnim.setValue(0);
      setProgressLabel('Initialisation…');
      timersRef.current = STEPS.map(s =>
        setTimeout(() => {
          setProgressLabel(s.label);
          Animated.timing(progressAnim, { toValue: s.to, duration: 700, useNativeDriver: false }).start();
        }, s.at)
      );
    } else {
      timersRef.current.forEach(clearTimeout);
      Animated.timing(progressAnim, { toValue: 1, duration: 400, useNativeDriver: false })
        .start(() => setTimeout(() => progressAnim.setValue(0), 500));
    }
    return () => { timersRef.current.forEach(clearTimeout); };
  }, [loading]);

  const handleSimuler = useCallback(async () => {
    if (!coords)                      { setError('Commune introuvable — vérifiez votre profil.'); return; }
    if (!hectares || hectares <= 0)   { setError('Saisissez une surface valide.'); return; }
    setError(''); setResultat(null); setSelectedIdx(null); setConseil(null); setLoading(true);
    const req: RequeteTop3 = { hectares, type_sol: typeSol, latitude: coords.lat, longitude: coords.lon };
    try {
      const res = await fetchRecommandations(req);
      setResultat(res.cultures_validees);
      setLastUpdate(new Date().toLocaleDateString('fr-FR'));
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        data: res.cultures_validees, ts: Date.now(), surface: hectares, sol: typeSol,
      }));
    } catch (e: any) {
      setError(e?.message ?? 'Erreur inattendue. Vérifiez que le serveur est démarré.');
    } finally {
      setLoading(false);
    }
  }, [coords, hectares, typeSol]);

  const handleSelectCulture = useCallback(async (idx: number, culture: RecommandationCulture) => {
    if (selectedIdx === idx) { setSelectedIdx(null); setConseil(null); return; }
    setSelectedIdx(idx); setConseil(null);
    if (!coords) return;
    setConseilLoading(true);
    try {
      const res = await fetchConseil({
        hectares, type_sol: typeSol, latitude: coords.lat, longitude: coords.lon,
        culture: culture.nom_culture,
      });
      setConseil(res);
    } catch { /* silence */ } finally { setConseilLoading(false); }
  }, [selectedIdx, coords, hectares, typeSol]);

  const commune = fullProfile?.exploitation?.commune ?? '';

  return (
    <>
    <Head><title>Rentabilité — AgroPilot</title></Head>
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.container, { paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── HEADER ──────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 24 }]}>
        <Text style={s.headerTitle}>Simulateur de rentabilité</Text>
        <Text style={s.headerSub}>
          {commune ? `${commune} · ` : ''}{hectares > 0 ? `${hectares} ha` : 'Configurez votre exploitation'}
        </Text>
        {lastUpdate ? <Text style={s.headerDate}>Dernière simulation : {lastUpdate}</Text> : null}
      </View>

      {/* ─── FORMULAIRE ──────────────────────────────────────────────────── */}
      <View style={s.formCard}>
        <Text style={s.formTitle}>Paramètres de simulation</Text>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Surface exploitée (ha)</Text>
          <View style={s.stepperRow}>
            <TouchableOpacity style={s.stepBtn} onPress={() => setHectares(h => Math.max(1, Math.round(h - 5)))}>
              <Text style={s.stepBtnText}>−</Text>
            </TouchableOpacity>
            <View style={s.stepperVal}>
              <Text style={s.stepperValText}>{hectares} ha</Text>
            </View>
            <TouchableOpacity style={s.stepBtn} onPress={() => setHectares(h => Math.round(h + 5))}>
              <Text style={s.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Type de sol</Text>
          <PillSelect options={SOLS} value={typeSol} onChange={v => setTypeSol(v as string)} multi={false} />
        </View>

        <View style={s.locRow}>
          <Text style={s.locIcon}>{geocoding ? '⏳' : coords ? '📍' : '⚠️'}</Text>
          <Text style={s.locText}>
            {geocoding ? 'Géolocalisation en cours…'
              : coords ? commune || 'Localisation détectée'
              : 'Commune non configurée dans le profil'}
          </Text>
        </View>

        {!!error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}

        <TouchableOpacity
          style={[s.ctaBtn, (loading || geocoding || !coords) && s.ctaBtnDisabled]}
          onPress={handleSimuler}
          disabled={loading || geocoding || !coords}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.ctaBtnText}>🌾 Lancer la simulation IA</Text>
          }
        </TouchableOpacity>
      </View>

      {/* ─── PROGRESSION ─────────────────────────────────────────────────── */}
      {loading && (
        <View style={s.loadCard}>
          <Text style={s.loadTitle}>Analyse en cours…</Text>
          <Text style={s.loadLabel}>{progressLabel}</Text>
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, {
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }]} />
          </View>
          <Text style={s.loadNote}>Données météo + IA Gemini · environ 10 secondes</Text>
        </View>
      )}

      {/* ─── RÉSULTATS ───────────────────────────────────────────────────── */}
      {!loading && resultat && resultat.length > 0 && (
        <View style={s.results}>
          <Text style={s.resultsLabel}>TOP {resultat.length} CULTURES RECOMMANDÉES</Text>
          <Text style={s.resultsHint}>Appuyez sur une carte pour voir le conseil détaillé</Text>
          {resultat.map((item, idx) => (
            <CultureCard
              key={idx} item={item} index={idx}
              selected={selectedIdx === idx}
              conseil={selectedIdx === idx ? conseil : null}
              conseilLoading={selectedIdx === idx ? conseilLoading : false}
              onPress={() => handleSelectCulture(idx, item)}
            />
          ))}
        </View>
      )}

      {!loading && resultat && resultat.length === 0 && (
        <View style={s.emptyBlock}>
          <Text style={s.emptyIcon}>🌱</Text>
          <Text style={s.emptyTitle}>Aucune culture recommandée</Text>
          <Text style={s.emptyText}>
            Les conditions actuelles ne favorisent aucune culture de la base. Essayez un autre type de sol ou revenez dans quelques jours.
          </Text>
        </View>
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
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    gap: 6,
    marginBottom: 20,
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff' },
  headerSub:   { fontSize: 13, color: Colors.headerTextMuted },
  headerDate:  { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 },

  formCard: {
    marginHorizontal: 18, marginBottom: 16,
    backgroundColor: Colors.white, borderRadius: 20, padding: 22, gap: 18,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  formTitle:  { fontSize: 16, fontWeight: '800', color: Colors.primaryDark },
  field:      { gap: 10 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark },

  stepperRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn:        { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  stepBtnText:    { fontSize: 22, fontWeight: '700', color: Colors.primary },
  stepperVal:     { flex: 1, height: 44, backgroundColor: Colors.backgroundAlt, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepperValText: { fontSize: 18, fontWeight: '800', color: Colors.primaryDark },

  locRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.backgroundAlt, borderRadius: 10, padding: 12 },
  locIcon: { fontSize: 14 },
  locText: { fontSize: 13, color: Colors.textMuted, flex: 1 },

  errorBox:  { backgroundColor: Colors.errorBg, borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: Colors.error },
  errorText: { fontSize: 13, color: Colors.errorDark, lineHeight: 19 },

  ctaBtn:         { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaBtnDisabled: { backgroundColor: Colors.border },
  ctaBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },

  loadCard: {
    marginHorizontal: 18, marginBottom: 16,
    backgroundColor: Colors.white, borderRadius: 18, padding: 22, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  loadTitle:     { fontSize: 17, fontWeight: '800', color: Colors.primaryDark },
  loadLabel:     { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  progressTrack: { height: 8, backgroundColor: Colors.primaryBg, borderRadius: 4, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  loadNote:      { fontSize: 11, color: Colors.textMuted },

  results:     { paddingHorizontal: 18, gap: 12, marginBottom: 8 },
  resultsLabel:{ fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase' },
  resultsHint: { fontSize: 12, color: Colors.textMuted, marginTop: -4, marginBottom: 4 },

  emptyBlock: { marginHorizontal: 18, alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.primaryDark, textAlign: 'center' },
  emptyText:  { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 21 },
});
