import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { BookOpen, CalendarClock } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useParentMobile } from '@/context/ParentMobileContext';
import { supabase } from '@/lib/supabase';
import type { Homework, Subject } from '@/lib/types';
import { Card, Empty, Loading, Badge, StatCard } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';

export default function ParentHomework() {
  const { profile } = useAuth();
  const { selectedChild, loading } = useParentMobile();
  const { colors, styles } = useTheme();
  const [items, setItems] = useState<Homework[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!selectedChild?.class_id || !profile?.school_id) return;
    (async () => {
      setFetching(true);
      const [hw, sub] = await Promise.all([
        supabase.from('homework').select('*').eq('school_id', profile.school_id).eq('class_id', selectedChild.class_id).order('due_date', { ascending: true }),
        supabase.from('subjects').select('*').eq('school_id', profile.school_id),
      ]);
      setItems((hw.data as Homework[]) ?? []);
      setSubjects((sub.data as Subject[]) ?? []);
      setFetching(false);
    })();
  }, [selectedChild?.class_id, profile?.school_id]);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const overdue = useMemo(() => items.filter((x) => new Date(x.due_date) < new Date()).length, [items]);

  if (loading || fetching) return <Loading />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{selectedChild?.full_name ?? 'Student'}</Text>
      <Text style={styles.title}>Homework</Text>
      <Text style={styles.subtitle}>{items.length} assignments · {overdue} overdue</Text>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
        <StatCard icon={<BookOpen color={colors.primary} size={22} />} value={items.length} label="Total" color={colors.primary} />
        <StatCard icon={<CalendarClock color={colors.error} size={22} />} value={overdue} label="Overdue" color={colors.error} />
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Assignments</Text>
      {!items.length ? (
        <Card><Empty title="No homework yet" body="Assignments for your child's class will appear here." /></Card>
      ) : items.map((item) => {
        const isOverdue = new Date(item.due_date) < new Date();
        const subject = subjectMap.get(item.subject_id ?? '');
        return (
          <Card key={item.id} style={isOverdue ? { borderColor: '#fecaca' } : undefined}>
            <View style={styles.row}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: isOverdue ? colors.errorSoft : colors.primarySoft, justifyContent: 'center', alignItems: 'center' }}>
                <BookOpen color={isOverdue ? colors.error : colors.primary} size={21} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 16 }}>{item.title}</Text>
                <Text style={{ color: isOverdue ? colors.error : colors.muted, marginTop: 5 }}>Due {formatDate(item.due_date)}</Text>
              </View>
              {subject && <Badge label={subject.code} color={colors.primary} bg={colors.primarySoft} />}
            </View>
            {item.description ? <Text style={{ color: colors.muted, lineHeight: 20, marginTop: 14 }}>{item.description}</Text> : null}
            <Text style={{ color: colors.muted, marginTop: 8, fontSize: 12 }}>{relativeTime(item.created_at)}</Text>
          </Card>
        );
      })}
    </ScrollView>
  );
}
