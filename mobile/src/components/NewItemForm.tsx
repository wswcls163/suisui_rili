import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { EVENT_TYPES, type BirthdayDraft } from '../core/birthday';
import type { CountupDraft } from '../core/countup';
import { BirthdayForm } from './BirthdayForm';
import { CountupForm } from './CountupForm';
import { Button, colors, common, Icon } from './ui';

export function NewItemForm({
  selectedDate,
  today,
  busy,
  onSaveBirthday,
  onSaveCountup,
  onCancel,
}: {
  selectedDate: string;
  today: string;
  busy: boolean;
  onSaveBirthday: (draft: BirthdayDraft) => Promise<void>;
  onSaveCountup: (draft: CountupDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [type, setType] = useState('');
  return (
    <View style={{ gap: 22 }}>
      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>事项类型</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {EVENT_TYPES.map((item) => (
            <Button
              key={item.id}
              label={`${item.label}${item.available ? '' : ' · 后续开放'}`}
              variant={type === item.id ? 'primary' : 'secondary'}
              disabled={!item.available || busy}
              onPress={() => setType(item.id)}
            />
          ))}
        </View>
      </View>
      {type === 'birthday' ? (
        <BirthdayForm
          busy={busy}
          hideTypeChoice
          selectedDate={selectedDate}
          today={today}
          onCancel={onCancel}
          onSave={(draft) => onSaveBirthday(draft)}
        />
      ) : type === 'countup' ? (
        <CountupForm
          busy={busy}
          selectedDate={selectedDate}
          today={today}
          onCancel={onCancel}
          onSave={onSaveCountup}
        />
      ) : (
        <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 170, gap: 16 }}>
          <Icon name="add-circle-outline" size={38} color={colors.accent} />
          <Text style={common.body}>选择一种事项，开始记录。</Text>
        </View>
      )}
    </View>
  );
}
