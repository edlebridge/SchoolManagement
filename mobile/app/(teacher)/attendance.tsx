import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CalendarCheck } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { supabase } from '@/lib/supabase';
import type { ClassRow, Student, Attendance } from '@/lib/types';
import { Card, Empty, Loading } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';

type Status = 'present' | 'absent' | 'late' | 'excused';
const STATUS_OPTS: { label: string; value: Status; color: string }[] = [
  { label: 'P', value: 'present', color: '#15803d' },
  { label: 'L', value: 'late', color: '#b45309' },
  { label: 'A', value: 'absent', color: '#b91c1c' },
  { label: 'E', value: 'excused', color: '#64748b' },
];

export default function TeacherAttendance() {
  const { profile } = useAuth();
  const { colors, styles } = useTheme();
  const { classes, students, classSubjects, loading } = useSchoolData();
  const [selected, setSelected] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [session, setSession] = useState<'morning' | 'afternoon'>('morning');
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [existing, setExisting] = useState<Record<string, string>>({});
  const [fetching, setFetching] = useState(false);

  const myClasses = classes.filter((c) => c.class_teacher_id === profile?.id || classSubjects.some((cs) => cs.class_id === c.id && cs.teacher_id === profile?.id));
  const classStudents = students.filter((s) => s.class_id === selected && s.enrollment_status === 'active');

  useEffect(() => { if (myClasses.length && !selected) setSelected(myClasses[0].id); }, [myClasses, selected]);

  useEffect(() => {
    if (!selected) return;
    setFetching(true);
    (async () => {
      const { data } = await supabase.from('attendance').select('*').eq('class_id', selected).eq('date', date).eq('session', session);
      const ex: Record<string, string> = {};
      (data as Attendance[])?.forEach((a) => { ex[a.student_id] = a.status; });
      setExisting(ex);
      const init: Record<string, Status> = {};
      classStudents.forEach((s) => { init[s.id] = (ex[s.id] as Status) ?? 'present'; });
      setStatuses(init);
      setFetching(false);
    })();
  }, [selected, date, session]);

  const save = async () => {
    if (!profile?.school_id || !profile.id || !selected) return;
    const rows = classStudents.map((s) => ({ school_id: profile.school_id, student_id: s.id, class_id: selected, date, session, status: statuses[s.id] ?? 'present', notes: null, marked_by: profile.id }));
    await supabase.from('attendance').upsert(rows, { onConflict: 'student_id,date,session' });
  };

  if (loading) return <Loading />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Today · {new Date().toLocaleDateString()}</Text>
      <Text style={styles.title}>Attendance</Text>
      <Text style={styles.subtitle}>Tap a status to save it for the school.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 18, marginBottom: 8 }}>
        {myClasses.map((c) => (
          <Pressable key={c.id} onPress={() => setSelected(c.id)} style={{ backgroundColor: selected === c.id ? colors.primary : colors.surface, borderColor: selected === c.id ? colors.primary : colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginRight: 8 }}>
            <Text style={{ color: selected === c.id ? '#fff' : colors.ink, fontWeight: '700' }}>{c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {(['morning', 'afternoon'] as const).map((s) => (
          <Pressable key={s} onPress={() => setSession(s)} style={{ flex: 1, backgroundColor: session === s ? colors.primary : colors.surface, borderColor: session === s ? colors.primary : colors.border, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
            <Text style={{ color: session === s ? '#fff' : colors.ink, fontWeight: '700', textTransform: 'capitalize' }}>{s}</Text>
          </Pressable>
        ))}
      </View>

      {fetching ? <Loading /> : !classStudents.length ? <Card><Empty title="No students in this class" body="Choose another class or contact the school administrator." /></Card> : (
        <>
          {classStudents.map((student) => (
            <Card key={student.id}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: colors.ink }}>{student.full_name}</Text>
                  <Text style={{ color: colors.muted, marginTop: 3 }}>{student.admission_number}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {STATUS_OPTS.map((opt) => (
                    <Pressable key={opt.value} onPress={() => setStatuses({ ...statuses, [student.id]: opt.value })} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: statuses[student.id] === opt.value ? opt.color : colors.bg, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: statuses[student.id] === opt.value ? '#fff' : opt.color, fontWeight: '800' }}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </Card>
          ))}
          <Pressable onPress={save} style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save Attendance</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
