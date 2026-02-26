import Constants from 'expo-constants';

type ExtraConfig = {
  testNotificationPassword?: string;
};

const extra =
  (Constants.expoConfig?.extra as ExtraConfig | undefined) ??
  ((Constants.manifest as any)?.extra as ExtraConfig | undefined);

export const TEST_NOTIFICATION_PASSWORD = extra?.testNotificationPassword ?? '';
export const isTestNotificationPasswordConfigured = TEST_NOTIFICATION_PASSWORD.length > 0;
