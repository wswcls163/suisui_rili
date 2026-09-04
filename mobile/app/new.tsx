import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BirthdayForm } from '../src/components/BirthdayForm';
import { Button, common } from '../src/components/ui';
import { useBirthdays } from '../src/state/AppProvider';

export default function NewBirthday() {
  const state = useBirthdays();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <SafeAreaView style={common.page}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[common.content, { maxWidth: 700 }]}
        >
          <View style={common.between}>
            <Button label="返回" variant="quiet" icon="chevron-back" onPress={back} disabled={state.busy} />
            <Text style={common.eyebrow}>岁岁日历</Text>
          </View>
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="header" style={common.title}>
              新建事项
            </Text>
            <Text style={common.muted}>农历、阳历，或两个都过，每一年都不落下。</Text>
          </View>
          <View style={common.card}>
            {state.status === 'error' ? (
              <View style={{ gap: 16 }}>
                <Text accessibilityRole="alert" style={common.error}>
                  {state.error}
                </Text>
                <Button label="重新读取" onPress={() => void state.reload()} />
              </View>
            ) : (
              <BirthdayForm
                selectedDate={state.selectedDate}
                today={state.today}
                busy={state.busy || state.status !== 'ready'}
                onCancel={back}
                onSave={async (draft, type) => {
                  await state.save(draft, undefined, type);
                  back();
                }}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
