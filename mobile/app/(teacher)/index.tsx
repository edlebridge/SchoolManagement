import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { BookOpen, CalendarCheck, Users, ClipboardCheck, GraduationCap, ChartBar as BarChart3, FileText, ChevronRight, Megaphone } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { supabase } from '@/lib/supabase';
import type { Homework, ParentAttendanceRequest } from '@/lib/types';
import { Card, Empty, Loading, Badge, StatCard } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';

export default function TeacherHome() {
  const { profile, school } = useAuth();
  const { colors, styles } = useTheme();
  const { students, classes, classSubjects, subjects, examSessions, loading } = useSchoolData();
  const [homework, setHomework] = useState<Homework[]>([]);
  const [requests, setRequests] = useState<ParentAttendanceRequest[]>([]);
  const [fetching, setFetching] = useState(true);

  const myClasses = useMemo(() => {
    if (!profile?.id) return [];
    return classes.filter((c) => c.class_teacher_id === profile.id || classSubjects.some((cs) => cs.class_id === c.id && cs.teacher_id === profile.id));
  }, [classes, classSubjects, profile?.id]);

  const myClassIds = useMemo(() => myClasses.map((c) => c.id), [myClasses]);
  const myStudents = useMemo(() => students.filter((s) => myClassIds.includes(s.class_id ?? '')), [students, myClassIds]);

  useEffect(() => {
    if (!profile?.id || !profile.school_id) return;
    (async () => {
      const [hw, rq] = await Promise.all([
        supabase.from('homework').select('*').eq('teacher_id', profile.id).order('created_at', { ascending: false }).limit(5),
        myClassIds.length ? supabase.from('parent_attendance_requests').select('*').eq('school_id', profile.school_id).eq('status', 'pending').in('class_id', myClassIds).order('created_at', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
      ]);
      setHomework((hw.data as Homework[]) ?? []);
      setRequests((rq.data as ParentAttendanceRequest[]) ?? []);
      setFetching(false);
    })();
  }, [profile?.id, profile?.school_id, myClassIds.length]);

  if (loading || fetching) return <Loading />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{school?.name ?? 'EduBridge'}</Text>
      <Text style={styles.title}>{greeting}, {profile?.full_name?.split(' ')[0] ?? 'Teacher'}</Text>
      <Text style={styles.subtitle}>Your teaching day at a glance.</Text>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
        <StatCard icon={<Users color={colors.primary} size={22} />} value={myStudents.length} label="Students" color={colors.primary} />
        <StatCard icon={<BookOpen color={colors.primary} size={22} />} value={myClasses.length} label="Classes" color={colors.primary} />
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <StatCard icon={<ClipboardCheck color={colors.primary} size={22} />} value={examSessions.length} label="Exam Sessions" color={colors.primary} />
        <StatCard icon={<BookOpen color={colors.primary} size={22} />} value={homework.length} label="Homework" color={colors.primary} />
      </View>

      {requests.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Pending Requests</Text>
          {requests.map((r) => (
            <Link key={r.id} href="/(teacher)/requests" asChild>
              <Pressable><Card>
                <View style={styles.row}>
                  <FileText color={colors.warning} size={20} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontWeight: '700', color: colors.ink }}>{r.request_type}</Text>
                    <Text style={{ color: colors.muted, marginTop: 3 }}>{relativeTime(r.created_at)}</Text>
                  </View>
                  <Badge label="Pending" color={colors.warning} bg={colors.warningSoft} />
                </View>
              </Card></Pressable>
            </Link>
          ))}
        </>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Quick Access</Text>
      {[
        { label: 'Students', href: '/(teacher)/students', Icon: Users },
        { label: 'Attendance', href: '/(teacher)/attendance', Icon: CalendarCheck },
        { label: 'Homework', href: '/(teacher)/homework', Icon: BookOpen },
        { label: 'Exam Sessions', href: '/(teacher)/exams', Icon: ClipboardCheck },
        { label: 'Marks', href: '/(teacher)/marks', Icon: GraduationCap },
        { label: 'Results', href: '/(teacher)/results', Icon: BarChart3 },
        { label: 'Messages', href: '/(teacher)/messages', Icon: Megaphone },
        { label: 'Requests', href: '/(teacher)/requests', Icon: FileText },
      ].map(({ label, href, Icon }) => (
        <Link key={label} href={href as any} asChild>
          <Pressable><Card>
            <View style={styles.row}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon color={colors.primary} size={21} />
              </View>
              <Text style={{ flex: 1, marginLeft: 12, fontWeight: '700', color: colors.ink }}>{label}</Text>
              <ChevronRight color={colors.muted} size={20} />
            </View>
          </Card></Pressable>
        </Link>
      ))}

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>My Classes</Text>
      {!myClasses.length ? <Card><Empty title="No classes assigned" body="Your assigned classes will appear here." /></Card> : myClasses.map((c) => {
        const count = myStudents.filter((s) => s.class_id === c.id).length;
        return (
          <Card key={c.id}>
            <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 }}>{c.name}</Text>
            <Text style={{ color: colors.muted, marginTop: 5 }}>{count} students · {c.grade_level ?? 'Class'} · {c.stream ?? 'All'}</Text>
          </Card>
        );
      })}

      {homework.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Recent Homework</Text>
          {homework.map((h) => (
            <Card key={h.id}>
              <Text style={{ fontWeight: '700', color: colors.ink }}>{h.title}</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>Due {formatDate(h.due_date)} · {relativeTime(h.created_at)}</Text>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}
