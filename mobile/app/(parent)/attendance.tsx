import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { CalendarCheck } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useParentMobile } from '@/context/ParentMobileContext';
import { supabase } from '@/lib/supabase';
import type { Attendance } from '@/lib/types';
import { Card, Empty, Loading, StatCard } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';

export default function ParentAttendance() {
  const { profile } = useAuth();
  const { selectedChild, loading } = useParentMobile();
  const { colors, styles } = useTheme();
  const [records, setRecords] = useState<Attendance[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!selectedChild || !profile?.school_id) return;
    (async () => {
      setFetching(true);
      const { data } = await supabase.from('attendance').select('*').eq('school_id', profile.school_id).eq('student_id', selectedChild.id).order('date', { ascending: false }).limit(60);
      setRecords((data as Attendance[]) ?? []);
      setFetching(false);
    })();
  }, [selectedChild, profile?.school_id]);

  const present = records.filter((x) => ['present', 'late'].includes(x.status)).length;
  const pct = records.length ? Math.round(present / records.length * 100) : 0;
  const absent = records.length - present;
  const byDate = useMemo(() => [...new Set(records.map((x) => x.date))], [records]);

  if (loading || fetching) return <Loading />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Student wellbeing</Text>
      <Text style={styles.title}>Attendance</Text>
      <Text style={styles.subtitle}>{selectedChild?.full_name ?? 'Select a child'} · {pct}% attendance</Text>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
        <StatCard icon={<CalendarCheck color={colors.success} size={22} />} value={`${pct}%`} label="Present" color={colors.success} />
        <StatCard icon={<CalendarCheck color={colors.error} size={22} />} value={absent} label="Absent" color={colors.error} />
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Recent Days</Text>
      {!selectedChild || !records.length ? (
        <Card><Empty title="No attendance recorded" body="Attendance records will appear here once the school marks them." /></Card>
      ) : byDate.map((date) => {
        const day = records.filter((x) => x.date === date);
        const allPresent = day.every((x) => ['present', 'late'].includes(x.status));
        return (
          <Card key={date}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.ink }}>{formatDate(date)}</Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>{day.map((x) => `${x.session}: ${x.status}`).join(' · ')}</Text>
              </View>
              <View style={{ backgroundColor: allPresent ? colors.successSoft : colors.errorSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: allPresent ? colors.success : colors.error, fontWeight: '700' }}>{allPresent ? 'Present' : 'Review'}</Text>
              </View>
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}
