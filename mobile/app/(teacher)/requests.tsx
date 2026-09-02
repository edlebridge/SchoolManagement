import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Check, X, Clock3, DoorOpen, FileText } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { supabase } from '@/lib/supabase';
import type { ParentAttendanceRequest } from '@/lib/types';
import { Card, Empty, Loading, Badge, Button } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';

const TYPE_META: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  absence: { icon: FileText, color: '#b91c1c', bg: '#fee2e2', label: 'Absence' },
  late: { icon: Clock3, color: '#b45309', bg: '#fef3c7', label: 'Late Arrival' },
  early_collection: { icon: DoorOpen, color: '#b91c1c', bg: '#fee2e2', label: 'Early Collection' },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#b45309', bg: '#fef3c7' },
  approved: { label: 'Approved', color: '#15803d', bg: '#dcfce7' },
  rejected: { label: 'Rejected', color: '#b91c1c', bg: '#fee2e2' },
  acknowledged: { label: 'Acknowledged', color: '#0f766e', bg: '#ccfbf1' },
};

export default function TeacherRequests() {
  const { profile } = useAuth();
  const { colors, styles } = useTheme();
  const { students, classes, classSubjects, loading } = useSchoolData();
  const [requests, setRequests] = useState<ParentAttendanceRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [reviewTarget, setReviewTarget] = useState<ParentAttendanceRequest | null>(null);
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const myClassIds = useMemo(() => {
    if (!profile?.id) return [];
    return classes.filter((c) => c.class_teacher_id === profile.id || classSubjects.some((cs) => cs.class_id === c.id && cs.teacher_id === profile.id)).map((c) => c.id);
  }, [classes, classSubjects, profile?.id]);

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const load = async () => {
    if (!profile?.school_id || !myClassIds.length) { setFetching(false); return; }
    setFetching(true);
    const { data } = await supabase.from('parent_attendance_requests').select('*').eq('school_id', profile.school_id).in('class_id', myClassIds).order('created_at', { ascending: false });
    setRequests((data as ParentAttendanceRequest[]) ?? []);
    setFetching(false);
  };

  useEffect(() => { load(); }, [profile?.school_id, myClassIds.length]);

  const openReview = (r: ParentAttendanceRequest) => { setReviewTarget(r); setReviewStatus('acknowledged'); setReviewNotes(''); };
  const submitReview = async () => {
    if (!reviewTarget || !profile?.id) return;
    setSaving(true);
    await supabase.from('parent_attendance_requests').update({ status: reviewStatus, review_notes: reviewNotes.trim() || null, reviewed_by: profile.id, reviewed_at: new Date().toISOString() }).eq('id', reviewTarget.id);
    if (reviewTarget.parent_user_id && profile.school_id) {
      supabase.from('notifications').insert({ school_id: profile.school_id, user_id: reviewTarget.parent_user_id, type: 'attendance_request_review', title: 'Request Reviewed', body: `Your ${TYPE_META[reviewTarget.request_type]?.label ?? 'request'} has been ${STATUS_META[reviewStatus]?.label ?? reviewStatus}.`, link: '/parent/attendance-requests' });
    }
    setSaving(false); setReviewTarget(null); load();
  };

  if (loading || fetching) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Student wellbeing</Text>
        <Text style={styles.title}>Attendance Requests</Text>
        <Text style={styles.subtitle}>{requests.filter((r) => r.status === 'pending').length} pending · {requests.length} total</Text>
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>All requests</Text>
        {!requests.length ? <Card><Empty title="No requests" body="Parent attendance requests for your classes will appear here." /></Card> : requests.map((r) => {
          const meta = TYPE_META[r.request_type];
          const sm = STATUS_META[r.status];
          const student = studentMap.get(r.student_id);
          const Icon = meta?.icon ?? FileText;
          return (
            <Card key={r.id}>
              <View style={styles.row}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: meta?.bg ?? colors.border, justifyContent: 'center', alignItems: 'center' }}>
                  <Icon color={meta?.color ?? colors.muted} size={20} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontWeight: '700', color: colors.ink }}>{meta?.label ?? r.request_type}</Text>
                  <Text style={{ color: colors.muted, marginTop: 3 }}>{student?.full_name ?? 'Student'} · {classMap.get(r.class_id ?? '')?.name ?? '—'}</Text>
                </View>
                <Badge label={sm?.label ?? r.status} color={sm?.color ?? colors.muted} bg={sm?.bg ?? colors.border} />
              </View>
              <View style={{ marginTop: 10 }}>
                {r.request_type === 'absence' && <Text style={{ color: colors.muted }}>Reason: {r.reason ?? '—'} · {formatDate(r.from_date)} – {formatDate(r.to_date)}</Text>}
                {r.request_type === 'late' && <Text style={{ color: colors.muted }}>Date: {formatDate(r.date)} · Expected: {r.expected_arrival_time ?? '—'}</Text>}
                {r.request_type === 'early_collection' && <Text style={{ color: colors.muted }}>Date: {formatDate(r.date)} · Leaving: {r.leaving_time ?? '—'} · Collected by: {r.collected_by ?? '—'}</Text>}
                {r.notes ? <Text style={{ color: colors.muted, marginTop: 4 }}>Notes: {r.notes}</Text> : null}
                {r.review_notes ? <Text style={{ color: colors.muted, marginTop: 4 }}>Review: {r.review_notes}</Text> : null}
                <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>{relativeTime(r.created_at)}</Text>
              </View>
              {r.status === 'pending' && (
                <Pressable onPress={() => openReview(r)} style={{ marginTop: 10, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Review</Text>
                </Pressable>
              )}
            </Card>
          );
        })}
      </ScrollView>
      <Modal visible={!!reviewTarget} animationType="slide" onRequestClose={() => setReviewTarget(null)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Pressable onPress={() => setReviewTarget(null)}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>‹ Cancel</Text></Pressable>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink, marginLeft: 16 }}>Review Request</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {reviewTarget && (
              <Card>
                <Text style={{ fontWeight: '700', color: colors.ink }}>{TYPE_META[reviewTarget.request_type]?.label}</Text>
                <Text style={{ color: colors.muted, marginTop: 6 }}>{studentMap.get(reviewTarget.student_id)?.full_name ?? 'Student'}</Text>
              </Card>
            )}
            <Text style={[styles.label, { marginTop: 16 }]}>Status</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {(['acknowledged', 'approved', 'rejected'] as const).map((s) => {
                const sm = STATUS_META[s];
                return (
                  <Pressable key={s} onPress={() => setReviewStatus(s)} style={{ flex: 1, backgroundColor: reviewStatus === s ? sm.color : colors.surface, borderWidth: 1, borderColor: reviewStatus === s ? sm.color : colors.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ color: reviewStatus === s ? '#fff' : colors.ink, fontWeight: '700' }}>{sm.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>Response notes</Text>
            <TextInput value={reviewNotes} onChangeText={setReviewNotes} placeholder="Add response notes…" placeholderTextColor={colors.muted} multiline numberOfLines={3} style={[styles.input, { marginBottom: 0 }]} />
            <View style={{ marginTop: 16 }}><Button label="Submit Review" onPress={submitReview} loading={saving} /></View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
