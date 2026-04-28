/**
 * app/(auth)/_layout.tsx — Stack navigation pour les écrans d'authentification
 */
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login"    options={{ title: 'Connexion — AgroPilot' }} />
      <Stack.Screen name="register" options={{ title: 'Inscription — AgroPilot' }} />
    </Stack>
  );
}
