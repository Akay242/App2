import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Loading } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  );
}

/**
 * Welche Bildschirme erreichbar sind, hängt vom Login-Zustand und der Rolle ab.
 * Nicht erlaubte Bildschirme sind gesperrt, man landet automatisch beim ersten erlaubten.
 */
function RootNavigator() {
  const { loading, session, profile } = useAuth();
  if (loading) return <Loading />;

  const loggedIn = Boolean(session && profile);
  const needsName = loggedIn && !profile?.first_name;
  const ready = loggedIn && !needsName;

  // Wohin gesperrte Seiten weiterleiten (z. B. die Login-Seite direkt nach dem Anmelden).
  // Ohne explizites Ziel könnte der Router auf einer immer erreichbaren Seite wie dem
  // Impressum landen.
  const home = !isSupabaseConfigured
    ? '/setup'
    : !loggedIn
      ? '/login'
      : needsName
        ? '/name'
        : profile?.role === 'admin'
          ? '/admin'
          : '/';

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={!isSupabaseConfigured} redirectTo={home}>
        <Stack.Screen name="setup" options={{ title: 'Einrichtung' }} />
      </Stack.Protected>

      <Stack.Protected guard={isSupabaseConfigured && !loggedIn} redirectTo={home}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={needsName} redirectTo={home}>
        <Stack.Screen name="name" options={{ title: 'Willkommen' }} />
      </Stack.Protected>

      <Stack.Protected guard={ready && profile?.role === 'customer'} redirectTo={home}>
        <Stack.Screen name="(customer)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={ready && profile?.role === 'admin'} redirectTo={home}>
        <Stack.Screen name="admin/index" options={{ title: 'QR-Code scannen' }} />
        <Stack.Screen name="admin/result" options={{ title: 'Besuch erfasst' }} />
      </Stack.Protected>

      {/* Immer erreichbar, auch ohne Anmeldung. */}
      <Stack.Screen name="impressum" options={{ title: 'Impressum' }} />
      <Stack.Screen name="datenschutz" options={{ title: 'Datenschutz' }} />
    </Stack>
  );
}
