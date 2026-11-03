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

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={!isSupabaseConfigured}>
        <Stack.Screen name="setup" options={{ title: 'Einrichtung' }} />
      </Stack.Protected>

      <Stack.Protected guard={isSupabaseConfigured && !loggedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={needsName}>
        <Stack.Screen name="name" options={{ title: 'Willkommen' }} />
      </Stack.Protected>

      <Stack.Protected guard={ready && profile?.role === 'customer'}>
        <Stack.Screen name="(customer)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={ready && profile?.role === 'admin'}>
        <Stack.Screen name="admin/index" options={{ title: 'QR-Code scannen' }} />
        <Stack.Screen name="admin/result" options={{ title: 'Besuch erfasst' }} />
      </Stack.Protected>
    </Stack>
  );
}
