/**
 * app/profile-setup.tsx — Wizard de configuration du profil (3 étapes)
 *
 * Étape 1 : Situation personnelle (téléphone, situation familiale, naissance, enfants)
 * Étape 2 : Exploitation (nom, localisation, surface, type, méthode, certifications)
 * Étape 3 : Assolement (cultures + surface ha + rendement moyen t/ha par culture)
 */
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { getFullProfile, saveProfileStep1, saveExploitation, saveCultures } from '@/services/profile.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PillSelect } from '@/components/ui/PillSelect';
import { Colors } from '@/constants/Colors';
import {
  SituationFamiliale, TypeExploitation, MethodeProduction,
  Certification, TypeCulture,
} from '@/types/index';

// ─── Options des PillSelect ───────────────────────────────────────────────────

const SITUATIONS: { value: SituationFamiliale; label: string }[] = [
  { value: 'celibataire', label: 'Célibataire' },
  { value: 'marie',       label: 'Marié(e)' },
  { value: 'pacse',       label: 'Pacsé(e)' },
  { value: 'divorce',     label: 'Divorcé(e)' },
  { value: 'veuf',        label: 'Veuf/Veuve' },
];

const TYPES_EXPLOITATION: { value: TypeExploitation; label: string }[] = [
  { value: 'grandes_cultures', label: 'Grandes cultures' },
  { value: 'elevage_bovin',    label: 'Élevage bovin' },
  { value: 'elevage_porcin',   label: 'Élevage porcin' },
  { value: 'elevage_avicole',  label: 'Élevage avicole' },
  { value: 'viticulture',      label: 'Viticulture' },
  { value: 'maraichage',       label: 'Maraîchage' },
  { value: 'arboriculture',    label: 'Arboriculture' },
  { value: 'mixte',            label: 'Mixte' },
];

const METHODES: { value: MethodeProduction; label: string }[] = [
  { value: 'conventionnelle', label: 'Conventionnelle' },
  { value: 'raisonnee',       label: 'Raisonnée' },
  { value: 'hve',             label: 'HVE' },
  { value: 'bio',             label: 'Agriculture bio' },
  { value: 'biodynamie',      label: 'Biodynamie' },
];

const CERTIFICATIONS: { value: Certification; label: string }[] = [
  { value: 'hve',         label: 'HVE' },
  { value: 'ab',          label: 'AB' },
  { value: 'label_rouge', label: 'Label Rouge' },
  { value: 'aoc_aop',     label: 'AOC / AOP' },
  { value: 'igp',         label: 'IGP' },
];

