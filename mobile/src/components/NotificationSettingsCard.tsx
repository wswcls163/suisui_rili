import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { notificationTimeText } from '../core/notification';
import { useNotifications } from '../state/NotificationProvider';
import { Button, ChoiceField, colors, common, Icon } from './ui';

const HOURS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')} 时`);
const MINUTES = Array.from({ length: 60 }, (_, minute) => `${String(minute).padStart(2, '0')} 分`);

export function NotificationSettingsCard() {
  const notifications = useNotifications();
  const { settings } = notifications;
  const busy = notifications.status === 'loading' || notifications.status === 'scheduling';
  const time = notificationTimeText(settings);
  const channelWarning =
    notifications.diagnostics.channel === 'blocked'
      ? '通知渠道已关闭，系统不会显示提醒。'
      : notifications.diagnostics.channel === 'low-priority'
        ? '通知渠道优先级不足，可能没有顶部横幅。'
        : notifications.diagnostics.channel === 'silent'
          ? '通知渠道的声音或振动已被关闭。'
          : notifications.diagnostics.channel === 'missing'
            ? '通知渠道尚未建立，请重新检测。'
            : '';
  const exactWarning =
    notifications.diagnostics.exactAlarm === 'unavailable'
      ? '“闹钟和提醒”权限未开启，Android 可能延迟送达。'
      : notifications.diagnostics.exactAlarm === 'unknown'
        ? '当前安装包无法检测精确提醒权限，请安装包含可靠性诊断的新版本。'
        : '';
  const statusText = notifications.error
    ? notifications.error
    : !settings.enabled
      ? '提醒目前已关闭。开启时手机会请求系统通知权限。'
      : !notifications.supported
        ? `电脑预览：将于 ${time} 提醒；真正的系统通知需在手机安装包中开启。`
        : notifications.status === 'denied'
          ? '系统通知权限未开启，请到手机设置中允许岁岁日历发送通知。'
          : notifications.status === 'ready'
            ? channelWarning ||
              exactWarning ||
              `已安排 ${notifications.scheduledCount} 条提醒，系统排程核对通过。`
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
          <Text style={common.muted}>后台、划掉最近任务或锁屏后由系统送达（强行停止除外）</Text>
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

      <View style={styles.diagnostics}>
        <Text style={styles.label}>送达诊断</Text>
        <DiagnosticRow
          label="通知权限"
          value={permissionText(notifications.diagnostics.permission)}
          ready={notifications.diagnostics.permission === 'granted'}
        />
        <DiagnosticRow
          label="顶部横幅渠道"
          value={channelText(notifications.diagnostics.channel)}
          ready={
            notifications.diagnostics.channel === 'ready' ||
            notifications.diagnostics.channel === 'not-applicable'
          }
        />
        <DiagnosticRow
          label="准时提醒"
          value={exactAlarmText(notifications.diagnostics.exactAlarm)}
          ready={
            notifications.diagnostics.exactAlarm === 'available' ||
            notifications.diagnostics.exactAlarm === 'not-applicable'
          }
        />
        <View style={styles.actionGrid}>
          <Button
            label="1 分钟后测试通知"
            icon="timer-outline"
            busy={notifications.testing}
            variant="secondary"
            style={styles.actionButton}
            onPress={() => void notifications.scheduleTestNotification()}
          />
          {notifications.supported ? (
            <>
              <Button
                label="通知渠道设置"
                icon="notifications-outline"
                variant="secondary"
                style={styles.actionButton}
                onPress={() => void notifications.openNotificationSettings()}
              />
              {(notifications.diagnostics.exactAlarm === 'unavailable' ||
                notifications.diagnostics.exactAlarm === 'unknown') && (
                <Button
                  label="准时提醒设置"
                  icon="alarm-outline"
                  variant="secondary"
                  style={styles.actionButton}
                  onPress={() => void notifications.openExactAlarmSettings()}
                />
              )}
              <Button
                label="电池与后台设置"
                icon="battery-half-outline"
                variant="secondary"
                style={styles.actionButton}
                onPress={() => void notifications.openBatterySettings()}
              />
              <Button
                label="重新检测"
                icon="refresh-outline"
                variant="quiet"
                style={styles.actionButton}
                onPress={() => void notifications.refreshDiagnostics()}
              />
            </>
          ) : null}
        </View>
        {notifications.testMessage ? (
          <Text accessibilityLiveRegion="polite" style={styles.testMessage}>
            {notifications.testMessage}
          </Text>
        ) : null}
        <Text style={common.muted}>
          测试时可立即锁屏或划掉应用；不要在系统设置中点“强行停止”。Android
          强行停止会撤销本应用继续接收和触发本地提醒的资格，重新打开应用后才会恢复排程。部分品牌手机还需允许自启动，并把电池策略设为“不限制”。
        </Text>
      </View>
    </View>
  );
}

function DiagnosticRow({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <View style={styles.diagnosticRow}>
      <View style={[styles.dot, { backgroundColor: ready ? colors.green : colors.accent }]} />
      <Text style={[common.body, { flex: 1 }]}>{label}</Text>
      <Text style={[common.muted, !ready && { color: colors.accent }]}>{value}</Text>
    </View>
  );
}

function permissionText(value: 'granted' | 'denied' | 'undetermined'): string {
  if (value === 'granted') return '已允许';
  if (value === 'denied') return '已拒绝';
  return '尚未询问';
}

function channelText(
  value: 'ready' | 'missing' | 'blocked' | 'low-priority' | 'silent' | 'not-applicable',
): string {
  if (value === 'ready') return '高优先级 · 声音和振动';
  if (value === 'blocked') return '已关闭';
  if (value === 'low-priority') return '优先级不足';
  if (value === 'silent') return '声音或振动关闭';
  if (value === 'not-applicable') return '手机安装包中检测';
  return '尚未建立';
}

function exactAlarmText(value: 'available' | 'unavailable' | 'not-applicable' | 'unknown'): string {
  if (value === 'available') return '可准时触发';
  if (value === 'unavailable') return '未授权，可能延迟';
  if (value === 'not-applicable') return '手机安装包中检测';
  return '当前版本无法检测';
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
  diagnostics: { gap: 10 },
  diagnosticRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  actionButton: { minWidth: 148, flexGrow: 1 },
  testMessage: {
    color: colors.green,
    fontSize: 13,
    lineHeight: 21,
    borderRadius: 10,
    backgroundColor: '#EDF3EE',
    padding: 10,
  },
});
