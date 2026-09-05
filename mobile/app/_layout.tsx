import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../src/state/AppProvider';
import { AuthProvider } from '../src/state/AuthProvider';
import { SyncProvider } from '../src/state/SyncProvider';
import { colors } from '../src/components/ui';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SyncProvider>
          <AppProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
            />
          </AppProvider>
        </SyncProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
