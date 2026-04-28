/**
 * app/(app)/profile.tsx — Onglet Profil
 *
 * Sections :
 *  - Résumé identité + exploitation + assolement
 *  - Sécurité : changer l'email ou le mot de passe
 *  - Boutons : Modifier mon profil | Se déconnecter
 *
 * Logout : le guard _layout.tsx gère la navigation après déconnexion.
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
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/Colors';
import { Layout } from '@/constants/layout';

// ─── Labels lisibles ──────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  grandes_cultures: 'Grandes cultures', elevage_bovin: 'Élevage bovin',
  elevage_porcin: 'Élevage porcin', elevage_avicole: 'Élevage avicole',
  viticulture: 'Viticulture', maraichage: 'Maraîchage',
  arboriculture: 'Arboriculture', mixte: 'Mixte',
};

const METHODE_LABELS: Record<string, string> = {
  conventionnelle: 'Conventionnelle', raisonnee: 'Raisonnée',
  hve: 'HVE', bio: 'Agriculture biologique',
  biodynamie: 'Biodynamie',
};

// ─── Ligne d'information ──────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={rs.row}>
      <Text style={rs.label}>{label}</Text>
      <Text style={rs.value}>{value}</Text>
    </View>
  );
}

const rs = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  label: { fontSize: 13, color: Colors.textMuted, flex: 1 },
  value: { fontSize: 13, color: Colors.text, fontWeight: '600', flex: 2, textAlign: 'right' },
});

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { fullProfile, loading } = useProfile();

  const p = fullProfile?.profile;
  const e = fullProfile?.exploitation;
  const cultures = fullProfile?.cultures ?? [];

  const [securityOpen, setSecurityOpen] = useState<'email' | 'password' | null>(null);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMessage, setPwdMessage] = useState('');
  const [pwdError, setPwdError] = useState('');

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleChangeEmail = async () => {
    setEmailError(''); setEmailMessage('');
    setEmailLoading(true);
    const result = await changeEmail(newEmail);
    setEmailLoading(false);
    if (result.success) { setEmailMessage(result.message ?? 'Email de confirmation envoyé.'); setNewEmail(''); }
    else setEmailError(result.error ?? 'Erreur.');
  };

  const handleChangePassword = async () => {
    setPwdError(''); setPwdMessage('');
    if (newPwd !== confirmPwd) { setPwdError('Les mots de passe ne correspondent pas.'); return; }
    if (!user?.email) return;
    setPwdLoading(true);
    const result = await changePassword(user.email, currentPwd, newPwd);
    setPwdLoading(false);
    if (result.success) { setPwdMessage(result.message ?? 'Mot de passe mis à jour.'); setCurrentPwd(''); setNewPwd(''); setConfirmPwd(''); }
    else setPwdError(result.error ?? 'Erreur.');
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try { await logout(); } catch (_) { setLogoutLoading(false); }
  };

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={s.loadScreen}>
        <View style={[s.header, { paddingTop: insets.top + 24 }]}>
          <Text style={s.headerTitle}>Mon profil</Text>
        </View>
        <View style={s.center}>
          <Text style={s.muted}>Chargement…</Text>
        </View>
      </View>
    );
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.container, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 24 }]}>
        {/* Avatar initiales */}
        <View style={s.avatarRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {p?.prenom?.[0]?.toUpperCase() ?? '?'}{p?.nom?.[0]?.toUpperCase() ?? ''}
            </Text>
          </View>
          <View>
            <Text style={s.headerTitle}>{p ? `${p.prenom} ${p.nom}` : 'Mon profil'}</Text>
            <Text style={s.headerSub}>{user?.email ?? ''}</Text>
          </View>
        </View>

        {/* Synthèse exploitation */}
        {e && (
          <View style={s.exploitRow}>
            <View style={s.exploitBox}>
              <Text style={s.exploitVal}>{e.surface_ha ?? '—'}</Text>
              <Text style={s.exploitLabel}>ha</Text>
            </View>
            <View style={s.exploitDivider} />
            <View style={s.exploitBox}>
              <Text style={s.exploitVal}>{cultures.length}</Text>
              <Text style={s.exploitLabel}>cultures</Text>
            </View>
            <View style={s.exploitDivider} />
            <View style={s.exploitBox}>
              <Text style={s.exploitVal}>{e.commune ?? '—'}</Text>
              <Text style={s.exploitLabel}>commune</Text>
            </View>
          </View>
        )}
      </View>

      {/* ─── IDENTITÉ ────────────────────────────────────────────────────── */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>Identité</Text>
        <Row label="Nom complet" value={p ? `${p.prenom} ${p.nom}` : '—'} />
        <Row label="Email" value={user?.email ?? '—'} />
        {p?.phone && <Row label="Téléphone" value={p.phone} />}
        <Row label="Naissance" value={p?.date_naissance ? p.date_naissance.split('-')[0] : '—'} />
        <Row label="Situation" value={p?.situation_familiale ?? '—'} />
        {p?.nb_enfants != null && <Row label="Enfants" value={String(p.nb_enfants)} />}
      </View>

      {/* ─── EXPLOITATION ────────────────────────────────────────────────── */}
      {e ? (
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Exploitation</Text>
          {e.nom_exploitation && <Row label="Nom" value={e.nom_exploitation} />}
          {e.commune && <Row label="Commune" value={`${e.commune}${e.code_postal ? ` (${e.code_postal})` : ''}`} />}
          {e.departement && <Row label="Département" value={e.departement} />}
          {e.surface_ha && <Row label="Surface" value={`${e.surface_ha} ha`} />}
          {e.type_exploitation && <Row label="Type" value={TYPE_LABELS[e.type_exploitation] ?? e.type_exploitation} />}
          {e.methode_production && <Row label="Méthode" value={METHODE_LABELS[e.methode_production] ?? e.methode_production} />}
          {e.certifications?.length ? <Row label="Certifications" value={e.certifications.join(', ').toUpperCase()} /> : null}
        </View>
      ) : (
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Exploitation</Text>
          <Text style={s.muted}>Exploitation non configurée</Text>
          <TouchableOpacity style={s.configBtn} onPress={() => router.push('/profile-setup')}>
            <Text style={s.configBtnText}>Configurer mon exploitation</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── ASSOLEMENT ──────────────────────────────────────────────────── */}
      {cultures.length > 0 && (
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>Assolement</Text>
          {cultures.map((c, i) => (
            <Row
              key={i}
              label={c.type_culture.replace(/_/g, ' ')}
              value={c.surface_ha ? `${c.surface_ha} ha` : '—'}
            />
          ))}
        </View>
      )}

      {/* ─── SÉCURITÉ ────────────────────────────────────────────────────── */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>Sécurité du compte</Text>

        {/* Changer l'email */}
        <TouchableOpacity
          style={s.secRow}
          onPress={() => setSecurityOpen(securityOpen === 'email' ? null : 'email')}
        >
          <Text style={s.secLabel}>Changer l'adresse email</Text>
          <Text style={s.secChevron}>{securityOpen === 'email' ? '▲' : '›'}</Text>
        </TouchableOpacity>

        {securityOpen === 'email' && (
          <View style={s.secForm}>
            <Text style={s.secHint}>
              Email actuel : <Text style={s.secHintBold}>{user?.email}</Text>
              {'\n'}Un lien de confirmation sera envoyé à la nouvelle adresse.
            </Text>
            <Input label="Nouvel email" placeholder="nouveau@ferme.fr" value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" />
            {emailError ? <Text style={s.errTxt}>{emailError}</Text> : null}
            {emailMessage ? <Text style={s.okTxt}>{emailMessage}</Text> : null}
            <Button onPress={handleChangeEmail} loading={emailLoading}>Envoyer le lien de confirmation</Button>
          </View>
        )}

        <View style={s.divider} />

        {/* Changer le mot de passe */}
        <TouchableOpacity
          style={s.secRow}
          onPress={() => setSecurityOpen(securityOpen === 'password' ? null : 'password')}
        >
          <Text style={s.secLabel}>Changer le mot de passe</Text>
          <Text style={s.secChevron}>{securityOpen === 'password' ? '▲' : '›'}</Text>
        </TouchableOpacity>

        {securityOpen === 'password' && (
          <View style={s.secForm}>
            <Input label="Mot de passe actuel" placeholder="••••••••" value={currentPwd} onChangeText={setCurrentPwd} secureTextEntry />
            <Input label="Nouveau mot de passe" placeholder="••••••••" value={newPwd} onChangeText={setNewPwd} secureTextEntry />
            <Input label="Confirmer le nouveau mot de passe" placeholder="••••••••" value={confirmPwd} onChangeText={setConfirmPwd} secureTextEntry />
            {pwdError ? <Text style={s.errTxt}>{pwdError}</Text> : null}
            {pwdMessage ? <Text style={s.okTxt}>{pwdMessage}</Text> : null}
            <Button onPress={handleChangePassword} loading={pwdLoading}>Mettre à jour le mot de passe</Button>
          </View>
        )}
      </View>

      {/* ─── ACTIONS ─────────────────────────────────────────────────────── */}
      <View style={s.actionsBlock}>
        <Button onPress={() => router.push('/profile-setup')}>
          Modifier mon profil
        </Button>

        {logoutConfirm ? (
          <View style={s.logoutConfirm}>
            <Text style={s.logoutConfirmText}>Confirmer la déconnexion ?</Text>
            <View style={s.logoutConfirmRow}>
              <Button onPress={() => setLogoutConfirm(false)} variant="outline" style={s.halfBtn}>Annuler</Button>
              <Button onPress={handleLogout} variant="ghost" loading={logoutLoading} style={s.halfBtn}>Se déconnecter</Button>
            </View>
          </View>
        ) : (
          <Button onPress={() => setLogoutConfirm(true)} variant="ghost">
            Se déconnecter
          </Button>
        )}
      </View>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { paddingHorizontal: 0 },
  loadScreen: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  muted: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingVertical: 8 },

  // Header
  header: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: 22,
    paddingBottom: 32,
    borderBottomLeftRadius: Layout.headerRadius,
    borderBottomRightRadius: Layout.headerRadius,
    gap: 18,
    marginBottom: 22,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: Colors.headerTextMuted, marginTop: 2 },

  // Avatar
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 54, height: 54, borderRadius: Layout.cardRadius + 11, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },

  // Exploit summary
  exploitRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingVertical: 14 },
  exploitBox: { flex: 1, alignItems: 'center' },
  exploitVal: { fontSize: 15, fontWeight: '800', color: '#fff' },
  exploitLabel: { fontSize: 10, color: Colors.headerTextMuted, marginTop: 2 },
  exploitDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', height: 24 },

  // Section cards
  sectionCard: {
    marginHorizontal: 22,
    marginBottom: 14,
    backgroundColor: Colors.white,
    borderRadius: Layout.cardRadius,
    padding: 18,
    ...Layout.cardShadow,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.primaryDark, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Config btn
  configBtn: { marginTop: 14, backgroundColor: Colors.primaryBg, borderRadius: Layout.inputRadius, paddingVertical: 12, alignItems: 'center' },
  configBtnText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },

  // Security
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  secLabel: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  secChevron: { fontSize: 16, color: Colors.textMuted },
  secForm: { paddingTop: 14, gap: 4 },
  secHint: { fontSize: 12, color: Colors.textMuted, lineHeight: 18, marginBottom: 12 },
  secHintBold: { fontWeight: '600', color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 2 },
  errTxt: { fontSize: 13, color: Colors.error, marginBottom: 6 },
  okTxt: { fontSize: 13, color: Colors.success, marginBottom: 6, lineHeight: 18 },

  // Actions
  actionsBlock: { paddingHorizontal: 22, gap: 10, marginTop: 4 },
  logoutConfirm: { backgroundColor: Colors.errorBg, borderRadius: Layout.cardRadius, padding: 16, borderWidth: 1, borderColor: '#FFCDD2', gap: 12 },
  logoutConfirmText: { fontSize: 14, fontWeight: '600', color: Colors.errorDark, textAlign: 'center' },
  logoutConfirmRow: { flexDirection: 'row', gap: 8 },
  halfBtn: { flex: 1 },
});
