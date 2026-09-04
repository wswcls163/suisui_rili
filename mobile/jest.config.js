module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/storage.test.ts$'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  clearMocks: true,
};
