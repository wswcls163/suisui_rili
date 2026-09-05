import React, { useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import {
  type Birthday,
  type BirthdayDraft,
  type BirthdayKind,
  type SolarBirthday,
  EVENT_TYPES,
  adjustmentText,
  birthdayDates,
  occurrenceLabel,
  solarBirthdayDays,
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
  hideTypeChoice = false,
}: {
  person?: Birthday;
  selectedDate: string;
  today: string;
  busy?: boolean;
  onSave: (draft: BirthdayDraft, type: string) => Promise<void>;
  onCancel: () => void;
  hideTypeChoice?: boolean;
}) {
  const [mode, setMode] = useState<'lunar' | 'solar' | 'both'>(
    person?.solar ? (person.lunar ? 'both' : 'solar') : 'lunar',
  );
  const [name, setName] = useState(person?.name ?? '');
  const [lunar, setLunar] = useState(
    person?.lunar ?? (person ? { month: 0, day: 0, isLeap: false } : lunarCalendar.lunarOn(selectedDate)),
  );
  const [solar, setSolar] = useState<SolarBirthday>(person?.solar ?? { month: 0, day: 0 });
  const draft: BirthdayDraft = {
    name,
    lunar: mode === 'solar' ? null : lunar,
    solar: mode === 'lunar' ? null : solar,
  };
  const [type, setType] = useState<string>(person || hideTypeChoice ? 'birthday' : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const previews = useMemo(() => {
    const kinds: BirthdayKind[] = mode === 'both' ? ['lunar', 'solar'] : [mode];
    return kinds.map((kind) => {
      const value = {
        name: '生日预览',
        lunar: kind === 'lunar' ? lunar : null,
        solar: kind === 'solar' ? solar : null,
      };
      try {
        return { kind, next: upcoming(lunarCalendar, value, today)[0], dates: birthdayDates(value) };
      } catch {
        return { kind, next: undefined, dates: '' };
      }
    });
  }, [mode, lunar, solar, today]);
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
      {!hideTypeChoice && (
        <View style={{ gap: 10 }}>
          <Text style={styles.label}>事项类型</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {EVENT_TYPES.filter((item) => item.id !== 'countup').map((item) => (
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
      )}
      {type === 'birthday' ? (
        <>
          <View style={{ gap: 9 }}>
            <Text style={styles.label}>
              姓名或称呼 <Text style={{ color: colors.accent }}>*</Text>
            </Text>
            <TextInput
              accessibilityLabel="姓名或称呼"
              value={name}
              onChangeText={(name) => {
                setName(name);
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
            <Text style={styles.label}>想过哪种生日？</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(['lunar', 'solar', 'both'] as const).map((item) => (
                <Button
                  key={item}
                  label={item === 'lunar' ? '只过农历' : item === 'solar' ? '只过阳历' : '两个都过'}
                  selected={mode === item}
                  variant={mode === item ? 'primary' : 'secondary'}
                  disabled={saving || busy}
                  onPress={() => {
                    setMode(item);
                    setError('');
                  }}
                />
              ))}
            </View>
            {mode === 'both' && (
              <Text style={common.muted}>一个人记两套日期，分别提醒；同一天重合时只提醒一次。</Text>
            )}
          </View>
          {mode !== 'solar' && (
            <>
              <View style={{ gap: 10 }}>
                <Text style={styles.label}>
                  农历生日 <Text style={{ color: colors.accent }}>*</Text>
                </Text>
                <View style={common.row}>
                  <ChoiceField
                    label="农历月份"
                    options={MONTH_NAMES}
                    value={lunar.month}
                    disabled={saving || busy}
                    onChange={(month) => setLunar({ ...lunar, month })}
                  />
                  <ChoiceField
                    label="农历日期"
                    options={DAY_NAMES}
                    value={lunar.day}
                    disabled={saving || busy}
                    onChange={(day) => setLunar({ ...lunar, day })}
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
                  value={lunar.isLeap}
                  disabled={saving || busy}
                  onValueChange={(isLeap) => setLunar({ ...lunar, isLeap })}
                  trackColor={{ false: '#DADED8', true: colors.accent }}
                  thumbColor="#FFF"
                />
              </View>
              <View style={styles.rules}>
                <Icon name="information-circle-outline" size={18} color={colors.muted} />
                <Text style={[common.muted, { flex: 1 }]}>
                  {lunar.isLeap
                    ? '当年有对应闰月时按闰月过；没有时按普通月过。'
                    : '每年按照农历重新换算，不固定重复阳历日期。'}
                  {lunar.day === 30 ? '\n适用月份只有二十九天时，提前到二十九提醒。' : ''}
                </Text>
              </View>
            </>
          )}
          {mode !== 'lunar' && (
            <View style={{ gap: 10 }}>
              <Text style={styles.label}>
                阳历生日 <Text style={{ color: colors.accent }}>*</Text>
              </Text>
              <View style={common.row}>
                <ChoiceField
                  label="阳历月份"
                  options={Array.from({ length: 12 }, (_, i) => `${i + 1} 月`)}
                  value={solar.month}
                  disabled={saving || busy}
                  onChange={(month) =>
                    setSolar({ month, day: Math.min(solar.day, solarBirthdayDays(month)) })
                  }
                />
                <ChoiceField
                  label="阳历日期"
                  options={Array.from(
                    { length: solarBirthdayDays(solar.month) || 31 },
                    (_, i) => `${i + 1} 日`,
                  )}
                  value={solar.day}
                  disabled={saving || busy}
                  onChange={(day) => setSolar({ ...solar, day })}
                />
              </View>
              <Text style={common.muted}>
                填写每年固定要过的阳历月日，例如 1 月 11 日，不是今年农历生日换算的日期。
              </Text>
              {solar.month === 2 && solar.day === 29 && (
                <Text style={common.muted}>
                  阳历 2 月 29 日生日，平年提前到 2 月 28 日过，闰年仍过 29 日。
                </Text>
              )}
            </View>
          )}
          {previews.map(({ kind, next, dates }) => (
            <View key={kind} style={styles.preview}>
              <Text style={common.eyebrow}>
                {mode === 'both' ? `下次${kind === 'lunar' ? '农历' : '阳历'}生日` : '下次生日'}
              </Text>
              <Text style={[common.title, { marginTop: 8, fontSize: 27 }]}>
                {next
                  ? next.solar.replaceAll('-', '.')
                  : dates
                    ? '超出支持范围'
                    : `请选择${kind === 'lunar' ? '农历' : '阳历'}月日`}
              </Text>
              <Text style={[common.body, { marginTop: 6 }]}>
                {dates}
                {next
                  ? ` · ${next.solar === today ? '就是今天' : `${dayNumber(next.solar) - dayNumber(today)} 天后`}`
                  : ''}
              </Text>
              {next?.adjustments.map((code) => (
                <Text key={code} style={[common.muted, { color: colors.accent, marginTop: 6 }]}>
                  {adjustmentText(code, lunar.month)}
                </Text>
              ))}
            </View>
          ))}
          {previews.length === 2 &&
            previews[0].next &&
            previews[0].next.solar === previews[1].next?.solar && (
              <Text style={[common.body, { color: colors.green }]}>
                {occurrenceLabel({ ...previews[0].next, kinds: ['lunar', 'solar'] })}，只提醒一次。
              </Text>
            )}
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
