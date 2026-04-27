/**
 * app/(app)/subventions.tsx — Aide à la subvention par IA
 *
 * Flow :
 *  1. Charge le profil via useProfile
 *  2. Sur appui "Analyser", envoie le profil à FastAPI (Tavily + Claude)
 *  3. Affiche les cartes d'éligibilité triées par score
 */
import { useState } from 'react';
import {
  Linking, ScrollView, StyleSheet, Text,
  TouchableOpacity, View, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '@/hooks/useProfile';
import { fetchSubventionSuggestions, SubventionCard } from '@/services/subventions.service';
import { Colors } from '@/constants/Colors';

// ─── Badges catégorie ─────────────────────────────────────────────────────────

const CATEGORIE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pac:           { label: 'PAC / UE',       color: '#1565C0', bg: '#E3F2FD' },
  national:      { label: 'National',       color: '#2E7D32', bg: '#E8F5E9' },
  regional:      { label: 'Régional',       color: '#6A1B9A', bg: '#F3E5F5' },
  certification: { label: 'Certification',  color: '#E65100', bg: '#FFF3E0' },
};

// ─── Composant carte ──────────────────────────────────────────────────────────

function SubventionCardView({ card }: { card: SubventionCard }) {
  const [open, setOpen] = useState(false);
  const cat = CATEGORIE_CONFIG[card.categorie] ?? CATEGORIE_CONFIG.national;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setOpen(v => !v)}
      activeOpacity={0.85}
    >
      {/* En-tête */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.catBadge, { backgroundColor: cat.bg }]}>
            <Text style={[styles.catBadgeText, { color: cat.color }]}>{cat.label}</Text>
          </View>
          <View style={styles.scoreDots}>
            {[1, 2, 3, 4, 5].map(i => (
              <View
                key={i}
                style={[styles.scoreDot, i <= card.score && styles.scoreDotActive]}
              />
            ))}
          </View>
        </View>
        <Text style={styles.cardChevron}>{open ? '▲' : '▼'}</Text>
      </View>

      <Text style={styles.cardTitle}>{card.nom}</Text>
      <Text style={styles.cardOrganisme}>{card.organisme}</Text>
      <Text style={styles.cardMontant}>{card.montant_label}</Text>

      {/* Détails dépliables */}
      {open && (
        <View style={styles.cardBody}>
          <View style={styles.cardDivider} />

          <Text style={styles.cardSectionLabel}>📋 Description</Text>
          <Text style={styles.cardText}>{card.description}</Text>

          <Text style={styles.cardSectionLabel}>✅ Pourquoi vous êtes éligible</Text>
          <Text style={[styles.cardText, styles.cardTextEligible]}>{card.pourquoi_eligible}</Text>

          <Text style={styles.cardSectionLabel}>📌 Démarches</Text>
          <Text style={styles.cardText}>{card.demarches}</Text>

          {card.url && (
            <TouchableOpacity
              style={styles.cardLink}
              onPress={() => Linking.openURL(card.url!)}
            >
              <Text style={styles.cardLinkText}>🔗 En savoir plus →</Text>
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

  const [cards, setCards]         = useState<SubventionCard[] | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError]         = useState('');

  const handleAnalyse = async () => {
    if (!fullProfile) return;
    setError('');
    setAnalysing(true);
    setCards(null);
    try {
      const results = await fetchSubventionSuggestions(fullProfile);
      setCards(results);
    } catch (e: any) {
      setError(e?.message ?? 'Une erreur est survenue.');
    } finally {
      setAnalysing(false);
    }
  };

  if (profileLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
      ]}
    >
      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Aides & Subventions</Text>
        <Text style={styles.subtitle}>
          L'IA analyse votre profil en temps réel pour identifier les aides auxquelles vous pouvez prétendre.
        </Text>
      </View>

      {/* ── Profil incomplet ─────────────────────────────────────────────── */}
      {!isComplete && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠️ Votre profil d'exploitation est incomplet. Complétez-le pour obtenir des suggestions personnalisées.
          </Text>
        </View>
      )}

      {/* ── CTA initial ──────────────────────────────────────────────────── */}
      {!analysing && !cards && (
        <View style={styles.cta}>
          <Text style={styles.ctaIcon}>🤖</Text>
          <Text style={styles.ctaTitle}>Analyse IA personnalisée</Text>
          <Text style={styles.ctaDesc}>
            Tavily recherche les aides 2024-2025 en temps réel.{'\n'}
            Claude croise avec votre profil et identifie vos éligibilités.
          </Text>

          <TouchableOpacity
            style={[styles.ctaBtn, !isComplete && styles.ctaBtnDisabled]}
            onPress={handleAnalyse}
            disabled={!isComplete}
          >
            <Text style={styles.ctaBtnText}>
              {isComplete ? '✨ Analyser mon profil' : 'Complétez votre profil d\'abord'}
            </Text>
          </TouchableOpacity>

          <View style={styles.tagRow}>
            {Object.values(CATEGORIE_CONFIG).map(c => (
              <View key={c.label} style={[styles.tag, { backgroundColor: c.bg }]}>
                <Text style={[styles.tagText, { color: c.color }]}>{c.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {analysing && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 20 }} />
          <Text style={styles.loadingTitle}>Analyse en cours…</Text>
          <Text style={styles.loadingStep}>🔍 Recherche des aides récentes (Tavily)</Text>
          <Text style={styles.loadingStep}>🤖 Analyse d'éligibilité (Claude)</Text>
          <Text style={styles.loadingStep}>📋 Génération des cartes personnalisées</Text>
          <Text style={styles.loadingNote}>Cela peut prendre 15 à 30 secondes.</Text>
        </View>
      )}

      {/* ── Erreur ────────────────────────────────────────────────────────── */}
      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleAnalyse}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Résultats ─────────────────────────────────────────────────────── */}
      {cards && (
        <View>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>
              {cards.length} aide{cards.length > 1 ? 's' : ''} identifiée{cards.length > 1 ? 's' : ''}
            </Text>
            <TouchableOpacity onPress={handleAnalyse}>
              <Text style={styles.refreshBtn}>↻ Actualiser</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.resultsHint}>
            Appuyez sur une carte pour voir les détails et les démarches.
          </Text>

          {cards.map((card, i) => (
            <SubventionCardView key={i} card={card} />
          ))}

          <Text style={styles.disclaimer}>
            ⚡ Ces suggestions sont générées par IA à titre informatif. Vérifiez votre éligibilité auprès des organismes concernés avant toute démarche.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.white },
  container: { paddingHorizontal: 20 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:   { marginBottom: 20 },
  title:    { fontSize: 26, fontWeight: '800', color: Colors.primaryDark },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 6, lineHeight: 19 },

  warningBox:  { backgroundColor: Colors.warningBg, borderRadius: 10, padding: 14, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: Colors.warning },
  warningText: { fontSize: 13, color: '#7B5800', lineHeight: 19 },

  cta:            { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 8 },
  ctaIcon:        { fontSize: 52, marginBottom: 12 },
  ctaTitle:       { fontSize: 18, fontWeight: '700', color: Colors.primaryDark, marginBottom: 10 },
  ctaDesc:        { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  ctaBtn:         { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: 20 },
  ctaBtnDisabled: { backgroundColor: Colors.border },
  ctaBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  tagRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  tag:            { borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12 },
  tagText:        { fontSize: 11, fontWeight: '600' },

  loadingBox:    { alignItems: 'center', paddingVertical: 40 },
  loadingTitle:  { fontSize: 16, fontWeight: '700', color: Colors.primaryDark, marginBottom: 20 },
  loadingStep:   { fontSize: 13, color: Colors.textMuted, marginBottom: 8 },
  loadingNote:   { fontSize: 12, color: Colors.textMuted, marginTop: 16, fontStyle: 'italic' },

  errorBox:     { backgroundColor: Colors.errorBg, borderRadius: 10, padding: 16, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: Colors.error },
  errorText:    { fontSize: 13, color: Colors.errorDark, lineHeight: 19, marginBottom: 12 },
  retryBtn:     { alignSelf: 'flex-start', backgroundColor: Colors.error, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  retryBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  resultsTitle:  { fontSize: 16, fontWeight: '700', color: Colors.primaryDark },
  refreshBtn:    { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  resultsHint:   { fontSize: 12, color: Colors.textMuted, marginBottom: 16 },
  disclaimer:    { fontSize: 11, color: Colors.textMuted, marginTop: 20, lineHeight: 17, fontStyle: 'italic', textAlign: 'center' },

  card:            { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardHeaderLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catBadge:        { borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10 },
  catBadgeText:    { fontSize: 11, fontWeight: '700' },
  scoreDots:       { flexDirection: 'row', gap: 3 },
  scoreDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  scoreDotActive:  { backgroundColor: Colors.primary },
  cardChevron:     { fontSize: 11, color: Colors.textMuted },
  cardTitle:       { fontSize: 15, fontWeight: '700', color: Colors.primaryDark, marginBottom: 3 },
  cardOrganisme:   { fontSize: 12, color: Colors.textMuted, marginBottom: 6 },
  cardMontant:     { fontSize: 14, fontWeight: '600', color: Colors.primary },
  cardBody:        { marginTop: 12 },
  cardDivider:     { height: 1, backgroundColor: Colors.border, marginBottom: 14 },
  cardSectionLabel:{ fontSize: 12, fontWeight: '700', color: Colors.primaryDark, marginBottom: 4, marginTop: 10 },
  cardText:        { fontSize: 13, color: Colors.text, lineHeight: 19 },
  cardTextEligible:{ color: Colors.primaryDark, backgroundColor: Colors.primaryBg, borderRadius: 8, padding: 10, overflow: 'hidden' },
  cardLink:        { marginTop: 14, backgroundColor: Colors.primaryBg, borderRadius: 10, padding: 12, alignItems: 'center' },
  cardLinkText:    { fontSize: 13, fontWeight: '700', color: Colors.primary },
});
