import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../state/AuthProvider';
import { useAccountSync } from '../state/SyncProvider';
import { colors, common, Icon } from './ui';

export type HomeSection = 'calendar' | 'book' | 'countup';
export type NavigationSection = HomeSection | 'notifications' | 'account';

type MenuIcon = React.ComponentProps<typeof Icon>['name'];

type NavigationDrawerProps = {
  active: NavigationSection;
  birthdayCount?: number;
  countupCount?: number;
  phonePreview?: boolean;
  onSelectHomeSection?: (section: HomeSection) => void;
  onOpenDateCalculator?: () => void;
};

export function NavigationDrawer({
  active,
  birthdayCount = 0,
  countupCount = 0,
  phonePreview = false,
  onSelectHomeSection,
  onOpenDateCalculator,
}: NavigationDrawerProps) {
  const [open, setOpen] = useState(false);
  const auth = useAuth();
  const sync = useAccountSync();
  const previewParams = phonePreview ? { preview: 'phone' } : {};
  const signedInStatus =
    sync.status === 'synced'
      ? '已登录并同步'
      : sync.status === 'syncing'
        ? '正在同步'
        : sync.status === 'error'
          ? '已登录 · 同步失败'
          : sync.status === 'conflict'
            ? '已登录 · 待处理冲突'
            : '已登录 · 仅本机';
  const accountColor =
    sync.status === 'error'
      ? colors.error
      : sync.status === 'syncing' || sync.status === 'conflict'
        ? colors.accent
        : colors.green;

  const selectHome = (section: HomeSection) => {
    setOpen(false);
    if (onSelectHomeSection) {
      onSelectHomeSection(section);
      return;
    }
    router.push({ pathname: '/', params: { tab: section, ...previewParams } });
  };
  const openCalculator = () => {
    setOpen(false);
    if (onOpenDateCalculator) {
      onOpenDateCalculator();
      return;
    }
    router.push({ pathname: '/', params: { tool: 'calculator', ...previewParams } });
  };
  const openSettings = (section: 'notifications' | 'account') => {
    setOpen(false);
    router.push({ pathname: '/account', params: { section, ...previewParams } });
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="打开功能菜单"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.menuButton, pressed && { opacity: 0.68 }]}
      >
        <Icon name="menu-outline" color={colors.ink} size={23} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        accessibilityViewIsModal
        statusBarTranslucent
      >
        <View style={styles.modalRoot}>
          <SafeAreaView style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <View style={styles.brandMark}>
                <Icon name="calendar-outline" color="#FFF" size={22} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.brand}>岁岁日历</Text>
                <Text style={common.eyebrow}>功能菜单</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="关闭功能菜单"
                onPress={() => setOpen(false)}
                style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.6 }]}
              >
                <Icon name="close" color={colors.muted} size={22} />
              </Pressable>
            </View>

            <View style={styles.menuGroup}>
              <Text style={styles.groupLabel}>主要功能</Text>
              <MenuItem
                icon="calendar-outline"
                label="我的日历"
                selected={active === 'calendar'}
                onPress={() => selectHome('calendar')}
              />
              <MenuItem
                icon="book-outline"
                label="生日簿"
                detail={`${birthdayCount}`}
                selected={active === 'book'}
                onPress={() => selectHome('book')}
              />
              <MenuItem
                icon="sparkles-outline"
                label="时光记"
                detail={`${countupCount}`}
                selected={active === 'countup'}
                onPress={() => selectHome('countup')}
              />
              <MenuItem icon="calculator-outline" label="日期计算" onPress={openCalculator} />
            </View>

            <View style={styles.divider} />

            <View style={styles.menuGroup}>
              <Text style={styles.groupLabel}>设置</Text>
              <MenuItem
                icon="notifications-outline"
                label="重要日期提醒"
                selected={active === 'notifications'}
                onPress={() => openSettings('notifications')}
              />
              <MenuItem
                icon="cloud-outline"
                label="账号与同步"
                selected={active === 'account'}
                onPress={() => openSettings('account')}
              />
            </View>

            <View style={styles.accountSummary}>
              <Icon
                name={auth.session ? 'cloud-done-outline' : 'person-outline'}
                color={accountColor}
                size={18}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.accountStatus}>
                  {auth.session ? signedInStatus : auth.status === 'unconfigured' ? '本地使用' : '尚未登录'}
                </Text>
                {!!auth.session?.email && (
                  <Text numberOfLines={1} style={common.muted}>
                    {auth.session.email}
                  </Text>
                )}
              </View>
            </View>
          </SafeAreaView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭功能菜单遮罩"
            onPress={() => setOpen(false)}
            style={styles.scrim}
          />
        </View>
      </Modal>
    </>
  );
}

function MenuItem({
  icon,
  label,
  detail,
  selected = false,
  onPress,
}: {
  icon: MenuIcon;
  label: string;
  detail?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`功能菜单：${label}${detail ? ` ${detail}` : ''}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, selected && styles.selectedItem, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.itemIcon, selected && styles.selectedIcon]}>
        <Icon name={icon} color={selected ? colors.accent : colors.muted} size={20} />
      </View>
      <Text style={[styles.itemLabel, selected && { color: colors.accent }]}>{label}</Text>
      {!!detail && <Text style={[common.muted, selected && { color: colors.accent }]}>{detail}</Text>}
      <Icon name="chevron-forward" color={selected ? colors.accent : '#A9AEAA'} size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRoot: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(24, 33, 36, 0.42)' },
  drawer: {
    width: '84%',
    maxWidth: 330,
    height: '100%',
    backgroundColor: colors.background,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 18,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 5, height: 0 },
    elevation: 12,
  },
  scrim: { flex: 1 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 5 },
  brandMark: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { color: colors.ink, fontSize: 19, fontWeight: '700', letterSpacing: 1 },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  menuGroup: { gap: 6 },
  groupLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    paddingHorizontal: 12,
    marginBottom: 3,
  },
  menuItem: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedItem: { backgroundColor: colors.tint },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#ECEDE9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedIcon: { backgroundColor: '#F7DCD4' },
  itemLabel: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '500' },
  divider: { height: 1, backgroundColor: colors.line, marginHorizontal: 8 },
  accountSummary: {
    marginTop: 'auto',
    borderRadius: 14,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: colors.line,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountStatus: { color: colors.ink, fontSize: 13, fontWeight: '600' },
});
