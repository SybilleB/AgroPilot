/**
 * app/(app)/_layout.tsx — Navigation par onglets (zone protégée)
 *
 * 5 onglets : Accueil | Rentabilité | Météo | Subventions | Profil
 * Tous les noms de fichier sont en minuscules (convention du projet).
 */
import { Tabs } from 'expo-router';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/Colors';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        headerShown:             false,
        tabBarButton:            HapticTab,
        tabBarStyle:             { backgroundColor: Colors.tabBackground },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil — AgroPilot',
          tabBarLabel: 'Accueil',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="rentabilite"
        options={{
          title: 'Rentabilité — AgroPilot',
          tabBarLabel: 'Rentabilité',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="meteo"
        options={{
          title: 'Météo agricole — AgroPilot',
          tabBarLabel: 'Météo',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="cloud.sun.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="subventions"
        options={{
          title: 'Subventions — AgroPilot',
          tabBarLabel: 'Subventions',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="eurosign.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Mon profil — AgroPilot',
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
