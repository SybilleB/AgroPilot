/**
 * app/(app)/profile.tsx — Onglet Profil
 *
 * Sections :
 *  - Résumé identité + exploitation + assolement
 *  - Sécurité : changer l'email ou le mot de passe
 *  - Boutons : Modifier mon profil | Se déconnecter
 *
 * Logout : router.replace('/') est appelé explicitement après logout() pour iOS
 * (onAuthStateChange peut tarder). Le guard _layout.tsx reste en backup.
 */
import { useState } from 'react';
import {
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { logout, changeEmail, changePassword } from '@/services/auth.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/Colors';

// ─── Labels lisibles ──────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  grandes_cultures: 'Grandes cultures', elevage_bovin: 'Élevage bovin',
  elevage_porcin: 'Élevage porcin',     elevage_avicole: 'Élevage avicole',
  viticulture: 'Viticulture',           maraichage: 'Maraîchage',
  arboriculture: 'Arboriculture',       mixte: 'Mixte',
};

const METHODE_LABELS: Record<string, string> = {
  conventionnelle: 'Conventionnelle', raisonnee: 'Raisonnée',
  hve: 'HVE', bio: 'Agriculture biologique', biodynamie: 'Biodynamie',
};

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { fullProfile, loading } = useProfile();

  const p       = fullProfile?.profile;
  const e       = fullProfile?.exploitation;
  const cultures = fullProfile?.cultures ?? [];

  // ── Sécurité : état local ──────────────────────────────────────────────────
  const [securityOpen, setSecurityOpen]   = useState<'email' | 'password' | null>(null);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const [newEmail, setNewEmail]               = useState('');
  const [emailLoading, setEmailLoading]       = useState(false);
  const [emailMessage, setEmailMessage]       = useState('');
  const [emailError, setEmailError]           = useState('');

  const [currentPwd, setCurrentPwd]           = useState('');
  const [newPwd, setNewPwd]                   = useState('');
  const [confirmPwd, setConfirmPwd]           = useState('');
  const [pwdLoading, setPwdLoading]           = useState(false);
  const [pwdMessage, setPwdMessage]           = useState('');
  const [pwdError, setPwdError]               = useState('');

  // ── Handlers sécurité ─────────────────────────────────────────────────────

  const handleChangeEmail = async () => {
    setEmailError(''); setEmailMessage('');
    setEmailLoading(true);
    const result = await changeEmail(newEmail);
    setEmailLoading(false);
    if (result.success) {
      setEmailMessage(result.message ?? 'Email de confirmation envoyé.');
      setNewEmail('');
    } else {
      setEmailError(result.error ?? 'Erreur.');
    }
  };

  const handleChangePassword = async () => {
    setPwdError(''); setPwdMessage('');
    if (newPwd !== confirmPwd) { setPwdError('Les mots de passe ne correspondent pas.'); return; }
    if (!user?.email) return;
    setPwdLoading(true);
    const result = await changePassword(user.email, currentPwd, newPwd);
    setPwdLoading(false);
    if (result.success) {
      setPwdMessage(result.message ?? 'Mot de passe mis à jour.');
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } else {
      setPwdError(result.error ?? 'Erreur.');
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
      // Pas de navigation ici — le guard dans _layout.tsx s'en charge.
      // Séquence :
      //   1. signOut() → onAuthStateChange(SIGNED_OUT) → setSession(null)
      //   2. React re-render avec session=null
      //   3. Guard : !session && inProtected → router.replace('/(auth)/login')
      // Si on navigue AVANT l'étape 2, le guard voit l'ancienne session et
      // fait un rebond vers /(app).
    } catch (_) {
      setLogoutLoading(false);
    }
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <View style={styles.center}><Text style={styles.muted}>Chargement…</Text></View>;
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}>

      <View style={styles.header}>
        <Text style={styles.title}>Mon profil</Text>
      </View>

      {/* ── Identité ──────────────────────────────────────────────────────── */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>👤 Identité</Text>
        <Row label="Nom"       value={p ? `${p.prenom} ${p.nom}` : '—'} />
        <Row label="Email"     value={user?.email ?? '—'} />
        {p?.phone              && <Row label="Téléphone"  value={p.phone} />}
        <Row label="Naissance" value={p?.date_naissance ? p.date_naissance.split('-')[0] : '—'} />
        <Row label="Situation" value={p?.situation_familiale ?? '—'} />
        {p?.nb_enfants != null && <Row label="Enfants"    value={String(p.nb_enfants)} />}
      </Card>

      {/* ── Exploitation ──────────────────────────────────────────────────── */}
      {e ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>🌾 Exploitation</Text>
          {e.nom_exploitation   && <Row label="Nom"           value={e.nom_exploitation} />}
          {e.commune            && <Row label="Commune"       value={`${e.commune}${e.code_postal ? ` (${e.code_postal})` : ''}`} />}
          {e.departement        && <Row label="Département"   value={e.departement} />}
          {e.surface_ha         && <Row label="Surface"       value={`${e.surface_ha} ha`} />}
          {e.type_exploitation  && <Row label="Type"          value={TYPE_LABELS[e.type_exploitation] ?? e.type_exploitation} />}
          {e.methode_production && <Row label="Méthode"       value={METHODE_LABELS[e.methode_production] ?? e.methode_production} />}
          {e.certifications?.length ? <Row label="Certifications" value={e.certifications.join(', ').toUpperCase()} /> : null}
        </Card>
      ) : (
        <Card style={styles.section}>
          <Text style={styles.muted}>Exploitation non configurée</Text>
        </Card>
      )}

      {/* ── Assolement ────────────────────────────────────────────────────── */}
      {cultures.length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>🌱 Assolement</Text>
          {cultures.map((c, i) => (
            <Row
              key={i}
              label={c.type_culture.replace(/_/g, ' ')}
              value={[
                c.surface_ha      ? `${c.surface_ha} ha`     : null,
                c.rendement_moyen ? `${c.rendement_moyen} t/ha` : null,
              ].filter(Boolean).join(' · ') || '—'}
            />
          ))}
        </Card>
      )}

      {/* ── Sécurité ──────────────────────────────────────────────────────── */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>🔒 Sécurité</Text>

        {/* Changer l'email */}
        <TouchableOpacity
          style={styles.securityRow}
          onPress={() => setSecurityOpen(securityOpen === 'email' ? null : 'email')}
        >
          <Text style={styles.securityLabel}>Changer l'adresse email</Text>
          <Text style={styles.securityChevron}>{securityOpen === 'email' ? '▲' : '▶'}</Text>
        </TouchableOpacity>

        {securityOpen === 'email' && (
          <View style={styles.securityForm}>
            <Text style={styles.securityHint}>
              Email actuel : <Text style={styles.securityHintBold}>{user?.email}</Text>
              {`\n`}Supabase enverra un lien de confirmation à la nouvelle adresse.
            </Text>
            <Input
              label="Nouvel email"
              placeholder="nouveau@ferme.fr"
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {emailError  ? <Text style={styles.errorText}>⚠️ {emailError}</Text>   : null}
            {emailMessage ? <Text style={styles.successText}>✅ {emailMessage}</Text> : null}
            <Button onPress={handleChangeEmail} loading={emailLoading}>
              Envoyer le lien de confirmation
            </Button>
          </View>
        )}

        <View style={styles.divider} />

        {/* Changer le mot de passe */}
        <TouchableOpacity
          style={styles.securityRow}
          onPress={() => setSecurityOpen(securityOpen === 'password' ? null : 'password')}
        >
          <Text style={styles.securityLabel}>Changer le mot de passe</Text>
          <Text style={styles.securityChevron}>{securityOpen === 'password' ? '▲' : '▶'}</Text>
        </TouchableOpacity>

        {securityOpen === 'password' && (
          <View style={styles.securityForm}>
            <Input
              label="Mot de passe actuel"
              placeholder="••••••••"
              value={currentPwd}
              onChangeText={setCurrentPwd}
              secureTextEntry
            />
            <Input
              label="Nouveau mot de passe"
              placeholder="••••••••"
              value={newPwd}
              onChangeText={setNewPwd}
              secureTextEntry
            />
            <Input
              label="Confirmer le nouveau mot de passe"
              placeholder="••••••••"
              value={confirmPwd}
              onChangeText={setConfirmPwd}
              secureTextEntry
            />
            {pwdError   ? <Text style={styles.errorText}>⚠️ {pwdError}</Text>     : null}
            {pwdMessage ? <Text style={styles.successText}>✅ {pwdMessage}</Text> : null}
            <Button onPress={handleChangePassword} loading={pwdLoading}>
              Mettre à jour le mot de passe
            </Button>
          </View>
        )}
      </Card>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <Button onPress={() => router.push('/profile-setup')} style={styles.editBtn}>
        Modifier mon profil
      </Button>

      {logoutConfirm ? (
        <View style={styles.logoutConfirmBox}>
          <Text style={styles.logoutConfirmText}>Confirmer la déconnexion ?</Text>
          <View style={styles.logoutConfirmRow}>
            <Button onPress={() => setLogoutConfirm(false)} variant="outline" style={styles.logoutConfirmBtn}>
              Annuler
            </Button>
            <Button onPress={handleLogout} variant="ghost" loading={logoutLoading} style={styles.logoutConfirmBtn}>
              Se déconnecter
            </Button>
          </View>
        </View>
      ) : (
        <Button onPress={() => setLogoutConfirm(true)} variant="ghost" style={styles.logoutBtn}>
          Se déconnecter
        </Button>
      )}

    </ScrollView>
  );
}

