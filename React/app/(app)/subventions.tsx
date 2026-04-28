/**
 * app/(app)/subventions.tsx — Aide à la subvention par IA
 */
import { useState, useEffect, useRef } from 'react';
import {
  Animated, ActivityIndicator, Linking, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import du cache
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '@/hooks/useProfile';
import { fetchSubventionSuggestions, SubventionCard } from '@/services/subventions.service';
import { Colors } from '@/constants/Colors';
import Head from 'expo-router/head';

// Clé unique pour le stockage local
const CACHE_KEY = 'agropilot_subventions_cache';

// ─── Badges catégorie ─────────────────────────────────────────────────────────
const CATEGORIE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pac: { label: 'PAC / UE', color: '#1565C0', bg: '#E3F2FD' },
  national: { label: 'National', color: '#2D6A0A', bg: '#E8EFD8' },
  regional: { label: 'Régional', color: '#6A1B9A', bg: '#F3E5F5' },
  certification: { label: 'Certification', color: '#D65100', bg: '#FFF0E0' },
};

// ─── Composant carte subvention ───────────────────────────────────────────────
function SubventionCardView({ card }: { card: SubventionCard }) {
  const [open, setOpen] = useState(false);
  const cat = CATEGORIE_CONFIG[card.categorie] ?? CATEGORIE_CONFIG.national;

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => setOpen(v => !v)}
      activeOpacity={0.85}
    >
      <View style={s.cardHeader}>
        <View style={s.cardHeaderLeft}>
          <View style={[s.catBadge, { backgroundColor: cat.bg }]}>
            <Text style={[s.catBadgeText, { color: cat.color }]}>{cat.label}</Text>
          </View>
          <View style={s.scoreDots}>
            {[1, 2, 3, 4, 5].map(i => (
              <View
                key={i}
                style={[s.scoreDot, i <= card.score && s.scoreDotActive]}
              />
            ))}
          </View>
        </View>
        <Text style={s.cardChevron}>{open ? '▲' : '▼'}</Text>
      </View>

      <Text style={s.cardTitle}>{card.nom}</Text>
      <Text style={s.cardOrganisme}>{card.organisme}</Text>
      <Text style={s.cardMontant}>{card.montant_label}</Text>

      {open && (
        <View style={s.cardBody}>
          <View style={s.cardDivider} />
          <Text style={s.cardSectionLabel}>Description</Text>
          <Text style={s.cardText}>{card.description}</Text>
          <Text style={s.cardSectionLabel}>Pourquoi vous êtes éligible</Text>
          <View style={s.eligibleBlock}>
            <Text style={s.cardTextEligible}>{card.pourquoi_eligible}</Text>
          </View>
          <Text style={s.cardSectionLabel}>Démarches</Text>
          <Text style={s.cardText}>{card.demarches}</Text>
          {card.url && (
            <TouchableOpacity
              style={s.cardLink}
              onPress={() => Linking.openURL(card.url!)}
            >
              <Text style={s.cardLinkText}>En savoir plus →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────
export default function SubventionsScreen() {
  const insets = useSafeAreaInsets();
  const { fullProfile, loading: profileLoading, isComplete } = useProfile();

  const [cards, setCards] = useState<SubventionCard[] | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState('');

  // ── Barre de progression ──────────────────────────────────────────────────────
  const progressAnim  = useRef(new Animated.Value(0)).current;
  const [progressLabel, setProgressLabel] = useState('');
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const STEPS = [
    { at: 400,  to: 0.12, label: 'Lecture de votre profil…' },
    { at: 1400, to: 0.35, label: 'Recherche des aides PAC 2024-2025…' },
    { at: 3000, to: 0.58, label: 'Analyse des aides régionales…' },
    { at: 5000, to: 0.78, label: 'Calcul de vos éligibilités…' },
    { at: 7500, to: 0.90, label: 'Finalisation des résultats…' },
  ];

  useEffect(() => {
    if (analysing) {
      progressAnim.setValue(0);
      setProgressLabel('Initialisation…');
      timersRef.current = STEPS.map(s =>
        setTimeout(() => {
          setProgressLabel(s.label);
          Animated.timing(progressAnim, {
            toValue: s.to,
            duration: 700,
            useNativeDriver: false,
          }).start();
        }, s.at)
      );
    } else {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: false,
      }).start(() => setTimeout(() => progressAnim.setValue(0), 600));
    }
    return () => { timersRef.current.forEach(clearTimeout); };
  }, [analysing]);

  // 1. CHARGEMENT DU CACHE AU DÉMARRAGE
  useEffect(() => {
    const loadCache = async () => {
      try {
        const savedData = await AsyncStorage.getItem(CACHE_KEY);
        if (savedData) {
          console.log("📦 [Cache] Données trouvées, affichage immédiat.");
          setCards(JSON.parse(savedData));
        }
      } catch (e) {
        console.error("Erreur lecture cache", e);
      }
    };
    loadCache();
  }, []);

  const handleAnalyse = async () => {
    if (!fullProfile) return;
    setError('');
    setAnalysing(true);
    // On ne met pas setCards(null) ici pour laisser l'ancien cache visible pendant le chargement
    try {
      const results = await fetchSubventionSuggestions(fullProfile);
      setCards(results);

      // 2. SAUVEGARDE DANS LE CACHE
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(results));
      console.log("✅ [Cache] Sauvegarde des nouveaux résultats réussie.");

    } catch (e: any) {
      setError(e?.message ?? 'Une erreur est survenue.');
    } finally {
      setAnalysing(false);
    }
  };

  if (profileLoading) {
    return (
      <View style={s.loadScreen}>
        <View style={[s.header, { paddingTop: insets.top + 24 }]}>
          <Text style={s.headerTitle}>Aides & Subventions</Text>
        </View>
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <>
    <Head><title>Subventions — AgroPilot</title></Head>
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.container, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[s.header, { paddingTop: insets.top + 24 }]}>
        <Text style={s.headerTitle}>Aides & Subventions</Text>
        <Text style={s.headerSub}>
          L'IA analyse votre profil pour identifier les aides auxquelles vous pouvez prétendre.
        </Text>
        <View style={s.tagRow}>
          {Object.values(CATEGORIE_CONFIG).map(c => (
            <View key={c.label} style={[s.tag, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
              <Text style={s.tagText}>{c.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {!isComplete && (
        <View style={s.warningBox}>
          <Text style={s.warningText}>
            Votre profil d'exploitation est incomplet. Complétez-le pour obtenir des suggestions personnalisées.
          </Text>
        </View>
      )}

      {/* On n'affiche le CTA initial que si on n'a ni résultats ni analyse en cours */}
      {!analysing && !cards && (
        <View style={s.ctaBlock}>
          <View style={s.aiCard}>
            <Text style={s.aiLabel}>ANALYSE IA</Text>
            <Text style={s.aiTitle}>Trouvez vos aides en 30 secondes</Text>
            <Text style={s.aiBody}>
              Tavily recherche les aides 2024-2025 en temps réel. Gemini 3.1 Flash Lite identifie vos éligibilités.
            </Text>
          </View>
          <TouchableOpacity
            style={[s.ctaBtn, !isComplete && s.ctaBtnDisabled]}
            onPress={handleAnalyse}
            disabled={!isComplete}
          >
            <Text style={s.ctaBtnText}>
              {isComplete ? 'Analyser mon profil' : 'Profil incomplet'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {analysing && (
        <View style={s.loadingBox}>
          <Text style={s.loadingTitle}>Analyse IA en cours…</Text>
          <Text style={s.loadingLabel}>{progressLabel}</Text>

          {/* Barre de progression */}
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, {
              width: progressAnim.interpolate({
                inputRange:  [0, 1],
                outputRange: ['0%', '100%'],
              }),
            }]} />
          </View>

          {/* Étapes */}
          <View style={s.stepsRow}>
            {STEPS.map((step, i) => (
              <View key={i} style={s.stepDot}>
                <Animated.View style={[s.stepDotInner, {
                  backgroundColor: progressAnim.interpolate({
                    inputRange:  [Math.max(0, step.to - 0.01), step.to],
                    outputRange: [Colors.border, Colors.primary],
                    extrapolate: 'clamp',
                  }),
                }]} />
              </View>
            ))}
          </View>

          <Text style={s.loadingNote}>
            Gemini analyse vos données en temps réel — cela prend environ 10 secondes
          </Text>
        </View>
      )}

      {!!error && (
        <View style={s.errorBox}>
          <Text style={s.errorTitle}>Une erreur est survenue</Text>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={handleAnalyse}>
            <Text style={s.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {cards && (
        <View style={s.resultsBlock}>
          <View style={s.resultsHeader}>
            <View>
              <Text style={s.resultsTitle}>
                {cards.length} aide{cards.length > 1 ? 's' : ''} identifiée{cards.length > 1 ? 's' : ''}
              </Text>
              <Text style={s.resultsHint}>Données sauvegardées localement</Text>
            </View>
            <TouchableOpacity style={s.refreshBtn} onPress={handleAnalyse}>
              <Text style={s.refreshBtnText}>{analysing ? "..." : "Actualiser"}</Text>
            </TouchableOpacity>
          </View>

          {cards.map((card, i) => (
            <SubventionCardView key={i} card={card} />
          ))}
        </View>
      )}
    </ScrollView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { paddingHorizontal: 0 },
  loadScreen: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },

  // Header
  header: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: 22,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    gap: 10,
    marginBottom: 22,
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 13, color: Colors.headerTextMuted, lineHeight: 20 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tag: { borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12 },
  tagText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },

  // Warning
  warningBox: { marginHorizontal: 22, marginBottom: 18, backgroundColor: Colors.warningBg, borderRadius: 12, padding: 16, borderLeftWidth: 3, borderLeftColor: Colors.warning },
  warningText: { fontSize: 13, color: '#7B5800', lineHeight: 19 },

  // CTA block
  ctaBlock: { paddingHorizontal: 22, gap: 16 },

  // Bloc IA
  aiCard: {
    backgroundColor: Colors.aiCardBg,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.aiCardBorder,
    padding: 20,
    gap: 8,
  },
  aiLabel: { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase' },
  aiTitle: { fontSize: 18, fontWeight: '800', color: Colors.primaryDark },
  aiBody: { fontSize: 14, color: Colors.textMuted, lineHeight: 20 },

  // Steps
  stepsBlock: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, gap: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  stepsTitle: { fontSize: 14, fontWeight: '700', color: Colors.primaryDark, marginBottom: 2 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  stepText: { flex: 1, fontSize: 13, color: Colors.textMuted, lineHeight: 19 },

  // CTA btn
  ctaBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  ctaBtnDisabled: { backgroundColor: Colors.border },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Loading
  loadingBox: {
    marginHorizontal: 22,
    marginTop: 8,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 28,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  loadingTitle: { fontSize: 18, fontWeight: '800', color: Colors.primaryDark },
  loadingLabel: { fontSize: 13, color: Colors.primary, fontWeight: '600', minHeight: 18 },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.primaryBg,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  stepDot: { alignItems: 'center' },
  stepDotInner: { width: 8, height: 8, borderRadius: 4 },
  loadingNote: { fontSize: 12, color: Colors.textMuted, lineHeight: 18 },

  // Error
  errorBox: { marginHorizontal: 22, backgroundColor: Colors.errorBg, borderRadius: 12, padding: 18, borderLeftWidth: 3, borderLeftColor: Colors.error, gap: 8 },
  errorTitle: { fontSize: 15, fontWeight: '700', color: Colors.errorDark },
  errorText: { fontSize: 13, color: Colors.errorDark, lineHeight: 19 },
  retryBtn: { alignSelf: 'flex-start', backgroundColor: Colors.error, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 18, marginTop: 4 },
  retryBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Results
  resultsBlock: { paddingHorizontal: 22 },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  resultsTitle: { fontSize: 18, fontWeight: '800', color: Colors.primaryDark },
  resultsHint: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  refreshBtn: { backgroundColor: Colors.primaryBg, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  refreshBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '700' },
  disclaimer: { fontSize: 11, color: Colors.textMuted, marginTop: 20, lineHeight: 17, fontStyle: 'italic', textAlign: 'center' },

  // Card subvention
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catBadge: { borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10 },
  catBadgeText: { fontSize: 11, fontWeight: '700' },
  scoreDots: { flexDirection: 'row', gap: 3 },
  scoreDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  scoreDotActive: { backgroundColor: Colors.primary },
  cardChevron: { fontSize: 11, color: Colors.textMuted },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.primaryDark, marginBottom: 3 },
  cardOrganisme: { fontSize: 12, color: Colors.textMuted, marginBottom: 6 },
  cardMontant: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  cardBody: { marginTop: 14 },
  cardDivider: { height: 1, backgroundColor: Colors.border, marginBottom: 14 },
  cardSectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.primaryDark, marginBottom: 6, marginTop: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  cardText: { fontSize: 13, color: Colors.text, lineHeight: 20 },
  eligibleBlock: { backgroundColor: Colors.primaryBg, borderRadius: 10, padding: 12 },
  cardTextEligible: { fontSize: 13, color: Colors.primaryDark, lineHeight: 20 },
  cardLink: { marginTop: 14, backgroundColor: Colors.primaryBg, borderRadius: 12, padding: 13, alignItems: 'center' },
  cardLinkText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
});
