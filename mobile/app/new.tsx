import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { NewItemForm } from '../src/components/NewItemForm';
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
            <Text style={common.muted}>记生日，也用时光记留下一件事的开始。</Text>
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
              <NewItemForm
                selectedDate={state.selectedDate}
                today={state.today}
                busy={state.busy || state.status !== 'ready'}
                onCancel={back}
                onSaveBirthday={async (draft) => {
                  await state.save(draft);
                  back();
                }}
                onSaveCountup={async (draft) => {
                  await state.saveCountup(draft);
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
