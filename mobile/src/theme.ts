import { StyleSheet } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export const lightColors = {
  primary: '#0f766e', primaryDark: '#115e59', primarySoft: '#ccfbf1',
  ink: '#172033', muted: '#64748b', surface: '#ffffff', bg: '#f5f7f9',
  border: '#e2e8f0', success: '#15803d', successSoft: '#dcfce7',
  warning: '#b45309', warningSoft: '#fef3c7', error: '#b91c1c', errorSoft: '#fee2e2',
};

export const darkColors = {
  primary: '#6b7280', primaryDark: '#4b5563', primarySoft: '#374151',
  ink: '#f1f5f9', muted: '#94a3b8', surface: '#1e293b', bg: '#0f172a',
  border: '#334155', success: '#22c55e', successSoft: '#14532d',
  warning: '#f59e0b', warningSoft: '#78350f', error: '#ef4444', errorSoft: '#450a0a',
};

export const colors = lightColors;

function makeStyles(c: typeof lightColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingBottom: 32 },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, backgroundColor: c.surface },
    eyebrow: { fontSize: 13, color: c.muted, marginBottom: 4 },
    title: { fontSize: 28, fontWeight: '700', color: c.ink },
    subtitle: { fontSize: 14, color: c.muted, marginTop: 6, lineHeight: 21 },
    card: { backgroundColor: c.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: c.border, marginBottom: 14 },
    row: { flexDirection: 'row', alignItems: 'center' },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: c.ink, marginBottom: 12 },
    label: { fontSize: 13, color: c.muted, marginBottom: 6 },
    button: { backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    input: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: c.ink, marginBottom: 14 },
  });
}

export const styles = makeStyles(lightColors);
export const darkStyles = makeStyles(darkColors);
