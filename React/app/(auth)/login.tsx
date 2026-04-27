/**
 * app/(auth)/login.tsx — Écran de connexion
 */
import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Link, Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { login } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/Colors';

export default function LoginScreen() {
  const { session } = useAuth();
  const router      = useRouter();
  const insets      = useSafeAreaInsets();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  if (session) return <Redirect href="/(app)" />;

  const handleLogin = async () => {
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) { setError('Renseignez votre email et votre mot de passe.'); return; }

    setLoading(true);
    try {
      const result = await login(trimmed, password);
      if (!result.success) setError(result.error ?? 'Identifiants incorrects.');
      else router.replace('/(app)');
    } catch (e: any) {
      setError(e?.message ?? 'Une erreur inattendue est survenue.');
    } finally {
      setLoading(false);
    }
  };

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
          <Text style={s.heroTitle}>Bon retour</Text>
          <Text style={s.heroSub}>Connectez-vous pour accéder à votre tableau de bord</Text>
        </View>

        {/* ─── FORMULAIRE ─────────────────────────────────────────────────── */}
        <View style={s.formBlock}>

          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

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

          <Button onPress={handleLogin} loading={loading} style={s.submitBtn}>
            Se connecter
          </Button>

          <TouchableOpacity style={s.forgotRow}>
            <Text style={s.forgotText}>Mot de passe oublié ?</Text>
          </TouchableOpacity>
        </View>

        {/* ─── PIED DE PAGE ───────────────────────────────────────────────── */}
        <View style={s.footer}>
          <Text style={s.footerText}>Pas encore de compte ? </Text>
          <Link href="/(auth)/register" style={s.footerLink}>Créer un compte</Link>
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

  // Form card
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
  submitBtn: { marginTop: 20 },
  forgotRow: { alignItems: 'center', paddingTop: 10 },
  forgotText:{ fontSize: 13, color: Colors.textMuted },

  // Footer
  footer:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 28 },
  footerText:{ color: Colors.textMuted, fontSize: 14 },
  footerLink:{ color: Colors.primary, fontSize: 14, fontWeight: '700' },
});
