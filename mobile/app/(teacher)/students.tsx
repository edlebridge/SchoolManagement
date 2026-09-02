import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { supabase } from '@/lib/supabase';
import type { Student, AppUser, Attendance, ExamMark, Subject } from '@/lib/types';
import { Card, Empty, Loading, Badge } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';

export default function TeacherStudents() {
  const { profile } = useAuth();
  const { colors, styles } = useTheme();
  const { students, classes, classSubjects, subjects, loading } = useSchoolData();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [viewing, setViewing] = useState<Student | null>(null);
  const [parents, setParents] = useState<AppUser[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [marks, setMarks] = useState<ExamMark[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const myClassIds = useMemo(() => {
    if (!profile?.id) return [];
    return classes.filter((c) => c.class_teacher_id === profile.id || classSubjects.some((cs) => cs.class_id === c.id && cs.teacher_id === profile.id)).map((c) => c.id);
  }, [classes, classSubjects, profile?.id]);

  const myStudents = useMemo(() => students.filter((s) => myClassIds.includes(s.class_id ?? '')), [students, myClassIds]);

  const filtered = useMemo(() => {
    let list = myStudents;
    if (classFilter !== 'all') list = list.filter((s) => s.class_id === classFilter);
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter((s) => s.full_name.toLowerCase().includes(q) || s.admission_number.toLowerCase().includes(q)); }
    return list;
  }, [myStudents, classFilter, search]);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  useEffect(() => {
    if (!viewing) return;
    setDetailLoading(true);
    (async () => {
      const [par, att, mk] = await Promise.all([
        supabase.from('student_parents').select('parent_user_id, relationship, is_primary_guardian').eq('student_id', viewing.id),
        supabase.from('attendance').select('*').eq('student_id', viewing.id).order('date', { ascending: false }).limit(10),
        supabase.from('exam_marks').select('*').eq('student_id', viewing.id).order('created_at', { ascending: false }).limit(10),
      ]);
      const parIds = (par.data ?? []).map((x: { parent_user_id: string }) => x.parent_user_id);
      const { data: parUsers } = parIds.length ? await supabase.from('app_users').select('*').in('user_id', parIds) : { data: [] };
      setParents((parUsers as AppUser[]) ?? []);
      setAttendance((att.data as Attendance[]) ?? []);
      setMarks((mk.data as ExamMark[]) ?? []);
      setDetailLoading(false);
    })();
  }, [viewing]);

  if (loading) return <Loading />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Teaching workspace</Text>
      <Text style={styles.title}>Students</Text>
      <Text style={styles.subtitle}>{myStudents.length} students across {myClassIds.length} classes</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
        <Search color={colors.muted} size={18} style={{ position: 'absolute', left: 14, zIndex: 1 }} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search by name or admission no…" placeholderTextColor={colors.muted} style={[styles.input, { paddingLeft: 40, marginBottom: 0, flex: 1 }]} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        <Pressable onPress={() => setClassFilter('all')} style={{ backgroundColor: classFilter === 'all' ? colors.primary : colors.surface, borderColor: classFilter === 'all' ? colors.primary : colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 }}>
          <Text style={{ color: classFilter === 'all' ? '#fff' : colors.ink, fontWeight: '700' }}>All</Text>
        </Pressable>
        {classes.filter((c) => myClassIds.includes(c.id)).map((c) => (
          <Pressable key={c.id} onPress={() => setClassFilter(c.id)} style={{ backgroundColor: classFilter === c.id ? colors.primary : colors.surface, borderColor: classFilter === c.id ? colors.primary : colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 }}>
            <Text style={{ color: classFilter === c.id ? '#fff' : colors.ink, fontWeight: '700' }}>{c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {!filtered.length ? <Card><Empty title="No students found" body="Try adjusting your search or class filter." /></Card> : filtered.map((s) => (
        <Pressable key={s.id} onPress={() => setViewing(s)}>
          <Card>
            <View style={styles.row}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>{s.full_name.slice(0, 1)}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontWeight: '700', color: colors.ink }}>{s.full_name}</Text>
                <Text style={{ color: colors.muted, marginTop: 3 }}>{s.admission_number} · {classMap.get(s.class_id ?? '')?.name ?? 'No class'}</Text>
              </View>
              {s.enrollment_status !== 'active' && <Badge label={s.enrollment_status} color={colors.warning} bg={colors.warningSoft} />}
            </View>
          </Card>
        </Pressable>
      ))}

      <Modal visible={!!viewing} animationType="slide" onRequestClose={() => setViewing(null)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Pressable onPress={() => setViewing(null)}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>‹ Back</Text></Pressable>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink, marginLeft: 16 }}>Student Profile</Text>
          </View>
          {viewing && (detailLoading ? <Loading /> : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
              <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 28 }}>{viewing.full_name.slice(0, 1)}</Text>
                </View>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink, marginTop: 12 }}>{viewing.full_name}</Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>{viewing.admission_number} · {classMap.get(viewing.class_id ?? '')?.name ?? 'No class'}</Text>
                <View style={{ marginTop: 8 }}><Badge label={viewing.enrollment_status} color={viewing.enrollment_status === 'active' ? colors.success : colors.warning} bg={viewing.enrollment_status === 'active' ? colors.successSoft : colors.warningSoft} /></View>
              </Card>
              <Card>
                <Text style={styles.sectionTitle}>Details</Text>
                <Text style={{ color: colors.ink }}>Gender: {viewing.gender ?? '—'}</Text>
                <Text style={{ color: colors.ink, marginTop: 6 }}>DOB: {formatDate(viewing.date_of_birth)}</Text>
                <Text style={{ color: colors.ink, marginTop: 6 }}>Nationality: {viewing.nationality ?? '—'}</Text>
                <Text style={{ color: colors.ink, marginTop: 6 }}>Phone: {viewing.phone_number ?? '—'}</Text>
                <Text style={{ color: colors.ink, marginTop: 6 }}>Address: {viewing.address ?? '—'}</Text>
                <Text style={{ color: colors.ink, marginTop: 6 }}>Emergency: {viewing.emergency_contact_name ?? '—'} ({viewing.emergency_contact_phone ?? '—'})</Text>
                <Text style={{ color: colors.ink, marginTop: 6 }}>Medical: {viewing.medical_notes ?? 'None'}</Text>
                <Text style={{ color: colors.ink, marginTop: 6 }}>Admitted: {formatDate(viewing.admitted_at)}</Text>
              </Card>
              {parents.length > 0 && (
                <Card>
                  <Text style={styles.sectionTitle}>Parents / Guardians</Text>
                  {parents.map((p) => (
                    <View key={p.id} style={{ marginBottom: 8 }}>
                      <Text style={{ fontWeight: '700', color: colors.ink }}>{p.full_name}</Text>
                      <Text style={{ color: colors.muted }}>{p.phone ?? 'No phone'}</Text>
                    </View>
                  ))}
                </Card>
              )}
              {attendance.length > 0 && (
                <Card>
                  <Text style={styles.sectionTitle}>Recent Attendance</Text>
                  {attendance.map((a) => (
                    <View key={a.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                      <Text style={{ color: colors.ink }}>{formatDate(a.date)} · {a.session}</Text>
                      <Text style={{ color: a.status === 'present' ? colors.success : a.status === 'absent' ? colors.error : colors.warning, fontWeight: '700' }}>{a.status}</Text>
                    </View>
                  ))}
                </Card>
              )}
              {marks.length > 0 && (
                <Card>
                  <Text style={styles.sectionTitle}>Recent Marks</Text>
                  {marks.map((m) => (
                    <View key={m.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                      <Text style={{ color: colors.ink }}>{subjectMap.get(m.subject_id)?.name ?? 'Subject'}: {m.marks}/{m.total_marks}</Text>
                      <Text style={{ color: colors.muted }}>{m.grade}</Text>
                    </View>
                  ))}
                </Card>
              )}
            </ScrollView>
          ))}
        </View>
      </Modal>
    </ScrollView>
  );
}
