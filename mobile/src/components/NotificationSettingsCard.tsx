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
        : notifications.diagnostics.channel === 'missing'
          ? '通知渠道尚未建立，请重新检测。'
          : '';
  const exactWarning =
    notifications.diagnostics.exactAlarm === 'unavailable'
      ? '“闹钟和提醒”权限未开启，Android 可能延迟送达。'
      : notifications.diagnostics.exactAlarm === 'unknown'
        ? '当前安装包无法检测精确提醒权限，请安装包含可靠性诊断的新版本。'
        : '';
  const fullScreenWarning =
    settings.fullScreenEnabled && notifications.diagnostics.fullScreen === 'unavailable'
      ? '锁屏全屏权限未开启，锁屏时会降级为普通通知。'
      : settings.fullScreenEnabled && notifications.diagnostics.fullScreen === 'unknown'
        ? '当前安装包无法检测锁屏全屏权限。'
        : '';
  const statusText = notifications.error
    ? notifications.error
    : !settings.enabled
      ? '提醒目前已关闭。开启后会弹出系统授权，点击“允许”后自动生效。'
      : !notifications.supported
        ? `电脑预览：将于 ${time} 提醒；真正的系统通知需在手机安装包中开启。`
        : notifications.status === 'denied'
          ? '系统通知权限未开启，请到手机设置中允许岁岁日历发送通知。'
          : notifications.status === 'ready'
            ? channelWarning ||
              fullScreenWarning ||
              exactWarning ||
              `已安排 ${notifications.scheduledCount} 条提醒，原生登记回读通过。`
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
          <Text style={common.muted}>正常后台或锁屏后由系统送达；部分手机划掉最近任务等同强行停止</Text>
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

      <NotificationStylePreview />

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

      <View style={styles.fullScreenSetting}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.label}>锁屏时全屏提醒</Text>
          <Text style={common.muted}>明确开启后，息屏或锁屏时尝试亮屏显示完整提醒；不会绕过锁屏密码。</Text>
        </View>
        <Switch
          accessibilityLabel="锁屏时全屏提醒开关"
          disabled={!settings.enabled || busy}
          value={settings.fullScreenEnabled}
          onValueChange={(enabled) => void notifications.setFullScreenEnabled(enabled)}
          trackColor={{ false: '#D7DAD5', true: '#DDA99D' }}
          thumbColor={settings.fullScreenEnabled ? colors.accent : '#FFF'}
        />
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
          value={
            notifications.diagnostics.appNotificationsEnabled
              ? permissionText(notifications.diagnostics.permission)
              : '应用通知已关闭'
          }
          ready={
            notifications.diagnostics.permission === 'granted' &&
            notifications.diagnostics.appNotificationsEnabled
          }
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
          label="系统悬浮/横幅开关"
          value={
            notifications.diagnostics.floatingBanner === 'manual-check'
              ? '需到系统设置确认'
              : '手机安装包中确认'
          }
          ready={notifications.diagnostics.floatingBanner === 'not-applicable'}
        />
        <DiagnosticRow
          label="通知声音"
          value={informationSwitchText(notifications.diagnostics.soundEnabled, '默认静音')}
          ready
        />
        <DiagnosticRow
          label="通知振动"
          value={informationSwitchText(notifications.diagnostics.vibrationEnabled, '默认关闭')}
          ready
        />
        <DiagnosticRow
          label="锁屏全屏权限"
          value={fullScreenText(notifications.diagnostics.fullScreen, settings.fullScreenEnabled)}
          ready={
            !settings.fullScreenEnabled ||
            notifications.diagnostics.fullScreen === 'available' ||
            notifications.diagnostics.fullScreen === 'not-applicable'
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
        <DiagnosticRow
          label="原生系统登记"
          value={`${notifications.diagnostics.registeredCount} 个任务可回读`}
          ready={notifications.diagnostics.registeredCount >= notifications.diagnostics.scheduledCount}
        />
        <DiagnosticRow
          label="最近一次原生投递"
          value={deliveryText(
            notifications.diagnostics.lastDeliveryAt,
            notifications.diagnostics.lastDeliveryIdentifier,
          )}
          ready={notifications.diagnostics.lastDeliveryAt > 0}
        />
        <View style={styles.actionGrid}>
          <Button
            label="立即测试顶部横幅"
            icon="notifications-outline"
            busy={notifications.testing}
            variant="secondary"
            style={styles.actionButton}
            onPress={() => void notifications.sendImmediateTestNotification()}
          />
          <Button
            label="1 分钟后锁屏测试"
            icon="timer-outline"
            busy={notifications.testing}
            variant="secondary"
            style={styles.actionButton}
            onPress={() => void notifications.scheduleDelayedTestNotification()}
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
              {settings.fullScreenEnabled &&
                (notifications.diagnostics.fullScreen === 'unavailable' ||
                  notifications.diagnostics.fullScreen === 'unknown') && (
                  <Button
                    label="锁屏全屏设置"
                    icon="phone-portrait-outline"
                    variant="secondary"
                    style={styles.actionButton}
                    onPress={() => void notifications.openFullScreenIntentSettings()}
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
          通知默认无声、无振动。若立即测试只进入通知栏，请在“通知渠道设置”中开启悬浮或横幅。锁屏全屏受 Android
          权限和厂商策略限制，不可用时会降级为普通通知。部分厂商系统会把从最近任务划掉应用当作强行停止，并取消全部已排提醒；请使用返回桌面代替划掉，并在系统中允许自启动与后台运行。被强行停止后必须重新打开应用才能恢复提醒。
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

function NotificationStylePreview() {
  return (
    <View style={styles.previewSection}>
      <Text style={styles.label}>顶部横幅样式预览</Text>
      <View accessible accessibilityLabel="顶部横幅样式预览卡片" style={styles.notificationPreview}>
        <View style={styles.previewIcon}>
          <Icon name="calendar-outline" color="#FFF" size={25} />
        </View>
        <View style={styles.previewContent}>
          <View style={styles.previewMeta}>
            <Text style={styles.previewLabel}>今日提醒</Text>
            <Text style={styles.previewDate}>今天</Text>
          </View>
          <Text numberOfLines={2} style={styles.previewTitle}>
            今天是中秋节 · 妈妈的生日
          </Text>
          <Text numberOfLines={1} style={styles.previewBody}>
            中秋节、妈妈的生日。都值得好好记住。
          </Text>
        </View>
      </View>
      <Text style={common.muted}>实际外层圆角、应用名称和高度由手机系统统一控制，展开后可查看更多内容。</Text>
    </View>
  );
}

function permissionText(value: 'granted' | 'denied' | 'undetermined'): string {
  if (value === 'granted') return '已允许';
  if (value === 'denied') return '已拒绝';
  return '尚未询问';
}

function channelText(value: 'ready' | 'missing' | 'blocked' | 'low-priority' | 'not-applicable'): string {
  if (value === 'ready') return '高优先级';
  if (value === 'blocked') return '已关闭';
  if (value === 'low-priority') return '优先级不足';
  if (value === 'not-applicable') return '手机安装包中检测';
  return '尚未建立';
}

function informationSwitchText(value: boolean | null, disabledText: string): string {
  if (value === null) return '手机安装包中检测';
  return value ? '用户已开启' : disabledText;
}

function fullScreenText(
  value: 'available' | 'unavailable' | 'not-applicable' | 'unknown',
  enabled: boolean,
): string {
  if (!enabled) return '应用内未开启';
  if (value === 'available') return '系统允许';
  if (value === 'unavailable') return '系统未授权';
  if (value === 'not-applicable') return '手机安装包中检测';
  return '无法检测';
}

function deliveryText(deliveredAt: number, identifier: string): string {
  if (deliveredAt <= 0) return '尚无投递记录';
  const time = new Date(deliveredAt).toLocaleTimeString('zh-CN', { hour12: false });
  return `${time} · ${identifier || '未知标识'}`;
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
  previewSection: { gap: 9 },
  notificationPreview: {
    minHeight: 102,
    borderRadius: 18,
    backgroundColor: '#3F6858',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    shadowColor: '#23392F',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  previewIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#6E9183',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContent: { flex: 1, gap: 2 },
  previewMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  previewLabel: { color: '#CFE2D9', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  previewDate: {
    color: '#FFF',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    borderRadius: 9,
    backgroundColor: '#557B6C',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  previewTitle: { color: '#FFF', fontSize: 16, lineHeight: 22, fontWeight: '700' },
  previewBody: { color: '#E8F1EC', fontSize: 11, lineHeight: 16 },
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
  fullScreenSetting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    backgroundColor: '#F8F7F3',
    padding: 14,
  },
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
