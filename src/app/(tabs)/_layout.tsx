import { Tabs } from 'expo-router';

import { PingTabBar } from '@/components/PingTabBar';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <PingTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Family' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="trends" options={{ title: 'Trends' }} />
    </Tabs>
  );
}
