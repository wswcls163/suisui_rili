jest.mock('@expo/vector-icons/Ionicons', () => () => null);
jest.mock('../src/data/repository', () => ({ repository: {}, storageDescription: '测试存储' }));
