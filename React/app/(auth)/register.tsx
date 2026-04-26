/**
 * app/(auth)/register.tsx — Écran d'inscription
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Link, Redirect, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { register } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/Colors';

export default function RegisterScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [prenom, setPrenom]                   = useState('');

  if (session) return <Redirect href="/(app)" />;
  const [nom, setNom]                         = useState('');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');
  const [success, setSuccess]                 = useState(false);

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleRegister = async () => {
    setError('');
    const trimmedEmail = email.trim().toLowerCase();
    if (!prenom || !nom || !trimmedEmail || !password || !confirmPassword) {
      setError('Merci de remplir tous les champs.'); return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) { setError('Adresse email invalide.'); return; }
    if (password !== confirmPassword) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }

    setLoading(true);
    try {
      const result = await register({ prenom, nom, email: trimmedEmail, password });
      if (!result.success) setError(result.error ?? "Inscription impossible.");
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
      <View style={styles.successContainer}>
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>Bienvenue !</Text>
        <Text style={styles.successText}>
          Votre compte a été créé. Vérifiez votre boîte mail pour confirmer votre adresse.
        </Text>
        <Text style={styles.successSubtext}>
          Prenez 2 minutes pour configurer votre exploitation — ça permettra à AgroPilot de vous proposer les bonnes aides.
        </Text>
        <TouchableOpacity style={styles.successBtn} onPress={() => router.replace('/profile-setup')}>
          <Text style={styles.successBtnText}>Configurer mon exploitation →</Text>
        </TouchableOpacity>
        <Link href="/(auth)/login" style={styles.successLink}>Plus tard, aller à la connexion</Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <Text style={styles.logo}>🌾</Text>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Rejoignez AgroPilot</Text>
        </View>

        <View style={styles.form}>
          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>⚠️ {error}</Text></View> : null}

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Input label="Prénom" placeholder="Jean" value={prenom} onChangeText={setPrenom} autoCapitalize="words" />
            </View>
            <View style={styles.halfField}>
              <Input label="Nom" placeholder="Dupont" value={nom} onChangeText={setNom} autoCapitalize="words" />
            </View>
          </View>

          <Input label="Email" placeholder="exemple@ferme.fr" value={email} onChangeText={setEmail}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

          <Input label="Mot de passe" placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry />

          <Input label="Confirmer le mot de passe" placeholder="••••••••" value={confirmPassword}
            onChangeText={setConfirmPassword} secureTextEntry />

          <Button onPress={handleRegister} loading={loading} style={styles.button}>Créer mon compte</Button>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Déjà un compte ? </Text>
          <Link href="/(auth)/login" style={styles.link}>Se connecter</Link>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:      { flexGrow: 1, backgroundColor: Colors.white, paddingHorizontal: 28, paddingTop: 70, paddingBottom: 40 },
  header:         { alignItems: 'center', marginBottom: 32 },
  logo:           { fontSize: 48, marginBottom: 10 },
  title:          { fontSize: 28, fontWeight: '700', color: Colors.primaryDark },
  subtitle:       { fontSize: 14, color: Colors.textMuted, marginTop: 4 },
  form:           { gap: 0 },
  errorBox:       { backgroundColor: Colors.errorBg, borderRadius: 8, padding: 12, marginTop: 8, borderLeftWidth: 3, borderLeftColor: Colors.error },
  errorText:      { color: Colors.errorDark, fontSize: 13, lineHeight: 18 },
  row:            { flexDirection: 'row', gap: 12 },
  halfField:      { flex: 1 },
  button:         { marginTop: 24 },
  footer:         { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 28 },
  footerText:     { color: Colors.textMuted, fontSize: 14 },
  link:           { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  // Succès
  successContainer: { flex: 1, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 16 },
  successIcon:      { fontSize: 56 },
  successTitle:     { fontSize: 26, fontWeight: '700', color: Colors.primaryDark },
  successText:      { fontSize: 15, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  successSubtext:   { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, marginTop: -4 },
  successBtn:       { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 28, marginTop: 8, width: '100%', alignItems: 'center' },
  successBtnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  successLink:      { marginTop: 4, color: Colors.textMuted, fontSize: 13 },
});
