import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useBirthdays } from '../../src/state/AppProvider';
import { adjustmentText, birthdayTitle, upcoming } from '../../src/core/birthday';
import { lunarCalendar, lunarLabel } from '../../src/core/calendar';
import { BirthdayForm } from '../../src/components/BirthdayForm';
import { Avatar, Button, colors, common, Dialog } from '../../src/components/ui';

export default function BirthdayDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useBirthdays();
  const person = state.people.find((p) => p.id === id);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  useFocusEffect(state.refreshToday);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const occurrences = person ? upcoming(lunarCalendar, person, state.today, 3) : [];
  return (
    <SafeAreaView style={common.page}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[common.content, { maxWidth: 700 }]}
        >
          <View style={common.between}>
            <Button
              label={editing ? '取消编辑' : '返回'}
              variant="quiet"
              icon="chevron-back"
              onPress={() => (editing ? setEditing(false) : back())}
              disabled={state.busy}
            />
            <Text style={common.eyebrow}>岁岁日历</Text>
          </View>
          <Text accessibilityRole="header" style={common.title}>
            {editing ? '编辑生日' : '生日详情'}
          </Text>
          {state.status === 'loading' ? (
            <ActivityIndicator color={colors.accent} />
          ) : state.status === 'error' ? (
            <View style={[common.card, { gap: 16 }]}>
              <Text accessibilityRole="alert" style={common.error}>
                {state.error}
              </Text>
              <Button label="重新读取" onPress={() => void state.reload()} />
            </View>
          ) : !person ? (
            <View style={[common.card, { gap: 16 }]}>
              <Text style={common.body}>这条生日已不存在。</Text>
              <Button label="回到日历" onPress={() => router.replace('/')} />
            </View>
          ) : editing ? (
            <View style={common.card}>
              <BirthdayForm
                person={person}
                today={state.today}
                selectedDate={state.selectedDate}
                busy={state.busy}
                onCancel={() => setEditing(false)}
                onSave={async (draft, type) => {
                  await state.save(draft, person.id, type);
                  setEditing(false);
                }}
              />
            </View>
          ) : (
            <>
              <View style={[common.card, { alignItems: 'center', gap: 12, paddingVertical: 32 }]}>
                <Avatar name={person.name} id={person.id} size={72} />
                <Text style={common.title}>{birthdayTitle(person.name)}</Text>
                <Text style={common.body}>农历{lunarLabel(person)}</Text>
                <Text style={common.muted}>每个农历年提醒一次</Text>
              </View>
              <View style={[common.card, { gap: 20 }]}>
                <Text style={common.heading}>接下来的生日</Text>
                {occurrences.length ? (
                  occurrences.map((item, index) => (
                    <View
                      key={item.lunarYear}
                      style={{
                        gap: 8,
                        paddingBottom: 15,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.line,
                      }}
                    >
                      <View style={[common.between, { flexWrap: 'wrap' }]}>
                        <Text style={common.muted}>
                          {item.lunarYear} 农历年{index === 0 ? ' · 下次' : ''}
                        </Text>
                        <Text style={[common.heading, { color: index === 0 ? colors.accent : colors.ink }]}>
                          {item.solar.replaceAll('-', '.')}
                        </Text>
                      </View>
                      <Text style={common.muted}>
                        实际按
                        {lunarLabel({
                          month: item.actualMonth,
                          day: item.actualDay,
                          isLeap: item.actualLeap,
                        })}
                        提醒
                      </Text>
                      {item.adjustments.map((code) => (
                        <Text key={code} style={[common.muted, { color: colors.accent }]}>
                          {adjustmentText(code, person.month)}
                        </Text>
                      ))}
                    </View>
                  ))
                ) : (
                  <Text style={common.muted}>下次生日超出支持范围（1901—2100 年），原始记录仍然保留。</Text>
                )}
                <Text style={common.muted}>原始生日始终保留。闰月或小月调整只影响对应年份的提醒。</Text>
              </View>
              <View style={common.between}>
                <Button
                  label="删除生日"
                  variant="quiet"
                  icon="trash-outline"
                  onPress={() => {
                    setError('');
                    setConfirm(true);
                  }}
                />
                <Button label="编辑生日" icon="create-outline" onPress={() => setEditing(true)} />
              </View>
              <Dialog
                title={`删除「${birthdayTitle(person.name)}」？`}
                visible={confirm}
                onClose={() => {
                  if (!state.busy) setConfirm(false);
                }}
              >
                <Text style={[common.body, { marginBottom: 20 }]}>
                  删除后，该生日将从日历、生日簿和当天提醒中移除。
                </Text>
                {!!error && (
                  <Text accessibilityRole="alert" style={[common.error, { marginBottom: 15 }]}>
                    {error}
                  </Text>
                )}
                <View style={[common.row, { justifyContent: 'flex-end' }]}>
                  <Button
                    label="取消"
                    variant="secondary"
                    disabled={state.busy}
                    onPress={() => setConfirm(false)}
                  />
                  <Button
                    label="确认删除"
                    variant="danger"
                    busy={state.busy}
                    onPress={() => {
                      void state
                        .remove(person.id)
                        .then(() => {
                          setConfirm(false);
                          back();
                        })
                        .catch((err) => setError(err instanceof Error ? err.message : '删除失败，请重试'));
                    }}
                  />
                </View>
              </Dialog>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
