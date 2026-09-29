import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');

test('Android 配置声明精确闹钟并使用不可变渠道的新版本标识', () => {
  const app = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const packageLock = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf8'));
  expect(app.expo.version).toBe('0.3.1');
  expect(app.expo.android.versionCode).toBe(4);
  expect(packageJson.version).toBe('0.3.1');
  expect(packageLock.version).toBe('0.3.1');
  expect(packageLock.packages[''].version).toBe('0.3.1');
  expect(app.expo.android.permissions).toContain('android.permission.SCHEDULE_EXACT_ALARM');
  expect(app.expo.android.permissions).toContain('android.permission.USE_FULL_SCREEN_INTENT');
  expect(app.expo.android.permissions).toContain('android.permission.WAKE_LOCK');
  const notificationsPlugin = app.expo.plugins.find(
    (entry: unknown) => Array.isArray(entry) && entry[0] === 'expo-notifications',
  );
  expect(notificationsPlugin[1].defaultChannel).toBe('important-dates-popup-v3');
});

test('本地原生模块提供可靠排程、立即投递、全屏能力和系统设置入口', () => {
  const moduleRoot = path.join(projectRoot, 'modules', 'suisui-notification-reliability');
  const config = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'expo-module.config.json'), 'utf8'));
  const kotlin = fs.readFileSync(
    path.join(
      moduleRoot,
      'android',
      'src',
      'main',
      'java',
      'com',
      'suisui',
      'notificationreliability',
      'SuisuiNotificationReliabilityModule.kt',
    ),
    'utf8',
  );
  expect(config.android.modules).toContain(
    'com.suisui.notificationreliability.SuisuiNotificationReliabilityModule',
  );
  expect(kotlin).toContain('canScheduleExactAlarms()');
  expect(kotlin).toContain('replaceScheduledNotifications');
  expect(kotlin).toContain('sendImmediateTestNotification');
  expect(kotlin).toContain('scheduleDelayedTestNotification');
  expect(kotlin).toContain('canUseFullScreenIntent()');
  expect(kotlin).toContain('ACTION_REQUEST_SCHEDULE_EXACT_ALARM');
  expect(kotlin).toContain('ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT');
  expect(kotlin).toContain('ACTION_CHANNEL_NOTIFICATION_SETTINGS');
  expect(kotlin).toContain('ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
});

test('原生清单注册闹钟投递、重启恢复、锁屏 Activity 和所需权限', () => {
  const manifest = fs.readFileSync(
    path.join(
      projectRoot,
      'modules',
      'suisui-notification-reliability',
      'android',
      'src',
      'main',
      'AndroidManifest.xml',
    ),
    'utf8',
  );
  expect(manifest).toContain('android.permission.USE_FULL_SCREEN_INTENT');
  expect(manifest).toContain('android.permission.WAKE_LOCK');
  expect(manifest).toContain('com.suisui.notificationreliability.SuisuiAlarmReceiver');
  expect(manifest).toContain('com.suisui.notificationreliability.SuisuiScheduleRestoreReceiver');
  expect(manifest).toContain('com.suisui.notificationreliability.SuisuiReminderActivity');
  expect(manifest).toContain('android:showWhenLocked="true"');
  expect(manifest).toContain('android:turnScreenOn="true"');
  expect(manifest).toContain('android.intent.action.BOOT_COMPLETED');
  expect(manifest).toContain('android.intent.action.MY_PACKAGE_REPLACED');
});

test('原生调度同时实现精确空闲、降级空闲、稳定取消和最多 60 条生产提醒', () => {
  const root = path.join(
    projectRoot,
    'modules',
    'suisui-notification-reliability',
    'android',
    'src',
    'main',
    'java',
    'com',
    'suisui',
    'notificationreliability',
  );
  const scheduler = fs.readFileSync(path.join(root, 'ReliableNotificationScheduler.kt'), 'utf8');
  const store = fs.readFileSync(path.join(root, 'ReliableNotificationStore.kt'), 'utf8');
  const receiver = fs.readFileSync(path.join(root, 'SuisuiAlarmReceiver.kt'), 'utf8');
  const publisher = fs.readFileSync(path.join(root, 'ReliableNotificationPublisher.kt'), 'utf8');
  expect(scheduler).toContain('setExactAndAllowWhileIdle');
  expect(scheduler).toContain('setAndAllowWhileIdle');
  expect(scheduler).toContain('alarmManager.cancel');
  expect(scheduler).toContain('store.replaceProduction(requests)');
  expect(store).toContain('MAX_PRODUCTION_REQUESTS = 60');
  expect(receiver).toContain('recordDelivery(identifier)');
  expect(publisher).toContain('setFullScreenIntent');
  expect(publisher).toContain('CATEGORY_ALARM');
  expect(publisher).toContain('setSilent(true)');
});

test('Expo 通知依赖在重启、快速重启和应用升级后接收恢复事件', () => {
  const packageRoot = path.dirname(require.resolve('expo-notifications/package.json'));
  const manifest = fs.readFileSync(
    path.join(packageRoot, 'android', 'src', 'main', 'AndroidManifest.xml'),
    'utf8',
  );
  expect(manifest).toContain('android.intent.action.BOOT_COMPLETED');
  expect(manifest).toContain('android.intent.action.REBOOT');
  expect(manifest).toContain('android.intent.action.QUICKBOOT_POWERON');
  expect(manifest).toContain('android.intent.action.MY_PACKAGE_REPLACED');
});