// ─── Composant utilitaire ─────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.border },
  label: { fontSize: 13, color: Colors.textMuted, flex: 1 },
  value: { fontSize: 13, color: Colors.text, fontWeight: '500', flex: 2, textAlign: 'right' },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.white },
  container:    { paddingHorizontal: 20 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:       { marginBottom: 20 },
  title:        { fontSize: 26, fontWeight: '800', color: Colors.primaryDark },
  section:      { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.primaryDark, marginBottom: 10 },
  muted:        { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingVertical: 8 },
  // Sécurité
  securityRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  securityLabel:   { fontSize: 14, color: Colors.text, fontWeight: '500' },
  securityChevron: { fontSize: 12, color: Colors.textMuted },
  securityForm:    { paddingTop: 12, gap: 0 },
  securityHint:    { fontSize: 12, color: Colors.textMuted, lineHeight: 18, marginBottom: 12 },
  securityHintBold:{ fontWeight: '600', color: Colors.text },
  divider:         { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  errorText:       { fontSize: 13, color: Colors.error, marginBottom: 8 },
  successText:     { fontSize: 13, color: Colors.success, marginBottom: 8, lineHeight: 18 },
  // Actions
  editBtn:            { marginTop: 8 },
  logoutBtn:          { marginTop: 8 },
  logoutConfirmBox:   { marginTop: 16, backgroundColor: Colors.errorBg, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#FFCDD2' },
  logoutConfirmText:  { fontSize: 14, fontWeight: '600', color: Colors.errorDark, textAlign: 'center', marginBottom: 12 },
  logoutConfirmRow:   { flexDirection: 'row', gap: 8 },
  logoutConfirmBtn:   { flex: 1 },
});
