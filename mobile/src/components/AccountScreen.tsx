import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { birthdayDates, birthdayTitle, type Birthday } from '../core/birthday';
import type { Countup } from '../core/countup';
import { itemType, type CalendarItem, type RemoteItem } from '../sync/model';
import { useAuth } from '../state/AuthProvider';
import { useAccountAvatar } from '../state/AvatarProvider';
import { useAccountSync, type SyncStatus } from '../state/SyncProvider';
import { AccountAvatar } from './AccountAvatar';
import { Button, colors, common, Dialog, Icon } from './ui';
import { NotificationSettingsCard } from './NotificationSettingsCard';
import { NavigationDrawer } from './NavigationDrawer';

type GuestMode = 'login' | 'register' | 'forgot';

function Field({
  label,
  value,
  onChangeText,
  password = false,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  password?: boolean;
  autoComplete?: 'email' | 'password' | 'new-password';
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <TextInput
          accessibilityLabel={label}
          autoCapitalize="none"
          autoComplete={autoComplete}
          autoCorrect={false}
          keyboardType={autoComplete === 'email' ? 'email-address' : 'default'}
          onChangeText={onChangeText}
          secureTextEntry={password && !visible}
          style={[common.input, password && { paddingRight: 52 }]}
          value={value}
        />
        {password && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? '隐藏密码' : '显示密码'}
            onPress={() => setVisible((value) => !value)}
            style={styles.passwordToggle}
          >
            <Icon name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Message({ error, notice }: { error: string; notice: string }) {
  if (!error && !notice) return null;
  return (
    <View style={[styles.message, error ? styles.errorMessage : styles.noticeMessage]}>
      <Icon
        name={error ? 'alert-circle-outline' : 'checkmark-circle-outline'}
        color={error ? colors.error : colors.green}
        size={19}
      />
      <Text accessibilityRole={error ? 'alert' : undefined} style={[common.body, { flex: 1 }]}>
        {error || notice}
      </Text>
    </View>
  );
}

const syncCopy: Record<SyncStatus, { label: string; detail: string; color: string }> = {
  local: { label: '仅本机', detail: '登录后可以在不同设备之间同步', color: colors.muted },
  syncing: { label: '正在同步', detail: '正在上传和读取最新事项', color: colors.accent },
  synced: { label: '已经同步', detail: '本机与云端数据一致', color: colors.green },
  error: { label: '同步失败', detail: '本机修改已经保留，可以稍后重试', color: colors.error },
  conflict: { label: '需要选择', detail: '同一条事项在不同设备上被修改', color: colors.accent },
  unavailable: { label: '同步未配置', detail: '事项仍会保存在本机', color: colors.muted },
};

function recordText(record: CalendarItem | RemoteItem | null): string {
  if (!record) return '已删除这条事项';
  return itemType(record) === 'countup'
    ? `${(record as Countup).title} · 从 ${(record as Countup).startDate.replaceAll('-', '.')} 开始`
    : `${birthdayTitle((record as Birthday).name)} · ${birthdayDates(record as Birthday)}`;
}

function GuestAccount() {
  const auth = useAuth();
  const [mode, setMode] = useState<GuestMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const selectMode = (next: GuestMode) => {
    setMode(next);
    setPassword('');
    setConfirmation('');
    auth.clearMessages();
  };
  const submit = async () => {
    try {
      if (mode === 'login') await auth.signIn(email, password);
      else if (mode === 'register') await auth.signUp(email, password, confirmation);
      else await auth.requestPasswordReset(email);
    } catch {
      // AuthProvider exposes the friendly message in the page.
    }
  };
  return (
    <View style={[common.card, styles.formCard]}>
      <View style={styles.accountMark}>
        <Icon name="person-outline" color={colors.accent} size={29} />
      </View>
      <View style={{ gap: 7, alignItems: 'center' }}>
        <Text accessibilityRole="header" style={common.title}>
          {mode === 'login' ? '登录岁岁日历' : mode === 'register' ? '创建账号' : '找回密码'}
        </Text>
        <Text style={[common.muted, { textAlign: 'center' }]}>
          {mode === 'forgot'
            ? '输入注册邮箱，我们会发一封密码重置邮件。'
            : '用邮箱和密码保存生日，换一台设备也能继续使用。'}
        </Text>
      </View>
      <Message error={auth.error} notice={auth.notice} />
      <Field label="邮箱" value={email} onChangeText={setEmail} autoComplete="email" />
      {mode !== 'forgot' && (
        <Field
          label="密码"
          value={password}
          onChangeText={setPassword}
          password
          autoComplete={mode === 'register' ? 'new-password' : 'password'}
        />
      )}
      {mode === 'register' && (
        <Field
          label="再次输入密码"
          value={confirmation}
          onChangeText={setConfirmation}
          password
          autoComplete="new-password"
        />
      )}
      {mode === 'register' && <Text style={common.muted}>密码长度为 8–72 个字符。</Text>}
      <Button
        label={mode === 'login' ? '登录' : mode === 'register' ? '注册' : '发送重置邮件'}
        busy={auth.busy}
        onPress={() => void submit()}
      />
      <View style={[common.row, styles.formLinks]}>
        {mode !== 'login' && <Button label="返回登录" variant="quiet" onPress={() => selectMode('login')} />}
        {mode === 'login' && (
          <>
            <Button label="注册账号" variant="quiet" onPress={() => selectMode('register')} />
            <Button label="忘记密码" variant="quiet" onPress={() => selectMode('forgot')} />
          </>
        )}
      </View>
    </View>
  );
}

function RecoveryAccount() {
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const submit = async () => {
    try {
      await auth.updatePassword(password, confirmation);
      setPassword('');
      setConfirmation('');
    } catch {
      // AuthProvider exposes the friendly message in the page.
    }
  };
  return (
    <View style={[common.card, styles.formCard]}>
      <Text accessibilityRole="header" style={common.title}>
        设置新密码
      </Text>
      <Text style={common.muted}>新密码保存后，这台设备会保持登录。</Text>
      <Message error={auth.error} notice={auth.notice} />
      <Field
        label="新密码"
        value={password}
        onChangeText={setPassword}
        password
        autoComplete="new-password"
      />
      <Field
        label="再次输入新密码"
        value={confirmation}
        onChangeText={setConfirmation}
        password
        autoComplete="new-password"
      />
      <Button label="保存新密码" busy={auth.busy} onPress={() => void submit()} />
    </View>
  );
}

function SignedInAccount() {
  const auth = useAuth();
  const avatar = useAccountAvatar();
  const sync = useAccountSync();
  const copy = syncCopy[sync.status];
  const [actionError, setActionError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [forceSignOutOpen, setForceSignOutOpen] = useState(false);
  const [avatarDeleteOpen, setAvatarDeleteOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const run = async (work: () => Promise<void>) => {
    setWorking(true);
    setActionError('');
    try {
      await work();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : '操作没有完成，请重试');
      throw reason;
    } finally {
      setWorking(false);
    }
  };
  const signOut = async () => {
    try {
      await run(() => sync.signOut());
    } catch {
      setForceSignOutOpen(true);
    }
  };
  const lastSync = sync.lastSyncedAt
    ? new Date(sync.lastSyncedAt).toLocaleString('zh-CN', { hour12: false })
    : '登录后会自动同步';
  return (
    <View style={{ gap: 18 }}>
      <View style={[common.card, { gap: 18 }]}>
        <View style={[common.between, { alignItems: 'flex-start' }]}>
          <View style={[common.row, { flex: 1, alignItems: 'flex-start' }]}>
            <AccountAvatar uri={avatar.uri} email={auth.session?.email} loggedIn size={58} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={common.heading}>已登录</Text>
              <Text style={common.body}>{auth.session?.email}</Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${copy.color}18` }]}>
            <View style={[styles.statusDot, { backgroundColor: copy.color }]} />
            <Text style={{ color: copy.color, fontSize: 12, fontWeight: '600' }}>{copy.label}</Text>
          </View>
        </View>
        <View style={styles.avatarActions}>
          <View style={{ flex: 1, gap: 4, minWidth: 190 }}>
            <Text style={styles.label}>账号头像</Text>
            <Text style={common.muted}>
              {avatar.status === 'pending'
                ? '头像已保存在本机，等待同步到云端'
                : avatar.status === 'syncing'
                  ? '正在同步头像…'
                  : avatar.uri
                    ? '首页与账号页会使用同一张头像'
                    : '选择一张照片，裁剪后只用于当前账号'}
            </Text>
          </View>
          <View style={styles.avatarButtons}>
            <Button
              label={avatar.uri ? '更换头像' : '选择头像'}
              variant="secondary"
              busy={avatar.status === 'loading' || avatar.status === 'syncing'}
              onPress={() => void avatar.chooseAvatar().catch(() => {})}
            />
            {avatar.uri ? (
              <Button label="删除头像" variant="quiet" onPress={() => setAvatarDeleteOpen(true)} />
            ) : null}
            {avatar.status === 'pending' || avatar.status === 'error' ? (
              <Button
                label="重试头像同步"
                variant="quiet"
                onPress={() => void avatar.retry().catch(() => {})}
              />
            ) : null}
          </View>
        </View>
        {avatar.error ? <Message error={avatar.error} notice="" /> : null}
        <View style={styles.syncPanel}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={common.body}>{copy.detail}</Text>
            <Text style={common.muted}>上次同步：{lastSync}</Text>
            {!!sync.pendingCount && <Text style={common.muted}>还有 {sync.pendingCount} 项修改等待上传</Text>}
          </View>
          <Button
            label="立即同步"
            variant="secondary"
            icon="sync-outline"
            busy={sync.status === 'syncing'}
            onPress={() => void run(sync.syncNow).catch(() => {})}
          />
        </View>
        <Message error={actionError || sync.error || auth.error} notice={auth.notice} />
      </View>

      {sync.guestCount > 0 && (
        <View style={[common.card, styles.importCard]}>
          <View style={styles.importIcon}>
            <Icon name="phone-portrait-outline" size={22} color={colors.green} />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={common.heading}>发现本机生日</Text>
            <Text style={common.muted}>
              登录前保存了 {sync.guestCount}{' '}
              条事项。合并时会跳过内容完全相同的记录，成功同步后再清理本机副本。
            </Text>
          </View>
          <Button
            label="合并并同步"
            busy={working}
            onPress={() => void run(sync.importGuest).catch(() => {})}
          />
        </View>
      )}

      {sync.conflicts.length > 0 && (
        <View style={[common.card, { gap: 16 }]}>
          <View style={{ gap: 5 }}>
            <Text style={common.heading}>选择要保留的版本</Text>
            <Text style={common.muted}>这些事项在不同设备上被同时修改。逐条选择后会继续同步。</Text>
          </View>
          {sync.conflicts.map((conflict) => (
            <View key={conflict.birthdayId} style={styles.conflict}>
              <View style={{ gap: 7 }}>
                <Text style={styles.label}>本机版本</Text>
                <Text style={common.body}>{recordText(conflict.local)}</Text>
                <Button
                  label="保留本机版本"
                  variant="secondary"
                  busy={working}
                  onPress={() =>
                    void run(() => sync.resolveConflict(conflict.birthdayId, 'local')).catch(() => {})
                  }
                />
              </View>
              <View style={{ gap: 7 }}>
                <Text style={styles.label}>云端版本</Text>
                <Text style={common.body}>{recordText(conflict.remote)}</Text>
                <Button
                  label="保留云端版本"
                  variant="secondary"
                  busy={working}
                  onPress={() =>
                    void run(() => sync.resolveConflict(conflict.birthdayId, 'remote')).catch(() => {})
                  }
                />
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={[common.card, { gap: 15 }]}>
        <Text style={common.heading}>账号操作</Text>
        <Button label="退出登录" variant="secondary" busy={working} onPress={() => void signOut()} />
        <View style={styles.divider} />
        <Text style={common.muted}>注销会永久删除云端账号及其中的事项数据。</Text>
        <Button label="注销账号" variant="danger" onPress={() => setDeleteOpen(true)} />
      </View>

      <Dialog visible={forceSignOutOpen} title="仍要退出登录吗？" onClose={() => setForceSignOutOpen(false)}>
        <View style={{ gap: 16 }}>
          <Text style={common.body}>
            有修改尚未同步。现在退出会清除这个账号在本机的缓存，这些修改可能丢失。
          </Text>
          <View style={styles.dialogActions}>
            <Button label="继续保留" variant="secondary" onPress={() => setForceSignOutOpen(false)} />
            <Button
              label="放弃修改并退出"
              variant="danger"
              busy={working}
              onPress={() =>
                void run(() => sync.signOut(true))
                  .then(() => setForceSignOutOpen(false))
                  .catch(() => {})
              }
            />
          </View>
        </View>
      </Dialog>
      <Dialog visible={avatarDeleteOpen} title="删除账号头像？" onClose={() => setAvatarDeleteOpen(false)}>
        <View style={{ gap: 16 }}>
          <Text style={common.body}>将删除本机和云端头像，首页会恢复显示邮箱首字母。</Text>
          <View style={styles.dialogActions}>
            <Button label="取消" variant="secondary" onPress={() => setAvatarDeleteOpen(false)} />
            <Button
              label="确认删除头像"
              variant="danger"
              busy={avatar.status === 'syncing'}
              onPress={() =>
                void avatar
                  .deleteAvatar()
                  .then(() => setAvatarDeleteOpen(false))
                  .catch(() => {})
              }
            />
          </View>
        </View>
      </Dialog>
      <Dialog visible={deleteOpen} title="确定注销账号？" onClose={() => setDeleteOpen(false)}>
        <View style={{ gap: 16 }}>
          <Text style={common.body}>云端账号和云端生日会永久删除。这个操作无法撤销。</Text>
          <View style={styles.dialogActions}>
            <Button label="取消" variant="secondary" onPress={() => setDeleteOpen(false)} />
            <Button
              label="永久注销"
              variant="danger"
              busy={working}
              onPress={() =>
                void run(sync.deleteAccount)
                  .then(() => setDeleteOpen(false))
                  .catch(() => {})
              }
            />
          </View>
        </View>
      </Dialog>
    </View>
  );
}

export type AccountSection = 'notifications' | 'account';

export function AccountScreen({
  section = 'account',
  phonePreview = false,
  birthdayCount = 0,
  countupCount = 0,
}: {
  section?: AccountSection;
  phonePreview?: boolean;
  birthdayCount?: number;
  countupCount?: number;
}) {
  const auth = useAuth();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <SafeAreaView style={common.page}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[common.content, styles.content, phonePreview && styles.phonePreviewContent]}
        >
          <View style={common.between}>
            <View style={common.row}>
              <NavigationDrawer
                active={section}
                birthdayCount={birthdayCount}
                countupCount={countupCount}
                phonePreview={phonePreview}
              />
              <Text style={common.eyebrow}>
                {section === 'notifications' ? '重要日期提醒' : '账号与同步'}
              </Text>
            </View>
            <Button label="返回" variant="quiet" onPress={back} />
          </View>
          {section === 'notifications' ? (
            <NotificationSettingsCard />
          ) : auth.status === 'unconfigured' ? (
            <View style={[common.card, styles.unconfigured]}>
              <View style={styles.accountMark}>
                <Icon name="cloud-offline-outline" color={colors.accent} size={28} />
              </View>
              <Text accessibilityRole="header" style={common.title}>
                账号服务尚未配置
              </Text>
              <Text style={[common.body, { textAlign: 'center' }]}>当前生日仍会安全地保存在这台设备上。</Text>
              <Text style={[common.muted, { textAlign: 'center' }]}>
                配置 Supabase 项目地址和公开密钥后，注册、登录与跨设备同步会自动启用。
              </Text>
            </View>
          ) : auth.status === 'loading' ? (
            <View style={[common.card, styles.unconfigured]}>
              <Icon name="hourglass-outline" color={colors.accent} size={28} />
              <Text style={common.body}>正在读取账号…</Text>
            </View>
          ) : auth.status === 'recovery' ? (
            <RecoveryAccount />
          ) : auth.session ? (
            <SignedInAccount />
          ) : (
            <GuestAccount />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { maxWidth: 720 },
  phonePreviewContent: { maxWidth: 443 },
  formCard: { gap: 18, padding: 28 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  passwordToggle: {
    position: 'absolute',
    right: 5,
    top: 4,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formLinks: { justifyContent: 'center', flexWrap: 'wrap' },
  accountMark: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 2,
  },
  message: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: 12, padding: 13 },
  errorMessage: { backgroundColor: '#FCEDEA' },
  noticeMessage: { backgroundColor: '#EAF0E9' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  syncPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#F8F7F3',
    borderRadius: 14,
    padding: 15,
    flexWrap: 'wrap',
  },
  avatarActions: {
    alignItems: 'center',
    backgroundColor: '#F8F7F3',
    borderRadius: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 15,
  },
  avatarButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  importCard: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  importIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#EAF0E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  conflict: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 15, gap: 15 },
  divider: { height: 1, backgroundColor: colors.line },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' },
  unconfigured: { minHeight: 330, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 34 },
});
