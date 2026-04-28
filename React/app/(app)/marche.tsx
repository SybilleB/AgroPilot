/**
 * app/(app)/marche.tsx — Marchés & Analyse IA
 *
 * Fonctionnalités :
 *  - Prix en temps réel des cultures de l'exploitant (MATIF via Tavily + Gemini)
 *  - Analyse IA personnalisée : synthèse, recommandations, opportunités, risques
 *  - Actualités agricoles filtrées pour le profil
 *  - Recherche libre : n'importe quelle question marché/concurrence/intrants
 */
import { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator, Animated, Keyboard, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Head from 'expo-router/head';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '@/hooks/useProfile';
import {
  fetchMarcheAnalyse, fetchMarcheRecherche,
  MarcheAnalyse, RechercheResultat, Recommandation, Actualite, PrixCulture,
} from '@/services/marche.service';
import { Colors } from '@/constants/Colors';

const CACHE_KEY = 'agropilot_marche_cache';

// ─── Composants ───────────────────────────────────────────────────────────────

function PrixPill({ item }: { item: PrixCulture }) {
  const isHausse = item.tendance === 'hausse';
  const isBaisse = item.tendance === 'baisse';
  const color = isHausse ? '#1A7A2A' : isBaisse ? Colors.error : Colors.textMuted;
  const bg    = isHausse ? '#E8F5E9' : isBaisse ? Colors.errorBg : Colors.backgroundAlt;
  const arrow = isHausse ? '↑' : isBaisse ? '↓' : '→';

  return (
    <View style={[pp.pill, { backgroundColor: bg }]}>
      <Text style={[pp.culture, { color: Colors.primaryDark }]}>{item.culture}</Text>
      <Text style={[pp.prix, { color }]}>{item.prix_actuel ?? '—'}</Text>
      {item.variation && (
        <Text style={[pp.variation, { color }]}>{arrow} {item.variation}</Text>
      )}
    </View>
  );
}

const pp = StyleSheet.create({
  pill:      { borderRadius: 14, padding: 14, minWidth: 130, gap: 4 },
  culture:   { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
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
    <TouchableOpacity
      style={ac.card}
      onPress={() => item.url && Linking.openURL(item.url)}
      activeOpacity={item.url ? 0.8 : 1}
    >
      {item.importance === 'haute' && (
        <View style={ac.importanceBadge}>
          <Text style={ac.importanceText}>À la une</Text>
        </View>
      )}
      <Text style={ac.titre}>{item.titre}</Text>
      <Text style={ac.resume}>{item.resume}</Text>
      {item.source && <Text style={ac.source}>{item.source}{item.url ? ' →' : ''}</Text>}
    </TouchableOpacity>
  );
}

const ac = StyleSheet.create({
  card:            { backgroundColor: Colors.white, borderRadius: 14, padding: 16, gap: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  importanceBadge: { alignSelf: 'flex-start', backgroundColor: '#FFF3E0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  importanceText:  { fontSize: 10, fontWeight: '700', color: '#E65100' },
  titre:           { fontSize: 14, fontWeight: '700', color: Colors.primaryDark, lineHeight: 20 },
  resume:          { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  source:          { fontSize: 11, color: Colors.primary, fontWeight: '600' },
});

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function MarcheScreen() {
  const insets = useSafeAreaInsets();
  const { fullProfile, isComplete } = useProfile();

  const [analyse,   setAnalyse]   = useState<MarcheAnalyse | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  // Recherche libre
  const [question,  setQuestion]  = useState('');
  const [searching, setSearching] = useState(false);
  const [resultat,  setResultat]  = useState<RechercheResultat | null>(null);
  const [searchErr, setSearchErr] = useState('');

  // Barre de progression
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [progressLabel, setProgressLabel] = useState('');
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const STEPS = [
    { at: 500,  to: 0.15, label: 'Collecte des prix MATIF…' },
    { at: 2000, to: 0.38, label: 'Recherche des actualités…' },
    { at: 4000, to: 0.60, label: 'Analyse des tendances marché…' },
    { at: 6500, to: 0.80, label: 'Génération des recommandations…' },
    { at: 9000, to: 0.92, label: 'Finalisation de l\'analyse…' },
  ];

  useEffect(() => {
    if (loading) {
      progressAnim.setValue(0);
      setProgressLabel('Initialisation…');
      timersRef.current = STEPS.map(s =>
        setTimeout(() => {
          setProgressLabel(s.label);
          Animated.timing(progressAnim, { toValue: s.to, duration: 800, useNativeDriver: false }).start();
        }, s.at)
      );
    } else {
      timersRef.current.forEach(clearTimeout);
      Animated.timing(progressAnim, { toValue: 1, duration: 400, useNativeDriver: false })
        .start(() => setTimeout(() => progressAnim.setValue(0), 600));
    }
    return () => { timersRef.current.forEach(clearTimeout); };
  }, [loading]);

  // Charger le cache au démarrage
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY).then(raw => {
      if (raw) setAnalyse(JSON.parse(raw));
    }).catch(() => {});
  }, []);

  const buildRequest = () => {
    const e = fullProfile?.exploitation;
    const cultures = fullProfile?.cultures?.map(c => c.type_culture) ?? [];
    return {
      cultures,
      type_exploitation:  e?.type_exploitation   ?? undefined,
      methode_production: e?.methode_production   ?? undefined,
      region:             e?.region               ?? undefined,
      departement:        e?.departement          ?? undefined,
      surface_ha:         e?.surface_ha           ?? undefined,
    };
  };

  const handleAnalyse = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await fetchMarcheAnalyse(buildRequest());
      setAnalyse(result);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(result));
    } catch (e: any) {
      setError(e?.message ?? 'Erreur inattendue.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecherche = async () => {
    if (!question.trim()) return;
    Keyboard.dismiss();
    setSearchErr('');
    setResultat(null);
    setSearching(true);
    try {
      const req = buildRequest();
      const result = await fetchMarcheRecherche({
        question: question.trim(),
        cultures: req.cultures,
        region:   req.region,
      });
      setResultat(result);
    } catch (e: any) {
      setSearchErr(e?.message ?? 'Erreur inattendue.');
    } finally {
      setSearching(false);
    }
  };

  // ─── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <>
    <Head><title>Marchés — AgroPilot</title></Head>
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.container, { paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 24 }]}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.headerTitle}>Marchés agricoles</Text>
            <Text style={s.headerSub}>
              {analyse
                ? `Mis à jour le ${analyse.horodatage}`
                : 'Analyse IA en temps réel'}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.refreshBtn, loading && s.refreshBtnDisabled]}
            onPress={handleAnalyse}
            disabled={loading}
          >
            <Text style={s.refreshBtnText}>{loading ? '…' : analyse ? '↻' : 'Analyser'}</Text>
          </TouchableOpacity>
        </View>

        {/* Prix pills — scroll horizontal */}
        {analyse?.prix && analyse.prix.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.prixScroll} contentContainerStyle={s.prixRow}>
            {analyse.prix.map((p, i) => <PrixPill key={i} item={p} />)}
          </ScrollView>
        )}
      </View>

      {/* ─── BARRE DE PROGRESSION ───────────────────────────────────────── */}
      {loading && (
        <View style={s.loadingBox}>
          <Text style={s.loadingTitle}>Analyse en cours…</Text>
          <Text style={s.loadingLabel}>{progressLabel}</Text>
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, {
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }]} />
          </View>
          <Text style={s.loadingNote}>Tavily + Gemini analysent les marchés en temps réel</Text>
        </View>
      )}

      {/* ─── ERREUR ─────────────────────────────────────────────────────── */}
      {!!error && (
        <View style={s.errorBox}>
          <Text style={s.errorTitle}>Erreur</Text>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={handleAnalyse}>
            <Text style={s.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── ÉTAT VIDE (pas encore d'analyse) ───────────────────────────── */}
      {!loading && !analyse && !error && (
        <View style={s.emptyBlock}>
          <View style={s.emptyIcon}><Text style={s.emptyIconText}>📊</Text></View>
          <Text style={s.emptyTitle}>Votre veille marché personnalisée</Text>
          <Text style={s.emptyBody}>
            Prix MATIF en temps réel pour vos cultures, recommandations concrètes,
            actualités filtrées et alertes sur vos risques — générés par IA à partir de votre profil.
          </Text>
          {!isComplete && (
            <View style={s.warningBox}>
              <Text style={s.warningText}>
                Complétez votre profil pour une analyse sur-mesure (cultures, région, surface).
              </Text>
            </View>
          )}
          <TouchableOpacity style={s.ctaBtn} onPress={handleAnalyse}>
            <Text style={s.ctaBtnText}>Lancer l'analyse</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── SYNTHÈSE ───────────────────────────────────────────────────── */}
      {analyse?.synthese && !loading && (
        <View style={s.syntheseCard}>
          <Text style={s.sectionEyebrow}>SYNTHÈSE DU MARCHÉ</Text>
          <Text style={s.syntheseText}>{analyse.synthese}</Text>
        </View>
      )}

      {/* ─── RECOMMANDATIONS ────────────────────────────────────────────── */}
      {analyse?.recommandations && analyse.recommandations.length > 0 && !loading && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>RECOMMANDATIONS IA</Text>
          <View style={s.recoList}>
            {analyse.recommandations.map((r, i) => (
              <RecoCard key={i} item={r} index={i} />
            ))}
          </View>
        </View>
      )}

      {/* ─── OPPORTUNITÉS & RISQUES ─────────────────────────────────────── */}
      {analyse && !loading && (
        <View style={s.orRow}>
          {analyse.opportunites?.length > 0 && (
            <View style={[s.orCard, s.orCardGreen]}>
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
            <View style={[s.orCard, s.orCardRed]}>
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

      {/* ─── ACTUALITÉS ─────────────────────────────────────────────────── */}
      {analyse?.actualites && analyse.actualites.length > 0 && !loading && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>ACTUALITÉS AGRICOLES</Text>
          <View style={s.actuList}>
            {analyse.actualites.map((a, i) => <ActuCard key={i} item={a} />)}
          </View>
        </View>
      )}

      {/* ─── RECHERCHE LIBRE ────────────────────────────────────────────── */}
      <View style={s.searchSection}>
        <Text style={s.sectionLabel}>POSEZ VOTRE QUESTION</Text>
        <Text style={s.searchHint}>
          Prix d'un intrant, débouchés, concurrents, réglementation, tendances export…
        </Text>
        <View style={s.searchBar}>
          <TextInput
            style={s.searchInput}
            placeholder="Ex : quel est le prix actuel de l'urée ?"
            placeholderTextColor={Colors.textPlaceholder}
            value={question}
            onChangeText={setQuestion}
            onSubmitEditing={handleRecherche}
            returnKeyType="search"
            multiline={false}
          />
          <TouchableOpacity
            style={[s.searchBtn, (!question.trim() || searching) && s.searchBtnDisabled]}
            onPress={handleRecherche}
            disabled={!question.trim() || searching}
          >
            {searching
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.searchBtnText}>→</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Questions suggérées */}
        {!resultat && !searching && (
          <View style={s.suggestRow}>
            {[
              'Prix engrais azotés aujourd\'hui',
              'Tendance export blé France',
              'Coût GNR agricole',
              'Marché colza Europe',
            ].map(q => (
              <TouchableOpacity key={q} style={s.suggestPill} onPress={() => setQuestion(q)}>
                <Text style={s.suggestText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Chargement recherche */}
        {searching && (
          <View style={s.searchLoading}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={s.searchLoadingText}>Recherche en cours…</Text>
          </View>
        )}

        {/* Erreur recherche */}
        {!!searchErr && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{searchErr}</Text>
          </View>
        )}

        {/* Résultat recherche */}
        {resultat && !searching && (
          <View style={s.resultatCard}>
            <Text style={s.resultatQuestion}>« {resultat.question} »</Text>
            <Text style={s.resultatReponse}>{resultat.reponse}</Text>
            {resultat.sources?.length > 0 && (
              <View style={s.sourcesList}>
                <Text style={s.sourcesLabel}>Sources</Text>
                {resultat.sources.filter(src => src.url).map((src, i) => (
                  <TouchableOpacity key={i} onPress={() => Linking.openURL(src.url)}>
                    <Text style={s.sourceLink}>{src.titre || src.url}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity style={s.clearBtn} onPress={() => { setResultat(null); setQuestion(''); }}>
              <Text style={s.clearBtnText}>Nouvelle recherche</Text>
            </TouchableOpacity>
          </View>
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

  // Header
  header: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: 22,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    gap: 18,
    marginBottom: 20,
  },
  headerTop:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle:        { fontSize: 24, fontWeight: '900', color: '#fff' },
  headerSub:          { fontSize: 12, color: Colors.headerTextMuted, marginTop: 3 },
  refreshBtn:         { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  refreshBtnDisabled: { opacity: 0.5 },
  refreshBtnText:     { color: '#fff', fontSize: 14, fontWeight: '700' },

  prixScroll: { marginHorizontal: -22 },
  prixRow:    { paddingHorizontal: 22, gap: 10, flexDirection: 'row' },

  // Loading
  loadingBox: {
    marginHorizontal: 22, marginBottom: 16,
    backgroundColor: Colors.white, borderRadius: 18, padding: 24, gap: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  loadingTitle:  { fontSize: 17, fontWeight: '800', color: Colors.primaryDark },
  loadingLabel:  { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  progressTrack: { height: 8, backgroundColor: Colors.primaryBg, borderRadius: 4, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  loadingNote:   { fontSize: 12, color: Colors.textMuted },

  // Erreur
  errorBox:   { marginHorizontal: 22, backgroundColor: Colors.errorBg, borderRadius: 12, padding: 16, borderLeftWidth: 3, borderLeftColor: Colors.error, gap: 8, marginBottom: 16 },
  errorTitle: { fontSize: 14, fontWeight: '700', color: Colors.errorDark },
  errorText:  { fontSize: 13, color: Colors.errorDark, lineHeight: 19 },
  retryBtn:   { alignSelf: 'flex-start', backgroundColor: Colors.error, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  retryText:  { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Vide
  emptyBlock: { marginHorizontal: 22, alignItems: 'center', paddingVertical: 20, gap: 14 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  emptyIconText: { fontSize: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.primaryDark, textAlign: 'center' },
  emptyBody:  { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  warningBox: { backgroundColor: Colors.warningBg, borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: Colors.warning, alignSelf: 'stretch' },
  warningText:{ fontSize: 13, color: '#7B5800', lineHeight: 19 },
  ctaBtn:     { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, marginTop: 4 },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Synthèse
  syntheseCard: {
    marginHorizontal: 22, marginBottom: 20,
    backgroundColor: Colors.aiCardBg,
    borderRadius: 16, borderLeftWidth: 4, borderLeftColor: Colors.aiCardBorder,
    padding: 20, gap: 10,
  },
  sectionEyebrow: { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase' },
  syntheseText:   { fontSize: 14, color: Colors.primaryDark, lineHeight: 22 },

  // Sections génériques
  section:      { marginHorizontal: 22, marginBottom: 20, gap: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase', marginHorizontal: 22, marginBottom: 10 },
  recoList:     { gap: 10 },
  actuList:     { gap: 10 },

  // Opportunités / Risques
  orRow:      { flexDirection: 'row', marginHorizontal: 22, gap: 12, marginBottom: 20 },
  orCard:     { flex: 1, borderRadius: 14, padding: 16, gap: 10 },
  orCardGreen:{ backgroundColor: '#E8F5E9' },
  orCardRed:  { backgroundColor: '#FFEBEE' },
  orLabel:    { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: Colors.textMuted },
  orItem:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  orDot:      { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  orText:     { fontSize: 12, color: Colors.text, lineHeight: 18, flex: 1 },

  // Recherche libre
  searchSection: { marginHorizontal: 22, marginBottom: 20, gap: 12 },
  searchHint:    { fontSize: 13, color: Colors.textMuted, marginTop: -4 },
  searchBar:     { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchInput:   {
    flex: 1, backgroundColor: Colors.white, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 14, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchBtn:         { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  searchBtnDisabled: { backgroundColor: Colors.border },
  searchBtnText:     { color: '#fff', fontSize: 20, fontWeight: '700' },

  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestPill:{ backgroundColor: Colors.white, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border },
  suggestText:{ fontSize: 12, color: Colors.textMuted, fontWeight: '500' },

  searchLoading:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  searchLoadingText: { fontSize: 14, color: Colors.textMuted },

  // Résultat recherche
  resultatCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 20, gap: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  resultatQuestion: { fontSize: 14, fontWeight: '700', color: Colors.primary, fontStyle: 'italic' },
  resultatReponse:  { fontSize: 14, color: Colors.text, lineHeight: 22 },
  sourcesList:      { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, gap: 6 },
  sourcesLabel:     { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  sourceLink:       { fontSize: 12, color: Colors.primary, lineHeight: 18 },
  clearBtn:         { alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  clearBtnText:     { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
});
