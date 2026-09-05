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
