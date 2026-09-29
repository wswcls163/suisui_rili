import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');

test('Android 配置声明精确闹钟并使用不可变渠道的新版本标识', () => {
  const app = JSON.parse(fs.readFileSync(path.join(projectRoot, 'app.json'), 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const packageLock = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf8'));
  expect(app.expo.version).toBe('0.3.0');
  expect(app.expo.android.versionCode).toBe(3);
  expect(packageJson.version).toBe('0.3.0');
  expect(packageLock.version).toBe('0.3.0');
  expect(packageLock.packages[''].version).toBe('0.3.0');
  expect(app.expo.android.permissions).toContain('android.permission.SCHEDULE_EXACT_ALARM');
  expect(JSON.stringify(app)).not.toContain('android.permission.USE_FULL_SCREEN_INTENT');
  const notificationsPlugin = app.expo.plugins.find(
    (entry: unknown) => Array.isArray(entry) && entry[0] === 'expo-notifications',
  );
  expect(notificationsPlugin[1].defaultChannel).toBe('important-dates-v2');
});

test('本地原生模块提供精确闹钟、通知渠道和电池设置入口', () => {
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
  expect(kotlin).toContain('ACTION_REQUEST_SCHEDULE_EXACT_ALARM');
  expect(kotlin).toContain('ACTION_CHANNEL_NOTIFICATION_SETTINGS');
  expect(kotlin).toContain('ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
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
