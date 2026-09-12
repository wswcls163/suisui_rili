import React from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AccountScreen, type AccountSection } from '../src/components/AccountScreen';
import { useBirthdays } from '../src/state/AppProvider';

export default function AccountRoute() {
  const params = useLocalSearchParams<{ section?: string | string[]; preview?: string | string[] }>();
  const app = useBirthdays();
  const rawSection = Array.isArray(params.section) ? params.section[0] : params.section;
  const rawPreview = Array.isArray(params.preview) ? params.preview[0] : params.preview;
  const section: AccountSection = rawSection === 'notifications' ? 'notifications' : 'account';
  return (
    <AccountScreen
      section={section}
      phonePreview={Platform.OS === 'web' && rawPreview === 'phone'}
      birthdayCount={app.people.length}
      countupCount={app.countups.length}
    />
  );
}
