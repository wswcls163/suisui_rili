if (typeof globalThis.CustomEvent === 'undefined') {
  Object.defineProperty(globalThis, 'CustomEvent', {
    configurable: true,
    value: class<T = unknown> extends Event {
      readonly detail: T;
      constructor(type: string, init?: CustomEventInit<T>) {
        super(type, init);
        this.detail = init?.detail as T;
      }
    },
  });
}

jest.mock('@expo/vector-icons/Ionicons', () => () => null);
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return function MockCake({ color, size, ...props }: { color: string; size: number }) {
    return React.createElement(Text, { ...props, style: { color, fontSize: size } });
  };
});
jest.mock('../src/data/repository', () => ({ repository: {}, storageDescription: '测试存储' }));
jest.mock('expo-secure-store', () => {
  const values = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void values.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void values.delete(key)),
  };
});
jest.mock('expo-notifications', () => ({
  AndroidImportance: { NONE: 2, LOW: 4, DEFAULT: 5, HIGH: 6 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getNotificationChannelAsync: jest.fn(async () => ({
    id: 'important-dates-popup-v3',
    importance: 6,
    sound: 'default',
    enableVibrate: true,
  })),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async ({ identifier }: { identifier?: string }) => identifier ?? 'test'),
}));
jest.mock('../src/notifications/nativeReliability', () => ({
  nativeNotificationReliability: {
    available: true,
    ensureChannel: jest.fn(async () => {}),
    exactAlarmCapability: jest.fn(async () => 'available'),
    fullScreenCapability: jest.fn(async () => 'available'),
    replace: jest.fn(async (reminders: { identifier: string }[]) => ({
      expectedCount: reminders.length,
      registeredCount: reminders.length,
      identifiers: reminders.map((reminder) => reminder.identifier),
    })),
    clear: jest.fn(async () => {}),
    sendImmediateTest: jest.fn(async () => ({
      identifier: 'suisui-native-immediate-test',
      delivered: true,
      deliveredAt: Date.now(),
    })),
    scheduleDelayedTest: jest.fn(async (triggerAt: number) => ({
      identifier: 'suisui-native-delayed-test',
      registered: true,
      triggerAt,
    })),
    diagnostics: jest.fn(async () => ({
      appNotificationsEnabled: true,
      exactAlarmAvailable: true,
      fullScreenIntentAvailable: true,
      channelExists: true,
      channelImportance: 4,
      channelSoundEnabled: false,
      channelVibrationEnabled: false,
      channelLockscreenVisibility: 1,
      scheduledCount: 0,
      registeredCount: 0,
      registeredIdentifiers: [],
      lastTestScheduledAt: 0,
      lastTestTriggerAt: 0,
      lastDeliveryAt: 0,
      lastDeliveryIdentifier: '',
    })),
    openExactAlarmSettings: jest.fn(async () => {}),
    openFullScreenIntentSettings: jest.fn(async () => {}),
    openNotificationSettings: jest.fn(async () => {}),
    openBatterySettings: jest.fn(async () => {}),
  },
}));
