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
    id: 'important-dates-v2',
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
    exactAlarmCapability: jest.fn(async () => 'available'),
    openExactAlarmSettings: jest.fn(async () => {}),
    openNotificationSettings: jest.fn(async () => {}),
    openBatterySettings: jest.fn(async () => {}),
  },
}));
