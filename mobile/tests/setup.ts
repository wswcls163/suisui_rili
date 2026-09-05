jest.mock('@expo/vector-icons/Ionicons', () => () => null);
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return function MockCake({ color, size, ...props }: { color: string; size: number }) {
    return React.createElement(Text, { ...props, style: { color, fontSize: size } });
  };
});
jest.mock('../src/data/repository', () => ({ repository: {}, storageDescription: '测试存储' }));
