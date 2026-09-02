import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  const { styles } = useTheme();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ label, onPress, loading = false, secondary = false }: { label: string; onPress: () => void; loading?: boolean; secondary?: boolean }) {
  const { colors, styles } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, secondary && { backgroundColor: colors.primarySoft }, pressed && { opacity: 0.8 }]}>
      <Text style={[styles.buttonText, secondary && { color: colors.primary }]}>{loading ? 'Please wait…' : label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { colors, styles } = useTheme();
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} placeholderTextColor={colors.muted} style={styles.input} />
    </View>
  );
}

export function Loading() {
  const { colors, styles } = useTheme();
  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: styles.screen.backgroundColor ?? colors.bg }}><ActivityIndicator size="large" color={colors.primary} /></View>;
}

export function Empty({ title, body }: { title: string; body: string }) {
  const { colors } = useTheme();
  return <View style={{ alignItems: 'center', paddingVertical: 32 }}><Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>{title}</Text><Text style={{ color: colors.muted, textAlign: 'center', marginTop: 6 }}>{body}</Text></View>;
}

export function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <View style={{ backgroundColor: bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}><Text style={{ color, fontWeight: '700', fontSize: 12 }}>{label}</Text></View>;
}

export function Select({ label, value, options, onSelect }: { label: string; value: string; options: { label: string; value: string }[]; onSelect: (v: string) => void }) {
  const { colors, styles } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} style={[styles.input, { marginBottom: 0, justifyContent: 'center' }]}>
        <Text style={{ color: current ? colors.ink : colors.muted }}>{current?.label ?? 'Select…'}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setOpen(false)}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%' }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}><Text style={{ fontWeight: '700', fontSize: 16, color: colors.ink }}>{label}</Text></View>
            <ScrollView>
              {options.map((o) => (
                <Pressable key={o.value} onPress={() => { onSelect(o.value); setOpen(false); }} style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: o.value === value ? colors.primary : colors.ink, fontWeight: o.value === value ? '700' : '500' }}>{o.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function StatCard({ icon, value, label, color }: { icon: ReactNode; value: string | number; label: string; color: string }) {
  const { colors, styles } = useTheme();
  return (
    <View style={[styles.card, { flex: 1, marginBottom: 0 }]}>
      {icon}
      <Text style={{ fontSize: 28, fontWeight: '800', color: colors.ink, marginTop: 10 }}>{value}</Text>
      <Text style={{ color: colors.muted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}
