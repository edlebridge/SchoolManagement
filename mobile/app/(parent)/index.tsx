import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { CalendarCheck, BookOpen, ChartBar as BarChart3, ChevronRight, ClipboardCheck, FileText, Megaphone } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useParentMobile } from '@/context/ParentMobileContext';
import { supabase } from '@/lib/supabase';
import type { Attendance, Homework } from '@/lib/types';
import { Card, Empty, Loading, StatCard, Badge } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';

function HomeContent() {
  const { profile, school } = useAuth();
  const { children, selectedChild, selectedClass, loading, selectChild } = useParentMobile();
  const { colors, styles } = useTheme();
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!selectedChild || !profile?.school_id) return;
    (async () => {
      setFetching(true);
      const [a, h, an] = await Promise.all([
        supabase.from('attendance').select('status').eq('school_id', profile.school_id).eq('student_id', selectedChild.id).order('date', { ascending: false }).limit(100),
        selectedChild.class_id ? supabase.from('homework').select('*').eq('school_id', profile.school_id).eq('class_id', selectedChild.class_id).order('due_date', { ascending: true }).limit(10) : Promise.resolve({ data: [] }),
        supabase.from('announcements').select('*').eq('school_id', profile.school_id).order('created_at', { ascending: false }).limit(5),
      ]);
      setAttendance((a.data as Attendance[]) ?? []);
      setHomework((h.data as Homework[]) ?? []);
      setAnnouncements((an.data as any[]) ?? []);
      setFetching(false);
    })();
  }, [selectedChild, profile?.school_id]);

  if (loading || fetching) return <Loading />;

  const present = attendance.filter((x) => ['present', 'late'].includes(x.status)).length;
  const attPct = attendance.length ? Math.round(present / attendance.length * 100) : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{school?.name ?? 'EduBridge'}</Text>
      <Text style={styles.title}>{greeting}, {profile?.full_name?.split(' ')[0] ?? 'Parent'}</Text>
      <Text style={styles.subtitle}>Here is your child's school overview.</Text>

      {children.length === 0 ? (
        <Card><Empty title="No children linked" body="Please contact your school administrator." /></Card>
      ) : (
        <>
          {children.length > 1 && (
            <Card style={{ marginTop: 20 }}>
              <Text style={styles.label}>Selected child</Text>
              {children.map((child) => (
                <Pressable key={child.id} onPress={() => selectChild(child.id)}>
                  <Text style={{ fontSize: 17, fontWeight: child.id === selectedChild?.id ? '700' : '500', color: child.id === selectedChild?.id ? colors.primary : colors.ink, paddingVertical: 8 }}>
                    {child.full_name} · {child.id === selectedChild?.id ? selectedClass?.name ?? 'No class' : child.admission_number}
                  </Text>
                </Pressable>
              ))}
            </Card>
          )}

          {selectedChild && (
            <Card style={{ marginTop: children.length > 1 ? 12 : 20 }}>
              <View style={styles.row}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 20 }}>{selectedChild.full_name.slice(0, 1)}</Text>
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 }}>{selectedChild.full_name}</Text>
                  <Text style={{ color: colors.muted, marginTop: 3 }}>{selectedChild.admission_number} · {selectedClass?.name ?? 'No class'}</Text>
                </View>
                <Badge label={selectedChild.enrollment_status} color={selectedChild.enrollment_status === 'active' ? colors.success : colors.warning} bg={selectedChild.enrollment_status === 'active' ? colors.successSoft : colors.warningSoft} />
              </View>
            </Card>
          )}

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <StatCard icon={<CalendarCheck color={colors.success} size={22} />} value={`${attPct}%`} label="Attendance" color={colors.success} />
            <StatCard icon={<BookOpen color={colors.primary} size={22} />} value={homework.length} label="Homework" color={colors.primary} />
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Quick Access</Text>
          {[
            { label: 'Attendance', href: '/(parent)/attendance', Icon: CalendarCheck },
            { label: 'Homework', href: '/(parent)/homework', Icon: BookOpen },
            { label: 'Exams', href: '/(parent)/exams', Icon: ClipboardCheck },
            { label: 'Results', href: '/(parent)/results', Icon: BarChart3 },
            { label: 'Messages', href: '/(parent)/messages', Icon: Megaphone },
            { label: 'Requests', href: '/(parent)/requests', Icon: FileText },
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

          {announcements.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Announcements</Text>
              {announcements.map((a) => (
                <Card key={a.id}>
                  <Text style={{ fontWeight: '700', color: colors.ink }}>{a.title}</Text>
                  {a.body ? <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 20 }}>{a.body}</Text> : null}
                  <Text style={{ color: colors.muted, marginTop: 6, fontSize: 12 }}>{relativeTime(a.created_at)}</Text>
                </Card>
              ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

export default function ParentHome() { return <HomeContent />; }
