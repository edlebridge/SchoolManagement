import { useState } from 'react';
import { Image, ImageBackground, KeyboardAvoidingView, Platform, ScrollView, Text, View, Pressable, TextInput } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Button, Field } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { colors, styles } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async () => {
    setError('');
    if (!email.trim() || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    const message = await signIn(email, password);
    setLoading(false);
    if (message) { setError(message); return; }
    router.replace('/');
  };

  return (
    <ImageBackground source={require('../assets/EdLe_Bridge_Background.png')} style={styles.screen} resizeMode="cover">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <Image source={require('../assets/EdLe_Bridge_Logo.png')} style={{ width: 260, height: 180, resizeMode: 'contain' }} />
            <Text style={styles.subtitle}>Your school, always within reach.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Welcome back</Text>
            <Field label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
            <View>
              <Text style={styles.label}>Password</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { flex: 1, marginBottom: 0, paddingRight: 44 }]}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, padding: 6 }}>
                  {showPassword ? <EyeOff color={colors.muted} size={22} /> : <Eye color={colors.muted} size={22} />}
                </Pressable>
              </View>
            </View>
            {error ? <Text style={{ color: colors.error, marginBottom: 14 }}>{error}</Text> : null}
            <Button label="Sign in" onPress={submit} loading={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}
