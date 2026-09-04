import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

export const colors = {
  background: '#F5F4F0',
  card: '#FFFFFF',
  ink: '#27343A',
  muted: '#77807E',
  line: '#E9E8E3',
  accent: '#B8523E',
  tint: '#FAEDE7',
  green: '#567362',
  error: '#B13D38',
};
export const common = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 1160, alignSelf: 'center', padding: 20, gap: 24, paddingBottom: 48 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, letterSpacing: 0.5 },
  heading: { fontSize: 19, fontWeight: '600', color: colors.ink },
  body: { fontSize: 15, lineHeight: 23, color: colors.ink },
  muted: { fontSize: 13, lineHeight: 21, color: colors.muted },
  eyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 2.2, color: colors.muted },
  error: { fontSize: 14, lineHeight: 22, color: colors.error },
  input: {
    borderWidth: 1,
    borderColor: '#DADDD7',
    backgroundColor: '#FFF',
    borderRadius: 12,
    color: colors.ink,
    padding: 14,
    minHeight: 48,
    fontSize: 16,
  },
});
export function Icon({
  name,
  size = 20,
  color = colors.ink,
}: {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} accessible={false} />;
}
export function Button({
  label,
  onPress,
  disabled = false,
  busy = false,
  variant = 'primary',
  icon,
  style,
  selected,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
}) {
  const solid = variant === 'primary' || variant === 'danger';
  const foreground = solid ? '#FFF' : variant === 'quiet' ? colors.muted : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy, selected }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        solid
          ? { backgroundColor: variant === 'danger' ? colors.error : colors.accent }
          : variant === 'secondary'
            ? styles.secondary
            : undefined,
        { opacity: disabled ? 0.4 : pressed ? 0.72 : 1 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={foreground} size="small" />
      ) : icon ? (
        <Icon name={icon} color={foreground} size={18} />
      ) : null}
      <Text style={[styles.buttonText, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}
export function Avatar({ name, id, size = 44 }: { name: string; id: string; size?: number }) {
  const palettes = [
    ['#F8E5E1', '#AF6354'],
    ['#E8EEE8', '#627A68'],
    ['#F5EDDA', '#A28A55'],
    ['#E4EBF2', '#647F99'],
  ];
  const palette = palettes[Array.from(id).reduce((n, char) => n + char.charCodeAt(0), 0) % palettes.length];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: palette[0],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.38, color: palette[1], fontWeight: '600' }}>
        {Array.from(name)[0]}
      </Text>
    </View>
  );
}
export function Dialog({
  visible,
  title,
  children,
  onClose,
}: {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="关闭对话框"
          accessibilityRole="button"
        />
        <View style={styles.dialog}>
          <View style={[common.between, { marginBottom: 18 }]}>
            <Text accessibilityRole="header" style={common.heading}>
              {title}
            </Text>
            <Button variant="quiet" label="关闭" onPress={onClose} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}
export function ChoiceField({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: string[];
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}：${options[value - 1] ?? '请选择'}`}
        disabled={disabled}
        accessibilityState={{ disabled }}
        onPress={() => setOpen(true)}
        style={[common.input, common.between, { flex: 1 }]}
      >
        <Text style={common.body}>{options[value - 1] ?? '请选择'}</Text>
        <Icon name="chevron-down" size={16} color={colors.muted} />
      </Pressable>
      <Dialog title={`选择${label}`} visible={open} onClose={() => setOpen(false)}>
        <ScrollView style={{ maxHeight: 360 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {options.map((option, i) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={option}
                accessibilityState={{ selected: value === i + 1 }}
                onPress={() => {
                  onChange(i + 1);
                  setOpen(false);
                }}
                style={[
                  styles.option,
                  value === i + 1 && { backgroundColor: colors.tint, borderColor: colors.accent },
                ]}
              >
                <Text style={[common.body, value === i + 1 && { color: colors.accent }]}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </Dialog>
    </>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 11,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
  },
  buttonText: { fontSize: 14, fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: '#DFE1DC', backgroundColor: '#FFF' },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(25,35,38,0.38)',
  },
  dialog: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: 22,
    padding: 22,
    backgroundColor: '#FFF',
  },
  option: {
    minWidth: 68,
    minHeight: 48,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 9,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
});
