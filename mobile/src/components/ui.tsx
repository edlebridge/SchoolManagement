import { ActivityIndicator, Pressable, Text, TextInput, View, type TextInputProps, type ReactNode } from 'react-native';
import { colors, styles } from '@/theme';

export function Card({ children, style }: { children: ReactNode; style?: object }) { return <View style={[styles.card, style]}>{children}</View>; }
export function Button({ label, onPress, loading = false, secondary = false }: { label: string; onPress: () => void; loading?: boolean; secondary?: boolean }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.button, secondary && { backgroundColor: colors.primarySoft }, pressed && { opacity: 0.8 }]}><Text style={[styles.buttonText, secondary && { color: colors.primary }]}>{loading ? 'Please wait…' : label}</Text></Pressable>; }
export function Field({ label, ...props }: TextInputProps & { label: string }) { return <View><Text style={styles.label}>{label}</Text><TextInput {...props} placeholderTextColor={colors.muted} style={styles.input} /></View>; }
export function Loading() { return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}><ActivityIndicator size="large" color={colors.primary} /></View>; }
export function Empty({ title, body }: { title: string; body: string }) { return <View style={{ alignItems: 'center', paddingVertical: 32 }}><Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>{title}</Text><Text style={{ color: colors.muted, textAlign: 'center', marginTop: 6 }}>{body}</Text></View>; }
