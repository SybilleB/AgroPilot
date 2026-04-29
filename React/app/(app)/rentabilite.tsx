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

const CULTURES_LIST = [
  { value: 'ble_tendre',     label: 'Blé tendre'  },
  { value: 'ble_dur',        label: 'Blé dur'     },
  { value: 'mais',           label: 'Maïs'        },
  { value: 'colza',          label: 'Colza'       },
  { value: 'tournesol',      label: 'Tournesol'   },
  { value: 'orge',           label: 'Orge'        },
  { value: 'soja',           label: 'Soja'        },
  { value: 'pois',           label: 'Pois'        },
  { value: 'betterave',      label: 'Betterave'   },
  { value: 'pomme_de_terre', label: 'Pomme de terre' },
  { value: 'lin',            label: 'Lin'         },
  { value: 'prairie',        label: 'Prairie'     },
];

const MODES_PROD = [
  { value: 'conventionnel', label: 'Conventionnel' },
  { value: 'raisonne',      label: 'Raisonné'      },
  { value: 'bio',           label: 'Bio'           },
];

const MODES_VENTE = [
  { value: 'cooperative',   label: 'Coopérative'   },
  { value: 'negoce',        label: 'Négoce'        },
  { value: 'circuit_court', label: 'Circuit court' },
  { value: 'contrat',       label: 'Contrat fixe'  },
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

  // ── Exploitation ─────────────────────────────────────────────────────────
  const [hectares,         setHectares]         = useState<number>(10);
  const [typeSol,          setTypeSol]          = useState<string>('limoneux');
  const [coords,           setCoords]           = useState<{ lat: number; lon: number } | null>(null);
  const [geocoding,        setGeocoding]        = useState(false);
  // ── Production ───────────────────────────────────────────────────────────
  const [culturesChoisies, setCulturesChoisies] = useState<string[]>([]);
  const [modeProd,         setModeProd]         = useState<string>('conventionnel');
  const [irrigation,       setIrrigation]       = useState<boolean>(false);
  // ── Données économiques ───────────────────────────────────────────────────
  const [rendementHa,    setRendementHa]    = useState<number>(0);   // 0 = non renseigné
  const [prixVise,       setPrixVise]       = useState<number>(0);   // 0 = non renseigné
  const [fermageHa,      setFermageHa]      = useState<number>(0);   // 0 = pas de fermage
  const [chargesVarHa,   setChargesVarHa]   = useState<number>(0);   // 0 = non renseigné
  const [modeVente,      setModeVente]      = useState<string>('negoce');
  // ── Affichage avancé ─────────────────────────────────────────────────────
  const [showAdvanced,   setShowAdvanced]   = useState<boolean>(false);

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
      const { data, ts, surface, sol, cultures, mode, irrigation: irr, rendement, prix, fermage, charges, vente } = JSON.parse(raw);
      if (Date.now() - ts < CACHE_TTL) {
        setResultat(data);
        setLastUpdate(new Date(ts).toLocaleDateString('fr-FR'));
        if (surface)                  setHectares(surface);
        if (sol)                      setTypeSol(sol);
        if (cultures?.length)         setCulturesChoisies(cultures);
        if (mode)                     setModeProd(mode);
        if (typeof irr === 'boolean') setIrrigation(irr);
        if (rendement > 0)            setRendementHa(rendement);
        if (prix > 0)                 setPrixVise(prix);
        if (fermage > 0)              setFermageHa(fermage);
        if (charges > 0)              setChargesVarHa(charges);
        if (vente)                    setModeVente(vente);
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
    const req: RequeteTop3 = {
      hectares,
      type_sol:                  typeSol,
      latitude:                  coords.lat,
      longitude:                 coords.lon,
      cultures_souhaitees:       culturesChoisies.length > 0 ? culturesChoisies : undefined,
      mode_production:           modeProd,
      irrigation,
      rendement_habituel_t_ha:   rendementHa > 0 ? rendementHa : undefined,
      prix_vente_vise_eur_t:     prixVise    > 0 ? prixVise    : undefined,
      fermage_eur_ha:            fermageHa   > 0 ? fermageHa   : undefined,
      charges_variables_eur_ha:  chargesVarHa > 0 ? chargesVarHa : undefined,
      mode_vente:                modeVente,
    };
    try {
      const res = await fetchRecommandations(req);
      setResultat(res.cultures_validees);
      setLastUpdate(new Date().toLocaleDateString('fr-FR'));
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        data: res.cultures_validees, ts: Date.now(),
        surface: hectares, sol: typeSol,
        cultures: culturesChoisies, mode: modeProd, irrigation,
        rendement: rendementHa, prix: prixVise, fermage: fermageHa, charges: chargesVarHa, vente: modeVente,
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
        hectares,
        type_sol:                  typeSol,
        latitude:                  coords.lat,
        longitude:                 coords.lon,
        culture:                   culture.nom_culture,
        mode_production:           modeProd,
        irrigation,
        rendement_habituel_t_ha:   rendementHa  > 0 ? rendementHa  : undefined,
        prix_vente_vise_eur_t:     prixVise     > 0 ? prixVise     : undefined,
        fermage_eur_ha:            fermageHa    > 0 ? fermageHa    : undefined,
        charges_variables_eur_ha:  chargesVarHa > 0 ? chargesVarHa : undefined,
        mode_vente:                modeVente,
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

      {/* ── Section 1 : Exploitation ─────────────────────────────────────── */}
      <View style={s.formCard}>
        <View style={s.formSectionHead}>
          <Text style={s.formSectionIcon}>🏡</Text>
          <Text style={s.formSectionTitle}>Exploitation</Text>
        </View>

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
          <PillSelect options={SOLS} value={typeSol} onChange={v => setTypeSol(v as string)} />
        </View>

        <View style={s.locRow}>
          <Text style={s.locIcon}>{geocoding ? '⏳' : coords ? '📍' : '⚠️'}</Text>
          <Text style={s.locText}>
            {geocoding ? 'Géolocalisation en cours…'
              : coords ? commune || 'Localisation détectée'
              : 'Commune non configurée dans le profil'}
          </Text>
        </View>
      </View>

      {/* ── Section 2 : Cultures & production ────────────────────────────── */}
      <View style={s.formCard}>
        <View style={s.formSectionHead}>
          <Text style={s.formSectionIcon}>🌾</Text>
          <Text style={s.formSectionTitle}>Cultures & production</Text>
        </View>

        <View style={s.field}>
          <View style={s.fieldLabelRow}>
            <Text style={s.fieldLabel}>Cultures à simuler</Text>
            <Text style={s.fieldHint}>
              {culturesChoisies.length === 0 ? 'Auto — Top 3 IA' : `${culturesChoisies.length} choisie${culturesChoisies.length > 1 ? 's' : ''}`}
            </Text>
          </View>
          <PillSelect
            options={CULTURES_LIST}
            value={culturesChoisies}
            onChange={v => setCulturesChoisies(v as string[])}
            multiSelect
          />
          {culturesChoisies.length > 0 && (
            <TouchableOpacity onPress={() => setCulturesChoisies([])}>
              <Text style={s.clearTxt}>Effacer la sélection</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Mode de production</Text>
          <PillSelect options={MODES_PROD} value={modeProd} onChange={v => setModeProd(v as string)} />
          <Text style={s.fieldSub}>
            {modeProd === 'bio' ? 'Prix x2-3 · rendements -25% · certifications requises'
              : modeProd === 'raisonne' ? 'Intrants réduits -25% · prix légèrement premium'
              : 'Prix et rendements standards du marché'}
          </Text>
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Irrigation disponible</Text>
          <View style={s.irrigRow}>
            <TouchableOpacity style={[s.irrigBtn, !irrigation && s.irrigBtnOn]} onPress={() => setIrrigation(false)}>
              <Text style={[s.irrigTxt, !irrigation && s.irrigTxtOn]}>Sèche</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.irrigBtn, irrigation && s.irrigBtnOn]} onPress={() => setIrrigation(true)}>
              <Text style={[s.irrigTxt, irrigation && s.irrigTxtOn]}>Irriguée</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Section 3 : Données économiques ──────────────────────────────── */}
      <View style={s.formCard}>
        <View style={s.formSectionHead}>
          <Text style={s.formSectionIcon}>💰</Text>
          <Text style={s.formSectionTitle}>Données économiques</Text>
          <Text style={s.formSectionOptional}>facultatif — améliore la précision</Text>
        </View>

        {/* Rendement habituel */}
        <View style={s.field}>
          <View style={s.fieldLabelRow}>
            <Text style={s.fieldLabel}>Votre rendement habituel</Text>
            <Text style={s.fieldHint}>{rendementHa > 0 ? `${rendementHa} t/ha` : 'IA estime'}</Text>
          </View>
          <View style={s.stepperRow}>
            <TouchableOpacity style={s.stepBtn} onPress={() => setRendementHa(v => Math.max(0, Math.round((v - 0.5) * 10) / 10))}>
              <Text style={s.stepBtnText}>−</Text>
            </TouchableOpacity>
            <View style={[s.stepperVal, rendementHa === 0 && s.stepperValAuto]}>
              <Text style={[s.stepperValText, rendementHa === 0 && s.stepperValAutoTxt]}>
                {rendementHa > 0 ? `${rendementHa} t/ha` : 'Auto IA'}
              </Text>
            </View>
            <TouchableOpacity style={s.stepBtn} onPress={() => setRendementHa(v => Math.round((v + 0.5) * 10) / 10)}>
              <Text style={s.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.fieldSub}>Votre rendement moyen réel sur cette parcelle</Text>
        </View>

        {/* Prix de vente visé */}
        <View style={s.field}>
          <View style={s.fieldLabelRow}>
            <Text style={s.fieldLabel}>Prix de vente visé</Text>
            <Text style={s.fieldHint}>{prixVise > 0 ? `${prixVise} €/t` : 'Prix marché'}</Text>
          </View>
          <View style={s.stepperRow}>
            <TouchableOpacity style={s.stepBtn} onPress={() => setPrixVise(v => Math.max(0, v - 10))}>
              <Text style={s.stepBtnText}>−</Text>
            </TouchableOpacity>
            <View style={[s.stepperVal, prixVise === 0 && s.stepperValAuto]}>
              <Text style={[s.stepperValText, prixVise === 0 && s.stepperValAutoTxt]}>
                {prixVise > 0 ? `${prixVise} €/t` : 'Marché'}
              </Text>
            </View>
            <TouchableOpacity style={s.stepBtn} onPress={() => setPrixVise(v => v + 10)}>
              <Text style={s.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.fieldSub}>Contrat fixe, prix coopérative ou objectif négoce</Text>
        </View>

        {/* Fermage */}
        <View style={s.field}>
          <View style={s.fieldLabelRow}>
            <Text style={s.fieldLabel}>Loyer foncier (fermage)</Text>
            <Text style={s.fieldHint}>{fermageHa > 0 ? `${fermageHa} €/ha · ${fermageHa * hectares} € total` : 'Non renseigné'}</Text>
          </View>
          <View style={s.stepperRow}>
            <TouchableOpacity style={s.stepBtn} onPress={() => setFermageHa(v => Math.max(0, v - 10))}>
              <Text style={s.stepBtnText}>−</Text>
            </TouchableOpacity>
            <View style={[s.stepperVal, fermageHa === 0 && s.stepperValAuto]}>
              <Text style={[s.stepperValText, fermageHa === 0 && s.stepperValAutoTxt]}>
                {fermageHa > 0 ? `${fermageHa} €/ha` : 'Propriétaire'}
              </Text>
            </View>
            <TouchableOpacity style={s.stepBtn} onPress={() => setFermageHa(v => v + 10)}>
              <Text style={s.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.fieldSub}>Loyer annuel des terres exploitées</Text>
        </View>

        {/* Charges variables */}
        <View style={s.field}>
          <View style={s.fieldLabelRow}>
            <Text style={s.fieldLabel}>Charges variables</Text>
            <Text style={s.fieldHint}>{chargesVarHa > 0 ? `${chargesVarHa} €/ha` : 'IA estime'}</Text>
          </View>
          <View style={s.stepperRow}>
            <TouchableOpacity style={s.stepBtn} onPress={() => setChargesVarHa(v => Math.max(0, v - 25))}>
              <Text style={s.stepBtnText}>−</Text>
            </TouchableOpacity>
            <View style={[s.stepperVal, chargesVarHa === 0 && s.stepperValAuto]}>
              <Text style={[s.stepperValText, chargesVarHa === 0 && s.stepperValAutoTxt]}>
                {chargesVarHa > 0 ? `${chargesVarHa} €/ha` : 'Auto IA'}
              </Text>
            </View>
            <TouchableOpacity style={s.stepBtn} onPress={() => setChargesVarHa(v => v + 25)}>
              <Text style={s.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.fieldSub}>Semences + engrais + phytosanitaires (€/ha)</Text>
        </View>

        {/* Mode de vente */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Mode de commercialisation</Text>
          <PillSelect options={MODES_VENTE} value={modeVente} onChange={v => setModeVente(v as string)} />
        </View>
      </View>

      {/* ── Résumé de simulation ──────────────────────────────────────────── */}
      {(rendementHa > 0 || prixVise > 0 || fermageHa > 0 || chargesVarHa > 0) && (
        <View style={s.simSummary}>
          <Text style={s.simSummaryTitle}>Paramètres actifs pour la simulation</Text>
          <View style={s.simSummaryGrid}>
            {rendementHa > 0  && <View style={s.simChip}><Text style={s.simChipTxt}>{rendementHa} t/ha</Text></View>}
            {prixVise > 0     && <View style={s.simChip}><Text style={s.simChipTxt}>{prixVise} €/t</Text></View>}
            {fermageHa > 0    && <View style={s.simChip}><Text style={s.simChipTxt}>{fermageHa} €/ha fermage</Text></View>}
            {chargesVarHa > 0 && <View style={s.simChip}><Text style={s.simChipTxt}>{chargesVarHa} €/ha charges</Text></View>}
          </View>
        </View>
      )}

      {/* ── Localisation + erreur + CTA ───────────────────────────────────── */}
      <View style={[s.formCard, { marginTop: 0 }]}>
        {!!error && <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>}
        <TouchableOpacity
          style={[s.ctaBtn, (loading || geocoding || !coords) && s.ctaBtnDisabled]}
          onPress={handleSimuler}
          disabled={loading || geocoding || !coords}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.ctaBtnText}>🌾 Lancer la simulation</Text>
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
          <Text style={s.loadNote}>Météo · IA agronomique · environ 10 secondes</Text>
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
    marginHorizontal: 18, marginBottom: 12,
    backgroundColor: Colors.white, borderRadius: 20, padding: 20, gap: 18,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  formSectionHead:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: -4 },
  formSectionIcon:     { fontSize: 18 },
  formSectionTitle:    { fontSize: 16, fontWeight: '800', color: Colors.primaryDark, flex: 1 },
  formSectionOptional: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic' },

  field:      { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark },
  fieldSub:   { fontSize: 11, color: Colors.textMuted, lineHeight: 15 },

  stepperRow:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn:           { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  stepBtnText:       { fontSize: 22, fontWeight: '700', color: Colors.primary },
  stepperVal:        { flex: 1, height: 44, backgroundColor: Colors.backgroundAlt, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepperValAuto:    { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' as any },
  stepperValText:    { fontSize: 16, fontWeight: '800', color: Colors.primaryDark },
  stepperValAutoTxt: { fontSize: 13, color: Colors.textMuted, fontWeight: '500', fontStyle: 'italic' },

  // Mode production / Irrigation / Cultures
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldHint:     { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  clearTxt:      { fontSize: 11, color: Colors.error, marginTop: 6, fontWeight: '600' },

  irrigRow:    { flexDirection: 'row', gap: 10 },
  irrigBtn:    { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.white },
  irrigBtnOn:  { backgroundColor: Colors.headerBg, borderColor: Colors.headerBg },
  irrigTxt:    { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  irrigTxtOn:  { color: '#fff' },

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

  // Résumé simulation
  simSummary:     { marginHorizontal: 18, marginBottom: 12, backgroundColor: Colors.primaryBg, borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: Colors.primaryLight + '44' },
  simSummaryTitle:{ fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 1, textTransform: 'uppercase' },
  simSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  simChip:        { backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  simChipTxt:     { fontSize: 12, fontWeight: '700', color: '#fff' },

  results:     { paddingHorizontal: 18, gap: 12, marginBottom: 8 },
  resultsLabel:{ fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase' },
  resultsHint: { fontSize: 12, color: Colors.textMuted, marginTop: -4, marginBottom: 4 },

  emptyBlock: { marginHorizontal: 18, alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.primaryDark, textAlign: 'center' },
  emptyText:  { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 21 },
});
