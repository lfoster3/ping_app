import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/** Android channel the `notify` function targets (supabase/functions/_shared/push.ts). */
const CHANNEL_ID = 'messages';

if (Platform.OS !== 'web') {
  // Show message notifications even while the app is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type PushResult = { token: string } | { skipped: string };

/**
 * Asks for permission and returns this phone's Expo push token. Needs a
 * development build on a real device and an EAS project id (`eas init`).
 */
export async function getPushToken(): Promise<PushResult> {
  if (Platform.OS === 'web') return { skipped: 'Push notifications are phone-only.' };
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { skipped: 'No EAS project id yet — run `eas init`.' };

  if (Platform.OS === 'android') {
    // Android 13+ won't show the permission prompt until a channel exists.
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return { skipped: 'Notifications are turned off for Ping.' };

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return { token: data };
}

/** Tapping a message notification opens that conversation (the push carries a `url`). */
export function useNotificationTaps() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as Href);
    };
    // Covers a tap that launched the app from closed.
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
