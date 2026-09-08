import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  COUNTUP_DISPLAY_MODES,
  type Countup,
  type CountupDisplayMode,
  type CountupDraft,
  normalizeCountupDraft,
  timeNoteProgressText,
} from '../core/countup';
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
  const [displayMode, setDisplayMode] = useState<CountupDisplayMode>(item?.displayMode ?? 'days');
  const [choosingDate, setChoosingDate] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const progressText = useMemo(
    () => timeNoteProgressText({ type: 'countup', title, startDate, note, displayMode }, today),
    [displayMode, note, startDate, title, today],
  );
  const submit = async () => {
    if (saving || busy) return;
    try {
      const draft = normalizeCountupDraft({ type: 'countup', title, startDate, note, displayMode });
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
          <Text style={common.body}>把一段值得记住的时光留在这里</Text>
          <Text style={common.muted}>天数与周年都会按北京时间自动更新。</Text>
        </View>
      </View>
      <View style={{ gap: 9 }}>
        <Text style={styles.label}>
          记录名称 <Text style={{ color: colors.accent }}>*</Text>
        </Text>
        <TextInput
          accessibilityLabel="记录名称"
          autoComplete="off"
          editable={!saving && !busy}
          maxLength={30}
          onChangeText={(value) => {
            setTitle(value);
            setError('');
          }}
          onSubmitEditing={() => void submit()}
          placeholder="例如：开始健身、我们在一起"
          placeholderTextColor="#A0A5A1"
          style={common.input}
          value={title}
        />
      </View>
      <View style={{ gap: 9 }}>
        <Text style={styles.label}>展示方式</Text>
        <View style={styles.modeRow}>
          {COUNTUP_DISPLAY_MODES.map((mode) => (
            <Button
              key={mode.id}
              label={mode.label}
              icon={mode.id === 'days' ? 'today-outline' : 'heart-outline'}
              variant={displayMode === mode.id ? 'primary' : 'secondary'}
              selected={displayMode === mode.id}
              disabled={saving || busy}
              style={{ flex: 1 }}
              onPress={() => {
                setDisplayMode(mode.id);
                setError('');
              }}
            />
          ))}
        </View>
        <Text style={common.muted}>
          {COUNTUP_DISPLAY_MODES.find((mode) => mode.id === displayMode)?.description}
        </Text>
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
          accessibilityLabel="时光记备注"
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
        <Text style={common.eyebrow}>{displayMode === 'days' ? '今天的记录' : '纪念进度'}</Text>
        <Text style={[common.title, { color: colors.accent, marginTop: 8 }]}>{progressText}</Text>
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
          label={item ? '保存修改' : '保存时光记'}
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
  modeRow: { flexDirection: 'row', gap: 10 },
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
