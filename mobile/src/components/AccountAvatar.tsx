import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { avatarInitial } from '../avatar/model';
import { defaultHomeTheme, type HomeTheme } from './home/homeTheme';
import { Icon } from './ui';

export function AccountAvatar({
  uri,
  email,
  loggedIn,
  size = 40,
  theme = defaultHomeTheme,
}: {
  uri: string | null;
  email?: string;
  loggedIn: boolean;
  size?: number;
  theme?: HomeTheme;
}) {
  const initial = loggedIn ? avatarInitial(email) : '';
  return (
    <View
      testID="账号头像"
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {uri ? (
        <Image
          accessibilityLabel="账号头像照片"
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : initial ? (
        <Text style={{ color: theme.colors.accent, fontSize: size * 0.4, fontWeight: theme.typography.bold }}>
          {initial}
        </Text>
      ) : (
        <Icon name="person-outline" size={size * 0.5} color={theme.colors.textSecondary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
