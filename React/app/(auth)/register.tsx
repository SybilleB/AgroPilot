/**
 * app/(auth)/register.tsx — Écran d'inscription
 */
import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Link, Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { register } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/Colors';

export default function RegisterScreen() {
  // ⚠️ TOUS les hooks AVANT tout return conditionnel (Rules of Hooks)
  const { session } = useAuth();
  const router      = useRouter();
  const insets      = useSafeAreaInsets();

  const [prenom,           setPrenom]           = useState('');
  const [nom,              setNom]              = useState('');
  const [email,            setEmail]            = useState('');
  const [password,         setPassword]         = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState('');
  const [success,          setSuccess]          = useState(false);

  if (session) return <Redirect href="/(app)" />;

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleRegister = async () => {
    setError('');
    const trimmedEmail = email.trim().toLowerCase();
    if (!prenom || !nom || !trimmedEmail || !password || !confirmPassword) {
      setError('Merci de remplir tous les champs.'); return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) { setError('Adresse email invalide.'); return; }
    if (password !== confirmPassword)    { setError('Les mots de passe ne correspondent pas.'); return; }
    if (password.length < 6)            { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }

    setLoading(true);
    try {
      const result = await register({ prenom, nom, email: trimmedEmail, password });
      if (!result.success) setError(result.error ?? 'Inscription impossible.');
      else setSuccess(true);
    } catch (e: any) {
      setError(e?.message ?? 'Une erreur inattendue est survenue.');
    } finally {
      setLoading(false);
    }
  };

  // ── Écran de succès ───────────────────────────────────────────────────────

  if (success) {
    return (
      <View style={[s.successRoot, { paddingTop: insets.top }]}>
        <View style={[s.successHeader, { paddingTop: insets.top + 48 }]}>
          <View style={s.logoRow}>
            <View style={s.logoSquare}>
              <Text style={s.logoLetter}>A</Text>
            </View>
            <Text style={s.logoName}>AgroPilot</Text>
          </View>
        </View>

        <View style={s.successBody}>
          <View style={s.successCheck}>
            <Text style={s.successCheckText}>✓</Text>
          </View>
          <Text style={s.successTitle}>Compte créé !</Text>
          <Text style={s.successText}>
            Vérifiez votre boîte mail pour confirmer votre adresse avant de vous connecter.
          </Text>
          <Text style={s.successSubtext}>
            Prenez 2 minutes pour configurer votre exploitation — ça permettra à AgroPilot de vous proposer les bonnes aides et les bons calculs.
          </Text>

          <TouchableOpacity style={s.successBtn} onPress={() => router.replace('/profile-setup')}>
            <Text style={s.successBtnText}>Configurer mon exploitation</Text>
          </TouchableOpacity>

          <Link href="/(auth)/login" style={s.successLink}>Plus tard, aller à la connexion</Link>
        </View>
      </View>
    );
  }

  // ── Formulaire ────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={s.root}
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ─── HEADER ─────────────────────────────────────────────────────── */}
        <View style={[s.header, { paddingTop: insets.top + 36 }]}>
          <View style={s.logoRow}>
            <View style={s.logoSquare}>
              <Text style={s.logoLetter}>A</Text>
            </View>
            <View>
              <Text style={s.logoName}>AgroPilot</Text>
              <Text style={s.logoTagline}>PRÉVISION AGRICOLE</Text>
            </View>
          </View>
          <Text style={s.heroTitle}>Créer un compte</Text>
          <Text style={s.heroSub}>Rejoignez les agriculteurs qui anticipent</Text>
        </View>

        {/* ─── FORMULAIRE ─────────────────────────────────────────────────── */}
        <View style={s.formBlock}>

          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={s.row}>
            <View style={s.half}>
              <Input label="Prénom" placeholder="Jean" value={prenom} onChangeText={setPrenom} autoCapitalize="words" />
            </View>
            <View style={s.half}>
              <Input label="Nom" placeholder="Dupont" value={nom} onChangeText={setNom} autoCapitalize="words" />
            </View>
          </View>

          <Input
            label="Email"
            placeholder="exemple@ferme.fr"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Mot de passe"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Input
            label="Confirmer le mot de passe"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <Button onPress={handleRegister} loading={loading} style={s.submitBtn}>
            Créer mon compte
          </Button>
        </View>

        {/* ─── PIED DE PAGE ───────────────────────────────────────────────── */}
        <View style={s.footer}>
          <Text style={s.footerText}>Déjà un compte ? </Text>
          <Link href="/(auth)/login" style={s.footerLink}>Se connecter</Link>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, paddingBottom: 48 },

  // Header
  header: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: 26,
    paddingBottom: 44,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: 14,
  },
  logoRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  logoSquare: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontSize: 22, fontWeight: '900', color: '#fff' },
  logoName:   { fontSize: 18, fontWeight: '800', color: '#fff' },
  logoTagline:{ fontSize: 9, color: Colors.headerTextMuted, letterSpacing: 2.5, marginTop: 1 },
  heroTitle:  { fontSize: 28, fontWeight: '900', color: '#fff' },
  heroSub:    { fontSize: 14, color: Colors.headerTextMuted, lineHeight: 21 },

  // Form
  formBlock: {
    marginTop: 28,
    marginHorizontal: 22,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  errorBox:  { backgroundColor: Colors.errorBg, borderRadius: 10, padding: 14, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: Colors.error },
  errorText: { color: Colors.errorDark, fontSize: 13, lineHeight: 19 },
  row:       { flexDirection: 'row', gap: 12 },
  half:      { flex: 1 },
  submitBtn: { marginTop: 20 },

  // Footer
  footer:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 28 },
  footerText:{ color: Colors.textMuted, fontSize: 14 },
  footerLink:{ color: Colors.primary, fontSize: 14, fontWeight: '700' },

  // Succès
  successRoot:   { flex: 1, backgroundColor: Colors.background },
  successHeader: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: 26,
    paddingBottom: 44,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  successBody:      { flex: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 48, gap: 16 },
  successCheck:     { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  successCheckText: { fontSize: 32, color: Colors.primary, fontWeight: '900' },
  successTitle:     { fontSize: 26, fontWeight: '800', color: Colors.primaryDark },
  successText:      { fontSize: 15, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  successSubtext:   { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, marginTop: -4 },
  successBtn:       { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 28, marginTop: 4, width: '100%', alignItems: 'center' },
  successBtnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  successLink:      { marginTop: 4, color: Colors.textMuted, fontSize: 13 },
});
