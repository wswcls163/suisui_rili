import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { type Countup, type CountupDraft, countupProgress, normalizeCountupDraft } from '../core/countup';
import { DateJumpDialog } from './DateJumpDialog';
import { Button, colors, common, Icon } from './ui';

export function CountupForm({
  item,
  selectedDate,
  today,
  onSave,
  onCancel,
  busy = false,
}: {
  item?: Countup;
  selectedDate: string;
  today: string;
  busy?: boolean;
  onSave: (draft: CountupDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [startDate, setStartDate] = useState(item?.startDate ?? selectedDate);
  const [note, setNote] = useState(item?.note ?? '');
  const [choosingDate, setChoosingDate] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const progress = useMemo(() => countupProgress(startDate, today), [startDate, today]);
  const submit = async () => {
    if (saving || busy) return;
    try {
      const draft = normalizeCountupDraft({ type: 'countup', title, startDate, note });
      setSaving(true);
      setError('');
      await onSave(draft);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={{ gap: 22 }}>
      <View style={styles.context}>
        <Icon name="sparkles-outline" color={colors.accent} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={common.body}>每天自动更新，无需手动打卡</Text>
          <Text style={common.muted}>开始当天记作第 1 天，按北京时间计算。</Text>
        </View>
      </View>
      <View style={{ gap: 9 }}>
        <Text style={styles.label}>
          累计事项 <Text style={{ color: colors.accent }}>*</Text>
        </Text>
        <TextInput
          accessibilityLabel="累计事项"
          autoComplete="off"
          editable={!saving && !busy}
          maxLength={30}
          onChangeText={(value) => {
            setTitle(value);
            setError('');
          }}
          onSubmitEditing={() => void submit()}
          placeholder="例如：坚持健身、开始学英语"
          placeholderTextColor="#A0A5A1"
          style={common.input}
          value={title}
        />
      </View>
      <View style={{ gap: 9 }}>
        <Text style={styles.label}>
          开始日期 <Text style={{ color: colors.accent }}>*</Text>
        </Text>
        <Button
          label={`选择开始日期：${startDate.replaceAll('-', '.')}`}
          variant="secondary"
          icon="calendar-outline"
          disabled={saving || busy}
          onPress={() => setChoosingDate(true)}
        />
      </View>
      <View style={{ gap: 9 }}>
        <Text style={styles.label}>备注（可选）</Text>
        <TextInput
          accessibilityLabel="累计日备注"
          editable={!saving && !busy}
          maxLength={120}
          multiline
          onChangeText={(value) => {
            setNote(value);
            setError('');
          }}
          placeholder="写下为什么开始，或者给未来的自己一句话"
          placeholderTextColor="#A0A5A1"
          style={[common.input, styles.note]}
          textAlignVertical="top"
          value={note}
        />
        <Text style={[common.muted, { textAlign: 'right' }]}>{Array.from(note).length}/120</Text>
      </View>
      <View style={styles.preview}>
        <Text style={common.eyebrow}>{progress.phase === 'active' ? '今天的累计' : '距离开始'}</Text>
        <Text style={[common.title, { color: colors.accent, marginTop: 8 }]}>
          {progress.phase === 'active' ? `第 ${progress.day} 天` : `${progress.remaining} 天`}
        </Text>
        <Text style={[common.body, { marginTop: 6 }]}>从 {startDate.replaceAll('-', '.')} 开始</Text>
      </View>
      {!!error && (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={common.error}>
          {error}
        </Text>
      )}
      <View style={[common.row, { justifyContent: 'flex-end' }]}>
        <Button label="取消" variant="secondary" disabled={saving || busy} onPress={onCancel} />
        <Button
          label={item ? '保存修改' : '保存累计日'}
          busy={saving || busy}
          icon="checkmark"
          onPress={() => void submit()}
        />
      </View>
      {choosingDate && (
        <DateJumpDialog
          initialDate={startDate}
          onClose={() => setChoosingDate(false)}
          onConfirm={(date) => {
            setStartDate(date);
            setChoosingDate(false);
            setError('');
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 15, fontWeight: '600', color: colors.ink },
  context: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#FAF7F3',
    borderRadius: 12,
  },
  note: { minHeight: 92 },
  preview: { backgroundColor: '#F5F7F2', borderRadius: 16, padding: 20 },
});
