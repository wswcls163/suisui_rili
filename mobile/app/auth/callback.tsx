import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, common, Icon } from '../../src/components/ui';
import { useAuth } from '../../src/state/AuthProvider';

export default function AuthCallback() {
  const auth = useAuth();
  useEffect(() => {
    if (
      auth.status === 'authenticated' ||
      auth.status === 'recovery' ||
      (auth.status === 'guest' && auth.error)
    )
      router.replace('/account');
  }, [auth.error, auth.status]);
  return (
    <SafeAreaView style={common.page}>
      <View style={[common.content, { maxWidth: 620, flex: 1, justifyContent: 'center' }]}>
        <View
          style={[common.card, { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 16 }]}
        >
          <Icon name="mail-open-outline" size={34} color={colors.accent} />
          <Text accessibilityRole="header" style={common.heading}>
            正在确认邮箱链接
          </Text>
          <Text style={[common.muted, { textAlign: 'center' }]}>完成后会自动进入账号页面。</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
