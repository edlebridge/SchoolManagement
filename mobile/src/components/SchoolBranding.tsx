import { Image, View, Text } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

export function SchoolLogo({ size = 36, borderRadius = 10 }: { size?: number; borderRadius?: number }) {
  const { school } = useAuth();
  const { colors } = useTheme();
  if (school?.logo_url) {
    return <Image source={{ uri: school.logo_url }} style={{ width: size, height: size, borderRadius, resizeMode: 'contain' }} />;
  }
  const initials = (school?.name ?? 'S').charAt(0).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.5 }}>{initials}</Text>
    </View>
  );
}

export function SchoolName({ fontSize = 14 }: { fontSize?: number }) {
  const { school } = useAuth();
  const { colors } = useTheme();
  if (!school?.name) return null;
  return <Text style={{ color: colors.ink, fontWeight: '700', fontSize }} numberOfLines={1}>{school.name}</Text>;
}
