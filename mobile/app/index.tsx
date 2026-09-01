import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Loading } from '@/components/ui';

export default function Index() {
  const { profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!profile) return <Redirect href="/login" />;
  if (profile.role === 'parent') return <Redirect href="/(parent)" />;
  if (profile.role === 'teacher') return <Redirect href="/(teacher)" />;
  return <Redirect href="/login" />;
}
