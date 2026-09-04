import React, { useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import {
  type Birthday,
  type BirthdayDraft,
  EVENT_TYPES,
  adjustmentText,
  normalizeDraft,
  requireBirthdayType,
  upcoming,
} from '../core/birthday';
import { DAY_NAMES, MONTH_NAMES, lunarCalendar, lunarLabel } from '../core/calendar';
import { dayNumber } from '../core/dates';
import { Button, ChoiceField, colors, common, Icon } from './ui';

export function BirthdayForm({
  person,
  selectedDate,
  today,
  onSave,
  onCancel,
  busy = false,
}: {
  person?: Birthday;
  selectedDate: string;
  today: string;
  busy?: boolean;
  onSave: (draft: BirthdayDraft, type: string) => Promise<void>;
  onCancel: () => void;
}) {
  const initial = person ?? { ...lunarCalendar.lunarOn(selectedDate), name: '' };
  const [draft, setDraft] = useState<BirthdayDraft>({
    name: initial.name,
    month: initial.month,
    day: initial.day,
    isLeap: initial.isLeap,
  });
  const [type, setType] = useState<string>(person ? 'birthday' : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const next = useMemo(
    () => upcoming(lunarCalendar, { ...draft, name: '生日预览' }, today)[0],
    [draft, today],
  );
  const submit = async () => {
    if (saving || busy) return;
    try {
      requireBirthdayType(type);
      const normalized = normalizeDraft(draft);
      setSaving(true);
      setError('');
      await onSave(normalized, type);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={{ gap: 22 }}>
      {!person && (
        <View style={styles.dateContext}>
          <Icon name="calendar-outline" color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={common.body}>所选日期 · {selectedDate.replaceAll('-', '.')}</Text>
            <Text style={common.muted}>
              农历{lunarLabel(lunarCalendar.lunarOn(selectedDate))}，选择生日后自动带入
            </Text>
          </View>
        </View>
      )}
      <View style={{ gap: 10 }}>
        <Text style={styles.label}>事项类型</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {EVENT_TYPES.map((item) => (
            <Button
              key={item.id}
              label={`${item.label}${item.available ? '' : ' · 后续开放'}`}
              variant={type === item.id ? 'primary' : 'secondary'}
              disabled={!item.available || Boolean(person) || saving || busy}
              onPress={() => setType(item.id)}
            />
          ))}
        </View>
      </View>
      {type === 'birthday' ? (
        <>
          <View style={{ gap: 9 }}>
            <Text style={styles.label}>
              姓名或称呼 <Text style={{ color: colors.accent }}>*</Text>
            </Text>
            <TextInput
              accessibilityLabel="姓名或称呼"
              value={draft.name}
              onChangeText={(name) => {
                setDraft({ ...draft, name });
                setError('');
              }}
              placeholder="例如：妈妈、林小满"
              placeholderTextColor="#A0A5A1"
              style={common.input}
              autoComplete="off"
              editable={!saving && !busy}
              onSubmitEditing={() => void submit()}
            />
          </View>
          <View style={{ gap: 10 }}>
            <Text style={styles.label}>
              农历生日 <Text style={{ color: colors.accent }}>*</Text>
            </Text>
            <View style={common.row}>
              <ChoiceField
                label="农历月份"
                options={MONTH_NAMES}
                value={draft.month}
                onChange={(month) => setDraft({ ...draft, month })}
              />
              <ChoiceField
                label="农历日期"
                options={DAY_NAMES}
                value={draft.day}
                onChange={(day) => setDraft({ ...draft, day })}
              />
            </View>
            <Text style={common.muted}>请填写农历日期，不是身份证上的阳历日期。</Text>
          </View>
          <View style={common.between}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>这是闰月生日</Text>
              <Text style={common.muted}>普通月份生日无需开启</Text>
            </View>
            <Switch
              accessibilityLabel="这是闰月生日"
              value={draft.isLeap}
              disabled={saving || busy}
              onValueChange={(isLeap) => setDraft({ ...draft, isLeap })}
              trackColor={{ false: '#DADED8', true: colors.accent }}
              thumbColor="#FFF"
            />
          </View>
          <View style={styles.rules}>
            <Icon name="information-circle-outline" size={18} color={colors.muted} />
            <Text style={[common.muted, { flex: 1 }]}>
              {draft.isLeap
                ? '当年有对应闰月时按闰月过；没有时按普通月过。'
                : '每年按照农历重新换算，不固定重复阳历日期。'}
              {draft.day === 30 ? '\n适用月份只有二十九天时，提前到二十九提醒。' : ''}
            </Text>
          </View>
          <View style={styles.preview}>
            <Text style={common.eyebrow}>下次生日</Text>
            <Text style={[common.title, { marginTop: 8, fontSize: 27 }]}>
              {next ? next.solar.replaceAll('-', '.') : '超出支持范围'}
            </Text>
            <Text style={[common.body, { marginTop: 6 }]}>
              农历{lunarLabel(draft)}
              {next
                ? ` · ${next.solar === today ? '就是今天' : `${dayNumber(next.solar) - dayNumber(today)} 天后`}`
                : ''}
            </Text>
            {next?.adjustments.map((code) => (
              <Text key={code} style={[common.muted, { color: colors.accent, marginTop: 6 }]}>
                {adjustmentText(code, draft.month)}
              </Text>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <Icon name="gift-outline" size={36} color={colors.accent} />
          <Text style={common.body}>选择「生日」，记下一个重要的日子。</Text>
        </View>
      )}
      {!!error && (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={common.error}>
          {error}
        </Text>
      )}
      <View style={[common.row, { justifyContent: 'flex-end' }]}>
        <Button label="取消" variant="secondary" disabled={saving || busy} onPress={onCancel} />
        <Button
          label={person ? '保存修改' : '保存生日'}
          disabled={type !== 'birthday'}
          busy={saving || busy}
          icon="checkmark"
          onPress={() => void submit()}
        />
      </View>
      <Text style={[common.muted, { textAlign: 'center' }]}>仅在应用内提醒 · 按北京时间计算</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  label: { fontSize: 15, fontWeight: '600', color: colors.ink },
  dateContext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#FAF7F3',
    borderRadius: 12,
  },
  rules: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 8 },
  preview: { backgroundColor: '#F5F7F2', borderRadius: 16, padding: 20 },
  empty: { alignItems: 'center', justifyContent: 'center', minHeight: 170, gap: 16 },
});
