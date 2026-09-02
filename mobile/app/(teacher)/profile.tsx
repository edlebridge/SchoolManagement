import { Alert, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LogOut, User } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { Button, Card } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';

export default function TeacherProfile() {
  const { profile, school, signOut } = useAuth();
  const { colors, styles, mode, toggle } = useTheme();
  const router = useRouter();
  const logout = () => Alert.alert('Sign out', 'Are you sure you want to sign out?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/login'); } },
  ]);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Account</Text>
      <Text style={styles.title}>Profile</Text>
      <Card style={{ marginTop: 20, alignItems: 'center', paddingVertical: 26 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <User color={colors.primary} size={34} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink, marginTop: 14 }}>{profile?.full_name}</Text>
        <Text style={{ color: colors.muted, marginTop: 5 }}>Teacher · {school?.name}</Text>
      </Card>
      <Card>
        <Text style={styles.label}>Phone</Text>
        <Text style={{ color: colors.ink, fontSize: 16 }}>{profile?.phone ?? 'Not provided'}</Text>
      </Card>
      {profile?.address && <Card><Text style={styles.label}>Address</Text><Text style={{ color: colors.ink, fontSize: 16 }}>{profile.address}</Text></Card>}
      {profile?.gender && <Card><Text style={styles.label}>Gender</Text><Text style={{ color: colors.ink, fontSize: 16 }}>{profile.gender}</Text></Card>}
      <Button label={`Use ${mode === 'dark' ? 'light' : 'dark'} mode`} onPress={toggle} secondary />
      <View style={{ height: 10 }} />
      <Button label="Sign out" onPress={logout} secondary />
    </ScrollView>
  );
}
