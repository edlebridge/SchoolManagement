import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#0f766e', primaryDark: '#115e59', primarySoft: '#ccfbf1',
  ink: '#172033', muted: '#64748b', surface: '#ffffff', bg: '#f5f7f9',
  border: '#e2e8f0', success: '#15803d', successSoft: '#dcfce7',
  warning: '#b45309', warningSoft: '#fef3c7', error: '#b91c1c', errorSoft: '#fee2e2',
};

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 32 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, backgroundColor: colors.surface },
  eyebrow: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 6, lineHeight: 21 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 12 },
  label: { fontSize: 13, color: colors.muted, marginBottom: 6 },
  button: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: colors.ink, marginBottom: 14 },
});
