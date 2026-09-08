import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CountupForm } from '../../src/components/CountupForm';
import { Button, colors, common, Dialog, Icon } from '../../src/components/ui';
import { anniversaryProgress, countupProgress, timeNoteProgressText } from '../../src/core/countup';
import { useBirthdays } from '../../src/state/AppProvider';

export default function CountupDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useBirthdays();
  const item = state.countups.find((value) => value.id === id);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  useFocusEffect(state.refreshToday);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const progress = item ? countupProgress(item.startDate, state.today) : null;
  const anniversary =
    item?.displayMode === 'anniversary' ? anniversaryProgress(item.startDate, state.today) : null;
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
            {editing ? '编辑时光记' : '时光记详情'}
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
          ) : !item || !progress ? (
            <View style={[common.card, { gap: 16 }]}>
              <Text style={common.body}>这条时光记已不存在。</Text>
              <Button label="回到日历" onPress={() => router.replace('/')} />
            </View>
          ) : editing ? (
            <View style={common.card}>
              <CountupForm
                item={item}
                today={state.today}
                selectedDate={item.startDate}
                busy={state.busy}
                onCancel={() => setEditing(false)}
                onSave={async (draft) => {
                  await state.saveCountup(draft, item.id);
                  setEditing(false);
                }}
              />
            </View>
          ) : (
            <>
              <View style={[common.card, { alignItems: 'center', gap: 13, paddingVertical: 34 }]}>
                <View
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 22,
                    backgroundColor: colors.tint,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="sparkles-outline" color={colors.accent} size={32} />
                </View>
                <Text style={[common.eyebrow, { color: colors.accent }]}>
                  {item.displayMode === 'anniversary' ? '每年纪念' : '记录天数'}
                </Text>
                <Text style={common.title}>{item.title}</Text>
                <Text style={[common.title, { color: colors.accent, fontSize: 36 }]}>
                  {timeNoteProgressText(item, state.today)}
                </Text>
                {anniversary?.phase === 'active' && anniversary.isAnniversary && anniversary.nextDate && (
                  <Text style={common.muted}>
                    下一次 · {anniversary.nextDate.replaceAll('-', '.')} · {anniversary.remaining} 天后
                  </Text>
                )}
                {anniversary?.phase === 'active' && !anniversary.isAnniversary && anniversary.years > 0 && (
                  <Text style={common.muted}>已经走过 {anniversary.years} 年</Text>
                )}
                {item.displayMode === 'anniversary' && progress.phase === 'active' && (
                  <Text style={common.muted}>从开始至今 · 第 {progress.day} 天</Text>
                )}
                <Text style={common.muted}>开始日期 · {item.startDate.replaceAll('-', '.')}</Text>
              </View>
              {!!item.note && (
                <View style={[common.card, { gap: 10 }]}>
                  <Text style={common.eyebrow}>写给自己</Text>
                  <Text style={common.body}>{item.note}</Text>
                </View>
              )}
              <View style={common.between}>
                <Button
                  label="删除时光记"
                  variant="quiet"
                  icon="trash-outline"
                  onPress={() => {
                    setError('');
                    setConfirming(true);
                  }}
                />
                <Button label="编辑时光记" icon="create-outline" onPress={() => setEditing(true)} />
              </View>
              <Dialog
                title={`删除「${item.title}」？`}
                visible={confirming}
                onClose={() => {
                  if (!state.busy) setConfirming(false);
                }}
              >
                <Text style={[common.body, { marginBottom: 20 }]}>删除后，这条时光记将不再显示。</Text>
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
                    onPress={() => setConfirming(false)}
                  />
                  <Button
                    label="确认删除"
                    variant="danger"
                    busy={state.busy}
                    onPress={() => {
                      void state
                        .removeCountup(item.id)
                        .then(() => {
                          setConfirming(false);
                          back();
                        })
                        .catch((reason) =>
                          setError(reason instanceof Error ? reason.message : '删除失败，请重试'),
                        );
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
