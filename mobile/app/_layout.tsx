import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '../src/state/AppProvider';
import { AuthProvider } from '../src/state/AuthProvider';
import { SyncProvider } from '../src/state/SyncProvider';
import { NotificationProvider } from '../src/state/NotificationProvider';
import { colors } from '../src/components/ui';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SyncProvider>
          <AppProvider>
            <NotificationProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
              />
            </NotificationProvider>
          </AppProvider>
        </SyncProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
