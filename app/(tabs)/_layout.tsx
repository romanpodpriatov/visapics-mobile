/**
 * The four tabs, at the colours and sizes of the design reference
 * (lines 1057–1077).
 */
import { Tabs } from 'expo-router';

import { CameraIcon, ImageIcon, PersonIcon, PrinterIcon } from '../../src/components/icons';
import { theme } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.brand,
        tabBarInactiveTintColor: theme.color.faint,
        tabBarLabelStyle: { fontFamily: theme.type.body, fontSize: 10 },
        tabBarStyle: {
          backgroundColor: theme.color.card,
          borderTopColor: theme.color.border,
        },
        sceneStyle: { backgroundColor: theme.color.surface },
      }}
    >
      <Tabs.Screen
        name="photos"
        options={{ title: 'Photos', tabBarIcon: ({ color }) => <CameraIcon color={color} /> }}
      />
      <Tabs.Screen
        name="vault"
        options={{ title: 'Vault', tabBarIcon: ({ color }) => <ImageIcon color={color} /> }}
      />
      <Tabs.Screen
        name="prints"
        options={{ title: 'Prints', tabBarIcon: ({ color }) => <PrinterIcon color={color} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: ({ color }) => <PersonIcon color={color} /> }}
      />
    </Tabs>
  );
}
