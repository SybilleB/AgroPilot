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
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/Colors';

export default function RootLayout() {
  const { session, loading } = useAuth();
  const router     = useRouter();
  const segments   = useSegments();
  // Évite les redirections en boucle : on ne navigue pas si une navigation
  // est déjà en cours.
  const navigating = useRef(false);

  useEffect(() => {
    if (loading) return;

    const inApp          = segments[0] === '(app)';
    const inProfileSetup = segments[0] === 'profile-setup';
    const inProtected    = inApp || inProfileSetup;

    if (!session && inProtected && !navigating.current) {
      navigating.current = true;
      router.replace('/(auth)/login');
      setTimeout(() => { navigating.current = false; }, 500);
    } else if (session && !inProtected && !navigating.current) {
      navigating.current = true;
      router.replace('/(app)');
      setTimeout(() => { navigating.current = false; }, 500);
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
