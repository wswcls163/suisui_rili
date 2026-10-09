import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../ui';
import type { HomeSection } from './homeNavigation';
import { defaultHomeTheme, type HomeTheme } from './homeTheme';

const items = [
  { key: 'calendar', label: '日历', icon: 'calendar-outline' },
  { key: 'book', label: '生日簿', icon: 'gift-outline' },
  { key: 'countup', label: '时光记', icon: 'sparkles-outline' },
  { key: 'account', label: '我的', icon: 'person-outline' },
] as const;

export function HomeBottomNavigation({
  active,
  birthdayCount,
  countupCount,
  onSelect,
  onAccount,
  theme = defaultHomeTheme,
}: {
  active: HomeSection;
  birthdayCount: number;
  countupCount: number;
  onSelect: (section: HomeSection) => void;
  onAccount: () => void;
  theme?: HomeTheme;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View accessibilityRole="tablist" style={styles.navigation}>
      {items.map((item) => {
        const selected = item.key === active;
        const accessibilityLabel =
          item.key === 'book'
            ? `生日簿 ${birthdayCount}`
            : item.key === 'countup'
              ? `时光记 ${countupCount}`
              : item.label;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ selected }}
            onPress={() => (item.key === 'account' ? onAccount() : onSelect(item.key))}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <Icon
              name={selected && item.key === 'calendar' ? 'calendar' : item.icon}
              size={21}
              color={selected ? theme.colors.accent : theme.colors.navInactive}
            />
            <Text style={[styles.label, selected && styles.selectedLabel]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(theme: HomeTheme) {
  const { colors, typography, spacing, size } = theme;
  return StyleSheet.create({
    navigation: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      flexDirection: 'row',
      height: size.bottomNavigation,
    },
    item: { alignItems: 'center', flex: 1, justifyContent: 'center' },
    label: {
      color: colors.navInactive,
      fontSize: typography.caption,
      fontWeight: typography.medium,
      marginTop: spacing.xxs,
    },
    selectedLabel: { color: colors.accent, fontWeight: typography.semibold },
    pressed: { backgroundColor: colors.pressed },
  });
}
