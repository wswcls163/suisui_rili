import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { notificationTimeText } from '../core/notification';
import { useNotifications } from '../state/NotificationProvider';
import { ChoiceField, colors, common, Icon } from './ui';

const HOURS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')} 时`);
const MINUTES = Array.from({ length: 60 }, (_, minute) => `${String(minute).padStart(2, '0')} 分`);

export function NotificationSettingsCard() {
  const notifications = useNotifications();
  const { settings } = notifications;
  const busy = notifications.status === 'loading' || notifications.status === 'scheduling';
  const time = notificationTimeText(settings);
  const statusText = notifications.error
    ? notifications.error
    : !settings.enabled
      ? '提醒目前已关闭。开启时手机会请求系统通知权限。'
      : !notifications.supported
        ? `电脑预览：将于 ${time} 提醒；真正的系统通知需在手机安装包中开启。`
        : notifications.status === 'denied'
          ? '系统通知权限未开启，请到手机设置中允许岁岁日历发送通知。'
          : notifications.status === 'ready'
            ? `已安排 ${notifications.scheduledCount} 条提醒，记录变化后会自动更新。`
            : '正在更新系统提醒…';
  return (
    <View style={[common.card, styles.card]}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Icon name="notifications-outline" color={colors.accent} size={24} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text accessibilityRole="header" style={common.heading}>
            重要日期提醒
          </Text>
          <Text style={common.muted}>应用关闭或锁屏后，也能按时收到提醒</Text>
        </View>
        <Switch
          accessibilityLabel="重要日期提醒开关"
          accessibilityState={{ busy }}
          disabled={busy}
          value={settings.enabled}
          onValueChange={(enabled) => void notifications.setEnabled(enabled)}
          trackColor={{ false: '#D7DAD5', true: '#DDA99D' }}
          thumbColor={settings.enabled ? colors.accent : '#FFF'}
        />
      </View>

      <View style={styles.rules}>
        <ReminderRule icon="flag-outline" label="节日与节气" value={`当天 ${time} · 重叠合并`} />
        <ReminderRule icon="gift-outline" label="生日" value={`当天 ${time}`} />
        <ReminderRule icon="sparkles-outline" label="每年纪念" value={`周年当天 ${time}`} />
        <ReminderRule icon="calendar-outline" label="记录天数" value="不发送通知" />
      </View>

      <View style={styles.timeSection}>
        <Text style={styles.label}>通知时间</Text>
        <View style={styles.timeFields}>
          <ChoiceField
            label="小时"
            options={HOURS}
            value={settings.hour + 1}
            disabled={!settings.enabled || busy}
            onChange={(value) => void notifications.setTime(value - 1, settings.minute)}
          />
          <ChoiceField
            label="分钟"
            options={MINUTES}
            value={settings.minute + 1}
            disabled={!settings.enabled || busy}
            onChange={(value) => void notifications.setTime(settings.hour, value - 1)}
          />
        </View>
      </View>

      <View style={[styles.status, notifications.error && styles.errorStatus]}>
        <Icon
          name={notifications.error ? 'alert-circle-outline' : 'information-circle-outline'}
          color={notifications.error ? colors.error : colors.muted}
          size={18}
        />
        <Text style={[common.muted, { flex: 1 }, notifications.error && { color: colors.error }]}>
          {statusText}
        </Text>
      </View>
    </View>
  );
}

function ReminderRule({
  icon,
  label,
  value,
}: {
  icon: 'flag-outline' | 'gift-outline' | 'sparkles-outline' | 'calendar-outline';
  label: string;
  value: string;
}) {
  return (
    <View style={styles.rule}>
      <Icon name={icon} color={colors.green} size={18} />
      <Text style={[common.body, { flex: 1 }]}>{label}</Text>
      <Text style={common.muted}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rules: { borderRadius: 14, backgroundColor: '#F8F7F3', paddingHorizontal: 14 },
  rule: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  timeSection: { gap: 9 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  timeFields: { flexDirection: 'row', gap: 10 },
  status: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#F8F7F3',
    padding: 12,
  },
  errorStatus: { backgroundColor: '#FCEDEA' },
});
