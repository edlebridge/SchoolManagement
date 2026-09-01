import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Field } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { colors, styles } from '@/theme';

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async () => { setError(''); setLoading(true); const message = await signIn(email, password); setLoading(false); if (message) setError(message); else router.replace('/'); };
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled"><View style={{ alignItems: 'center', marginBottom: 40 }}><View style={{ width: 68, height: 68, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 32, fontWeight: '800' }}>E</Text></View><Text style={{ color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: 16 }}>EduBridge</Text><Text style={styles.subtitle}>Your school, always within reach.</Text></View><View style={styles.card}><Text style={styles.sectionTitle}>Welcome back</Text><Field label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" /><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Enter your password" />{error ? <Text style={{ color: colors.error, marginBottom: 14 }}>{error}</Text> : null}<Button label="Sign in" onPress={submit} loading={loading} /></View></ScrollView></KeyboardAvoidingView>;
}
