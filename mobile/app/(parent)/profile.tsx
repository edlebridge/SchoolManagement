import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LogOut, User, Pencil, KeyRound, Mail, Phone, MapPin, Calendar, Shield, Check } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button, Card, Field, Select } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { formatDate } from '@/lib/format';

export default function ParentProfile() {
  const { profile, school, signOut } = useAuth();
  const { colors, styles, mode, toggle } = useTheme();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', address: '', gender: '' });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });

  useEffect(() => { supabase.auth.getSession().then(({ data: { session } }) => { if (session?.user?.email) setEmail(session.user.email); }); }, []);
  useEffect(() => { if (editOpen && profile) setEditForm({ full_name: profile.full_name ?? '', phone: profile.phone ?? '', address: profile.address ?? '', gender: profile.gender ?? '' }); }, [editOpen, profile]);
  useEffect(() => { if (passwordOpen) setPasswordForm({ newPassword: '', confirmPassword: '' }); }, [passwordOpen]);

  const logout = () => Alert.alert('Sign out', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/login'); } },
  ]);

  const saveProfile = async () => {
    if (!profile?.id || !editForm.full_name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('app_users').update({ full_name: editForm.full_name.trim(), phone: editForm.phone || null, address: editForm.address || null, gender: editForm.gender || null }).eq('id', profile.id);
    setSaving(false);
    if (error) { Alert.alert('Error', 'Failed to update profile'); return; }
    setEditOpen(false);
    Alert.alert('Success', 'Profile updated successfully');
  };

  const changePassword = async () => {
    if (!passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return; }
    if (passwordForm.newPassword.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
    setSaving(false);
    if (error) { Alert.alert('Error', 'Failed to change password'); return; }
    setPasswordOpen(false);
    Alert.alert('Success', 'Password changed successfully');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Account</Text>
      <Text style={styles.title}>Profile</Text>

      <Card style={{ marginTop: 20, alignItems: 'center', paddingVertical: 26 }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <User color={colors.primary} size={34} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink, marginTop: 14 }}>{profile?.full_name}</Text>
        <Text style={{ color: colors.muted, marginTop: 5 }}>Parent · {school?.name}</Text>
      </Card>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <Pressable onPress={() => setEditOpen(true)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, borderRadius: 14, paddingVertical: 13 }}>
          <Pencil color={colors.primary} size={18} /><Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 6 }}>Edit Profile</Text>
        </Pressable>
        <Pressable onPress={() => setPasswordOpen(true)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, borderRadius: 14, paddingVertical: 13 }}>
          <KeyRound color={colors.primary} size={18} /><Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 6 }}>Change Password</Text>
        </Pressable>
      </View>

      <Card style={{ marginTop: 14 }}>
        <InfoRow icon={<Mail color={colors.muted} size={16} />} label="Email" value={email || '—'} colors={colors} />
        <InfoRow icon={<Phone color={colors.muted} size={16} />} label="Phone" value={profile?.phone ?? '—'} colors={colors} />
        <InfoRow icon={<MapPin color={colors.muted} size={16} />} label="Address" value={profile?.address ?? '—'} colors={colors} />
        <InfoRow icon={<User color={colors.muted} size={16} />} label="Gender" value={profile?.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : '—'} colors={colors} />
        <InfoRow icon={<Calendar color={colors.muted} size={16} />} label="Joined" value={formatDate(profile?.created_at)} colors={colors} last />
      </Card>

      <Button label={`Use ${mode === 'dark' ? 'light' : 'dark'} mode`} onPress={toggle} secondary />
      <View style={{ height: 10 }} />
      <Button label="Sign out" onPress={logout} secondary />

      <Modal visible={editOpen} animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Pressable onPress={() => setEditOpen(false)}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>‹ Cancel</Text></Pressable>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink, marginLeft: 16 }}>Edit Profile</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Field label="Full Name" value={editForm.full_name} onChangeText={(v) => setEditForm({ ...editForm, full_name: v })} placeholder="Enter your full name" />
            <Field label="Phone" value={editForm.phone} onChangeText={(v) => setEditForm({ ...editForm, phone: v })} placeholder="Enter your phone number" />
            <Field label="Address" value={editForm.address} onChangeText={(v) => setEditForm({ ...editForm, address: v })} placeholder="Enter your address" multiline />
            <Select label="Gender" value={editForm.gender} options={[{ label: 'Select...', value: '' }, { label: 'Male', value: 'male' }, { label: 'Female', value: 'female' }, { label: 'Other', value: 'other' }]} onSelect={(v) => setEditForm({ ...editForm, gender: v })} />
            <Button label="Save Changes" onPress={saveProfile} loading={saving} />
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={passwordOpen} animationType="slide" onRequestClose={() => setPasswordOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Pressable onPress={() => setPasswordOpen(false)}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>‹ Cancel</Text></Pressable>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink, marginLeft: 16 }}>Change Password</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Field label="New Password" value={passwordForm.newPassword} onChangeText={(v) => setPasswordForm({ ...passwordForm, newPassword: v })} secureTextEntry placeholder="Enter new password" />
            <Field label="Confirm New Password" value={passwordForm.confirmPassword} onChangeText={(v) => setPasswordForm({ ...passwordForm, confirmPassword: v })} secureTextEntry placeholder="Confirm new password" />
            {passwordForm.newPassword && passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword ? <Text style={{ color: colors.error, marginBottom: 14 }}>Passwords do not match</Text> : null}
            <Button label="Change Password" onPress={changePassword} loading={saving} />
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value, colors, last }: { icon: React.ReactNode; label: string; value: string; colors: any; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      {icon}
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '600' }}>{label}</Text>
        <Text style={{ fontSize: 15, color: colors.ink, marginTop: 2 }}>{value}</Text>
      </View>
    </View>
  );
}
