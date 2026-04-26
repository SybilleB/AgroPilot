/**
 * app/_layout.tsx — Layout racine + garde d'authentification
 *
 * Pattern :
 *  - Pendant le chargement → écran blanc (évite le flash)
 *  - Session active  → redirige vers /(app) si on est sur landing/auth
 *  - Pas de session  → redirige vers /     si on est dans une zone protégée
 *
 * Important : profile.tsx NE doit PAS appeler router.replace après logout.
 * Le guard ici s'en charge seul via onAuthStateChange.
 */
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/Colors';

export default function RootLayout() {
  const { session, loading } = useAuth();
  const router   = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inApp          = segments[0] === '(app)';
    const inProfileSetup = segments[0] === 'profile-setup';
    const inProtected    = inApp || inProfileSetup;

    if (!session && inProtected) {
      // Pas de session dans une zone protégée → login
      // On va vers /login et non '/' car sur web, (app)/index et app/index
      // ont tous les deux l'URL '/' → router.replace('/') ne navigue pas.
      router.replace('/(auth)/login');
    } else if (session && !inProtected) {
      // Session active mais hors zone protégée → dashboard
      router.replace('/(app)');
    }
  }, [session, loading, segments]);

  // Pendant le chargement initial, on affiche un écran neutre
  // pour éviter le flash entre landing et dashboard
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index"         options={{ headerShown: false }} />
        <Stack.Screen name="(auth)"        options={{ headerShown: false }} />
        <Stack.Screen name="(app)"         options={{ headerShown: false }} />
        <Stack.Screen name="profile-setup" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
