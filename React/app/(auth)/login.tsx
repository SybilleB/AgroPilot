/**
 * app/(auth)/login.tsx — Écran de connexion
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { login } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/Colors';

export default function LoginScreen() {
  const { session } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  if (session) return <Redirect href="/(app)" />;

  const handleLogin = async () => {
    setError('');
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) { setError('Merci de renseigner votre email et mot de passe.'); return; }

    setLoading(true);
    try {
      const result = await login(trimmedEmail, password);
      if (!result.success) setError(result.error ?? 'Erreur de connexion.');
      // Si succès → _layout.tsx redirige automatiquement vers (app)
    } catch (e: any) {
      setError(e?.message ?? 'Une erreur inattendue est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <Text style={styles.logo}>🌾</Text>
          <Text style={styles.title}>AgroPilot</Text>
          <Text style={styles.subtitle}>Votre copilote financier agricole</Text>
        </View>

        <View style={styles.form}>
          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>⚠️ {error}</Text></View> : null}

          <Input label="Email" placeholder="exemple@ferme.fr" value={email} onChangeText={setEmail}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

          <Input label="Mot de passe" placeholder="••••••••" value={password} onChangeText={setPassword}
            secureTextEntry />

          <Button onPress={handleLogin} loading={loading} style={styles.button}>Se connecter</Button>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Pas encore de compte ? </Text>
          <Link href="/(auth)/register" style={styles.link}>S'inscrire</Link>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:  { flexGrow: 1, backgroundColor: Colors.white, paddingHorizontal: 28, paddingTop: 80, paddingBottom: 40 },
  header:     { alignItems: 'center', marginBottom: 48 },
  logo:       { fontSize: 56, marginBottom: 12 },
  title:      { fontSize: 32, fontWeight: '700', color: Colors.primaryDark, letterSpacing: 0.5 },
  subtitle:   { fontSize: 14, color: Colors.textMuted, marginTop: 6, textAlign: 'center' },
  form:       { gap: 0 },
  errorBox:   { backgroundColor: Colors.errorBg, borderRadius: 8, padding: 12, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: Colors.error },
  errorText:  { color: Colors.errorDark, fontSize: 13, lineHeight: 18 },
  button:     { marginTop: 24 },
  footer:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 32 },
  footerText: { color: Colors.textMuted, fontSize: 14 },
  link:       { color: Colors.primary, fontSize: 14, fontWeight: '600' },
});