const CULTURES: { value: TypeCulture; label: string }[] = [
  { value: 'ble_tendre',     label: 'Blé tendre' },
  { value: 'ble_dur',        label: 'Blé dur' },
  { value: 'orge_hiver',     label: "Orge d'hiver" },
  { value: 'orge_printemps', label: 'Orge de printemps' },
  { value: 'mais',           label: 'Maïs' },
  { value: 'tournesol',      label: 'Tournesol' },
  { value: 'colza',          label: 'Colza' },
  { value: 'soja',           label: 'Soja' },
  { value: 'betterave',      label: 'Betterave' },
  { value: 'pomme_de_terre', label: 'Pomme de terre' },
  { value: 'lin',            label: 'Lin' },
  { value: 'pois',           label: 'Pois' },
  { value: 'luzerne',        label: 'Luzerne' },
  { value: 'prairie',        label: 'Prairie' },
  { value: 'autre',          label: 'Autre' },
];

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ProfileSetupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep]             = useState(1);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  // ── Étape 1 : Situation personnelle ─────────────────────────────────────────
  const [phone, setPhone]                       = useState('');
  const [situation, setSituation]               = useState<SituationFamiliale | null>(null);
  const [anneeNaissance, setAnneeNaissance]     = useState('');
  const [nbEnfants, setNbEnfants]               = useState(0);

  // ── Étape 2 : Exploitation ───────────────────────────────────────────────────
  const [nomExploitation, setNomExploitation]   = useState('');
  const [commune, setCommune]                   = useState('');
  const [codePostal, setCodePostal]             = useState('');
  const [departement, setDepartement]           = useState('');
  const [region, setRegion]                     = useState('');
  const [surfaceHa, setSurfaceHa]               = useState('');
  const [typeExploitation, setTypeExploitation] = useState<TypeExploitation | null>(null);
  const [methode, setMethode]                   = useState<MethodeProduction | null>(null);
  const [certifications, setCertifications]     = useState<Certification[]>([]);

  // ── Étape 3 : Assolement ────────────────────────────────────────────────────
  const [selectedCultures, setSelectedCultures]   = useState<TypeCulture[]>([]);
  const [surfacesCultures, setSurfacesCultures]   = useState<Record<TypeCulture, string>>({} as any);
  const [rendementsCultures, setRendementsCultures] = useState<Record<TypeCulture, string>>({} as any);

  // ── Chargement des données existantes (mode édition) ────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      const existing = await getFullProfile(user.id);
      if (!existing) return;
      setIsEditMode(true);

      const { profile: p, exploitation: e, cultures: c } = existing;
      if (p.phone)               setPhone(p.phone);
      if (p.situation_familiale) setSituation(p.situation_familiale);
      if (p.date_naissance)      setAnneeNaissance(p.date_naissance.split('-')[0]);
      if (p.nb_enfants != null)  setNbEnfants(p.nb_enfants);

      if (e) {
        if (e.nom_exploitation)  setNomExploitation(e.nom_exploitation);
        if (e.commune)           setCommune(e.commune);
        if (e.code_postal)       setCodePostal(e.code_postal);
        if (e.departement)       setDepartement(e.departement);
        if (e.region)            setRegion(e.region);
        if (e.surface_ha)        setSurfaceHa(String(e.surface_ha));
        if (e.type_exploitation) setTypeExploitation(e.type_exploitation);
        if (e.methode_production) setMethode(e.methode_production);
        if (e.certifications)    setCertifications(e.certifications);
      }

      if (c.length > 0) {
        setSelectedCultures(c.map(x => x.type_culture));
        const surfaces: Record<string, string>   = {};
        const rendements: Record<string, string> = {};
        c.forEach(x => {
          if (x.surface_ha)      surfaces[x.type_culture]   = String(x.surface_ha);
          if (x.rendement_moyen) rendements[x.type_culture] = String(x.rendement_moyen);
        });
        setSurfacesCultures(surfaces as any);
        setRendementsCultures(rendements as any);
      }
    })();
  }, [user]);

  // ── Sauvegarde finale ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user) return;
    setError('');
    setLoading(true);

    try {
      // Étape 1
      await saveProfileStep1(user.id, {
        phone:               phone || undefined,
        situation_familiale: situation ?? undefined,
        date_naissance:      anneeNaissance ? `${anneeNaissance}-01-01` : undefined,
        nb_enfants:          nbEnfants,
      });

      // Étape 2
      const exploitationId = await saveExploitation(user.id, {
        nom_exploitation:   nomExploitation  || undefined,
        commune:            commune          || undefined,
        code_postal:        codePostal       || undefined,
        departement:        departement      || undefined,
        region:             region           || undefined,
        surface_ha:         surfaceHa        ? parseFloat(surfaceHa)  : undefined,
        type_exploitation:  typeExploitation ?? undefined,
        methode_production: methode          ?? undefined,
        certifications:     certifications.length ? certifications : undefined,
      });

      // Étape 3
      await saveCultures(exploitationId, selectedCultures.map(tc => ({
        type_culture:    tc,
        surface_ha:      surfacesCultures[tc]   ? parseFloat(surfacesCultures[tc])   : undefined,
        rendement_moyen: rendementsCultures[tc] ? parseFloat(rendementsCultures[tc]) : undefined,
      })));

      router.replace('/(app)');
    } catch (e: any) {
      setError(e?.message ?? 'Une erreur est survenue lors de la sauvegarde.');
    } finally {
      setLoading(false);
    }
  };

  // ── Bilan surface assolement ─────────────────────────────────────────────────
  const totalCultures     = selectedCultures.reduce((s, tc) => s + (parseFloat(surfacesCultures[tc] ?? '0') || 0), 0);
  const totalExploitation = parseFloat(surfaceHa) || 0;
  const surfaceOk         = totalExploitation > 0 && Math.abs(totalCultures - totalExploitation) < 0.1;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.root} contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]} keyboardShouldPersistTaps="handled">

        {/* En-tête + barre de progression */}
        <View style={styles.header}>
          <Text style={styles.title}>{isEditMode ? 'Modifier mon profil' : 'Configurer mon exploitation'}</Text>
          <Text style={styles.subtitle}>Étape {step} sur 3</Text>
          <View style={styles.progressBar}>
            {[1, 2, 3].map(s => (
              <View key={s} style={[styles.progressStep, s <= step && styles.progressStepActive]} />
            ))}
          </View>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>⚠️ {error}</Text></View> : null}

        {/* ── ÉTAPE 1 : Situation personnelle ────────────────────────────────── */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Situation personnelle</Text>

            <Input
              label="Téléphone (optionnel)"
              placeholder="+33 6 12 34 56 78"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>Situation familiale</Text>
            <PillSelect
              options={SITUATIONS}
              value={situation}
              onChange={v => setSituation(v as SituationFamiliale)}
            />

            <Input
              label="Année de naissance"
              placeholder="1976"
              value={anneeNaissance}
              onChangeText={setAnneeNaissance}
              keyboardType="numeric"
              maxLength={4}
              style={styles.inputSm}
            />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nombre d'enfants à charge</Text>
              <View style={styles.stepper}>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => setNbEnfants(Math.max(0, nbEnfants - 1))}>
                  <Text style={styles.stepperBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{nbEnfants}</Text>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => setNbEnfants(nbEnfants + 1)}>
                  <Text style={styles.stepperBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ── ÉTAPE 2 : L'exploitation ───────────────────────────────────────── */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Votre exploitation</Text>

            <Input
              label="Nom de l'exploitation (optionnel)"
              placeholder="EARL Dupont"
              value={nomExploitation}
              onChangeText={setNomExploitation}
            />

            <View style={styles.row}>
              <View style={styles.flex3}>
                <Input label="Commune" placeholder="Poitiers" value={commune} onChangeText={setCommune} />
              </View>
              <View style={styles.flex2}>
                <Input label="Code postal" placeholder="86000" value={codePostal} onChangeText={setCodePostal} keyboardType="numeric" maxLength={5} />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.flex1}>
                <Input label="Département" placeholder="Vienne" value={departement} onChangeText={setDepartement} />
              </View>
              <View style={styles.flex1}>
                <Input label="Région" placeholder="N.-Aquitaine" value={region} onChangeText={setRegion} />
              </View>
            </View>

            <Input
              label="Surface totale (ha)"
              placeholder="180"
              value={surfaceHa}
              onChangeText={setSurfaceHa}
              keyboardType="decimal-pad"
              style={styles.inputSm}
            />

            <Text style={styles.fieldLabel}>Type d'exploitation</Text>
            <PillSelect options={TYPES_EXPLOITATION} value={typeExploitation} onChange={v => setTypeExploitation(v as TypeExploitation)} />

            <View style={styles.fieldSpacer} />
            <Text style={styles.fieldLabel}>Méthode de production</Text>
            <PillSelect options={METHODES} value={methode} onChange={v => setMethode(v as MethodeProduction)} />

            <View style={styles.fieldSpacer} />
            <Text style={styles.fieldLabel}>Certifications (plusieurs possibles)</Text>
            <PillSelect options={CERTIFICATIONS} value={certifications} onChange={v => setCertifications(v as Certification[])} multiSelect />
          </View>
        )}

        {/* ── ÉTAPE 3 : Assolement ──────────────────────────────────────────── */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Assolement</Text>
            <Text style={styles.stepDesc}>
              Sélectionnez vos cultures, renseignez la surface et votre rendement moyen historique (en t/ha).
              {'\n'}Le rendement moyen sera utilisé par l'IA pour personnaliser vos simulations.
            </Text>

            <Text style={styles.fieldLabel}>Cultures présentes sur l'exploitation</Text>
            <PillSelect
              options={CULTURES}
              value={selectedCultures}
              onChange={v => setSelectedCultures(v as TypeCulture[])}
              multiSelect
            />

            {selectedCultures.length > 0 && (
              <View style={styles.culturesDetail}>

                {/* En-têtes colonnes */}
                <View style={styles.cultureHeader}>
                  <Text style={[styles.cultureCol, styles.cultureColLabel]}>Culture</Text>
                  <Text style={styles.cultureCol}>Surface (ha)</Text>
                  <Text style={styles.cultureCol}>Rdt moyen (t/ha)</Text>
                </View>

                {selectedCultures.map(tc => {
                  const label = CULTURES.find(c => c.value === tc)?.label ?? tc;
                  return (
                    <View key={tc} style={styles.cultureRow}>
                      <Text style={[styles.cultureCol, styles.cultureColLabel]}>{label}</Text>
                      <TextInput
                        style={[styles.cultureCol, styles.cultureInput]}
                        placeholder="—"
                        keyboardType="decimal-pad"
                        value={surfacesCultures[tc] ?? ''}
                        onChangeText={v => setSurfacesCultures(prev => ({ ...prev, [tc]: v }))}
                      />
                      <TextInput
                        style={[styles.cultureCol, styles.cultureInput]}
                        placeholder="—"
                        keyboardType="decimal-pad"
                        value={rendementsCultures[tc] ?? ''}
                        onChangeText={v => setRendementsCultures(prev => ({ ...prev, [tc]: v }))}
                      />
                    </View>
                  );
                })}

                {/* Bilan surface */}
                <View style={[styles.surfaceBilan, surfaceOk && styles.surfaceBilanOk]}>
                  <Text style={[styles.surfaceBilanText, surfaceOk && styles.surfaceBilanTextOk]}>
                    {surfaceOk ? '✅' : '📊'} Total assolement : {totalCultures.toFixed(1)} ha
                    {totalExploitation > 0 ? ` / ${totalExploitation} ha` : ''}
                  </Text>
                </View>

              </View>
            )}
          </View>
        )}

        {/* ── Navigation ─────────────────────────────────────────────────────── */}
        <View style={styles.nav}>
          {step > 1 && (
            <Button onPress={() => setStep(step - 1)} variant="outline" style={styles.navBtn}>
              ← Retour
            </Button>
          )}
          {step < 3 ? (
            <Button onPress={() => { setError(''); setStep(step + 1); }} style={styles.navBtn}>
              Suivant →
            </Button>
          ) : (
            <Button onPress={handleSave} loading={loading} style={styles.navBtn}>
              {isEditMode ? 'Enregistrer' : 'Terminer la configuration'}
            </Button>
          )}
        </View>

        {step === 1 && (
          <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace('/(app)')}>
            <Text style={styles.skipText}>Passer, je compléterai plus tard</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:               { flex: 1, backgroundColor: Colors.white },
  container:          { paddingHorizontal: 24, paddingBottom: 48 },
  header:             { marginBottom: 24 },
  title:              { fontSize: 24, fontWeight: '800', color: Colors.primaryDark },
  subtitle:           { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  progressBar:        { flexDirection: 'row', gap: 8, marginTop: 12 },
  progressStep:       { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  progressStepActive: { backgroundColor: Colors.primary },
  errorBox:   { backgroundColor: Colors.errorBg, borderRadius: 8, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: Colors.error },
  errorText:  { color: Colors.errorDark, fontSize: 13 },
  stepContent: { gap: 0 },
  stepTitle:   { fontSize: 18, fontWeight: '700', color: Colors.primaryDark, marginBottom: 20 },
  stepDesc:    { fontSize: 13, color: Colors.textMuted, marginBottom: 16, lineHeight: 19 },
  fieldLabel:  { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  fieldGroup:  { marginBottom: 16 },
  fieldSpacer: { height: 16 },
  inputSm:     { maxWidth: 200 },
  row:         { flexDirection: 'row', gap: 12 },
  flex1:       { flex: 1 },
  flex2:       { flex: 2 },
  flex3:       { flex: 3 },
  stepper:        { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepperBtn:     { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { fontSize: 20, color: Colors.primary, lineHeight: 24 },
  stepperValue:   { fontSize: 22, fontWeight: '700', color: Colors.primaryDark, minWidth: 30, textAlign: 'center' },
  // Tableau cultures
  culturesDetail: { marginTop: 20 },
  cultureHeader:  { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: Colors.border, marginBottom: 4 },
  cultureRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cultureCol:     { flex: 1, fontSize: 13, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },
  cultureColLabel:{ flex: 1.4, textAlign: 'left', color: Colors.text, fontWeight: '500', fontSize: 13 },
  cultureInput:   { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 13, textAlign: 'center', color: Colors.text, fontWeight: '400' },
  surfaceBilan:       { marginTop: 14, backgroundColor: Colors.border, borderRadius: 8, padding: 12 },
  surfaceBilanOk:     { backgroundColor: Colors.successBg },
  surfaceBilanText:   { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  surfaceBilanTextOk: { color: Colors.success },
  nav:      { flexDirection: 'row', gap: 12, marginTop: 32 },
  navBtn:   { flex: 1 },
  skipBtn:  { alignItems: 'center', marginTop: 16 },
  skipText: { fontSize: 13, color: Colors.textMuted, textDecorationLine: 'underline' },
});
