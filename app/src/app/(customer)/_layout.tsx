import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { useAuth } from '@/lib/auth';
import { colors } from '@/theme';

/** Kundenbereich mit drei Reitern: Stempelkarte, Preise, Salon-Infos. */
export default function CustomerTabs() {
  const { signOut } = useAuth();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        sceneStyle: { backgroundColor: colors.background },
        headerRight: () => (
          <Pressable onPress={signOut} hitSlop={12} accessibilityRole="button" style={{ marginRight: 16 }}>
            <Text style={{ color: colors.textMuted }}>Abmelden</Text>
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Stempelkarte',
          tabBarLabel: 'Karte',
          tabBarIcon: ({ focused, size }) => (
            <Ionicons name="qr-code-outline" size={size} color={focused ? colors.accent : colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="preise"
        options={{
          title: 'Preise & Leistungen',
          tabBarLabel: 'Preise',
          tabBarIcon: ({ focused, size }) => (
            <Ionicons name="pricetags-outline" size={size} color={focused ? colors.accent : colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="salon"
        options={{
          title: 'Salon',
          tabBarIcon: ({ focused, size }) => (
            <Ionicons name="storefront-outline" size={size} color={focused ? colors.accent : colors.textMuted} />
          ),
        }}
      />
    </Tabs>
  );
}
