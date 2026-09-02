import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Clock3, DoorOpen, FileText, Plus } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useParentMobile } from '@/context/ParentMobileContext';
import { supabase } from '@/lib/supabase';
import type { ParentAttendanceRequest, AttendanceRequestType } from '@/lib/types';
import { Card, Empty, Loading, Badge, Button, Field, Select } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';

const TYPE_META: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  absence: { icon: FileText, color: '#b91c1c', bg: '#fee2e2', label: 'Report Absence' },
  late: { icon: Clock3, color: '#b45309', bg: '#fef3c7', label: 'Report Late' },
  early_collection: { icon: DoorOpen, color: '#b91c1c', bg: '#fee2e2', label: 'Collected Early' },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#b45309', bg: '#fef3c7' },
  approved: { label: 'Approved', color: '#15803d', bg: '#dcfce7' },
  rejected: { label: 'Rejected', color: '#b91c1c', bg: '#fee2e2' },
  acknowledged: { label: 'Acknowledged', color: '#0f766e', bg: '#ccfbf1' },
};

const ABSENCE_REASONS = ['holiday', 'illness', 'urgent_family', 'other'];

export default function ParentRequests() {
  const { profile } = useAuth();
  const { children, selectedChild, loading } = useParentMobile();
  const { colors, styles } = useTheme();
  const [requests, setRequests] = useState<ParentAttendanceRequest[]>([]);
  const [fetching, setFetching] = useState(true);
  const [modal, setModal] = useState(false);
  const [formType, setFormType] = useState<AttendanceRequestType>('absence');
  const [form, setForm] = useState({ studentId: '', reason: 'illness', customReason: '', fromDate: '', toDate: '', date: '', arrivalTime: '', leavingTime: '', collectedBy: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!profile?.user_id) { setFetching(false); return; }
    setFetching(true);
    const { data } = await supabase.from('parent_attendance_requests').select('*').eq('parent_user_id', profile.user_id).order('created_at', { ascending: false });
    setRequests((data as ParentAttendanceRequest[]) ?? []);
    setFetching(false);
  };

  useEffect(() => { load(); }, [profile?.user_id]);

  const openModal = (type: AttendanceRequestType) => {
    setFormType(type);
    const today = new Date().toISOString().slice(0, 10);
    setForm({ studentId: selectedChild?.id ?? children[0]?.id ?? '', reason: 'illness', customReason: '', fromDate: today, toDate: today, date: today, arrivalTime: '', leavingTime: '', collectedBy: '', notes: '' });
    setModal(true);
  };

  const submit = async () => {
    if (!profile?.user_id || !profile.school_id || !form.studentId) return;
    if (formType === 'absence' && (!form.fromDate || !form.toDate)) return;
    if (formType === 'late' && !form.date) return;
    if (formType === 'early_collection' && !form.date) return;
    setSaving(true);
    const child = children.find((c) => c.id === form.studentId);
    const payload: Record<string, any> = {
      school_id: profile.school_id,
      parent_user_id: profile.user_id,
      student_id: form.studentId,
      class_id: child?.class_id ?? null,
      request_type: formType,
      status: 'pending',
      notes: form.notes.trim() || null,
    };
    if (formType === 'absence') { payload.reason = form.reason === 'other' ? 'other' : form.reason; payload.custom_reason = form.reason === 'other' ? form.customReason : null; payload.from_date = form.fromDate; payload.to_date = form.toDate; }
    if (formType === 'late') { payload.date = form.date; payload.expected_arrival_time = form.arrivalTime || null; }
    if (formType === 'early_collection') { payload.date = form.date; payload.leaving_time = form.leavingTime || null; payload.collected_by = form.collectedBy || null; }

    const { error } = await supabase.from('parent_attendance_requests').insert(payload);
    if (error) { setSaving(false); return; }

    // Notify school admins and class teacher
    const { data: admins } = await supabase.from('app_users').select('user_id').eq('school_id', profile.school_id).eq('role', 'school_admin').eq('active', true);
    const notifyIds = (admins ?? []).map((a: { user_id: string }) => a.user_id);
    if (child?.class_id) {
      const { data: cls } = await supabase.from('classes').select('class_teacher_id').eq('id', child.class_id).maybeSingle();
      if (cls?.class_teacher_id) {
        const { data: teacher } = await supabase.from('app_users').select('user_id').eq('id', cls.class_teacher_id).maybeSingle();
        if (teacher?.user_id) notifyIds.push(teacher.user_id);
      }
    }
    if (notifyIds.length) {
      supabase.from('notifications').insert(notifyIds.map((uid: string) => ({ school_id: profile.school_id, user_id: uid, type: 'attendance_request', title: 'New Attendance Request', body: `${TYPE_META[formType].label} request from ${profile.full_name}`, link: '/teacher/requests' })));
    }

    setSaving(false); setModal(false); load();
  };

  if (loading || fetching) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{selectedChild?.full_name ?? 'Student'}</Text>
        <Text style={styles.title}>Attendance Requests</Text>
        <Text style={styles.subtitle}>Report absences, late arrivals, or early collections</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          {(['absence', 'late', 'early_collection'] as const).map((type) => {
            const meta = TYPE_META[type];
            const Icon = meta.icon;
            return (
              <Pressable key={type} onPress={() => openModal(type)} style={{ flex: 1, backgroundColor: meta.bg, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                <Icon color={meta.color} size={22} />
                <Text style={{ color: meta.color, fontWeight: '700', fontSize: 12, marginTop: 6, textAlign: 'center' }}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Your Requests</Text>
        {!requests.length ? <Card><Empty title="No requests" body="Your attendance requests will appear here." /></Card> : requests.map((r) => {
          const meta = TYPE_META[r.request_type];
          const sm = STATUS_META[r.status];
          const Icon = meta?.icon ?? FileText;
          return (
            <Card key={r.id}>
              <View style={styles.row}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: meta?.bg ?? colors.border, justifyContent: 'center', alignItems: 'center' }}>
                  <Icon color={meta?.color ?? colors.muted} size={20} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontWeight: '700', color: colors.ink }}>{meta?.label ?? r.request_type}</Text>
                  <Text style={{ color: colors.muted, marginTop: 3 }}>{relativeTime(r.created_at)}</Text>
                </View>
                <Badge label={sm?.label ?? r.status} color={sm?.color ?? colors.muted} bg={sm?.bg ?? colors.border} />
              </View>
              <View style={{ marginTop: 10 }}>
                {r.request_type === 'absence' && <Text style={{ color: colors.muted }}>Reason: {r.reason ?? '—'} · {formatDate(r.from_date)} – {formatDate(r.to_date)}</Text>}
                {r.request_type === 'late' && <Text style={{ color: colors.muted }}>Date: {formatDate(r.date)} · Expected: {r.expected_arrival_time ?? '—'}</Text>}
                {r.request_type === 'early_collection' && <Text style={{ color: colors.muted }}>Date: {formatDate(r.date)} · Leaving: {r.leaving_time ?? '—'} · Collected by: {r.collected_by ?? '—'}</Text>}
                {r.notes ? <Text style={{ color: colors.muted, marginTop: 4 }}>Notes: {r.notes}</Text> : null}
                {r.review_notes ? <Text style={{ color: colors.muted, marginTop: 4 }}>Review: {r.review_notes}</Text> : null}
              </View>
            </Card>
          );
        })}
      </ScrollView>

      <Modal visible={modal} animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Pressable onPress={() => setModal(false)}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>‹ Cancel</Text></Pressable>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink, marginLeft: 16 }}>{TYPE_META[formType].label}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Select label="Child" value={form.studentId} options={children.map((c) => ({ label: c.full_name, value: c.id }))} onSelect={(v) => setForm({ ...form, studentId: v })} />
            {formType === 'absence' && (
              <>
                <Select label="Reason" value={form.reason} options={ABSENCE_REASONS.map((r) => ({ label: r.charAt(0).toUpperCase() + r.slice(1).replace('_', ' '), value: r }))} onSelect={(v) => setForm({ ...form, reason: v })} />
                {form.reason === 'other' && <Field label="Custom reason" value={form.customReason} onChangeText={(v) => setForm({ ...form, customReason: v })} placeholder="Specify reason" />}
                <Field label="From date" value={form.fromDate} onChangeText={(v) => setForm({ ...form, fromDate: v })} placeholder="YYYY-MM-DD" />
                <Field label="To date" value={form.toDate} onChangeText={(v) => setForm({ ...form, toDate: v })} placeholder="YYYY-MM-DD" />
              </>
            )}
            {formType === 'late' && (
              <>
                <Field label="Date" value={form.date} onChangeText={(v) => setForm({ ...form, date: v })} placeholder="YYYY-MM-DD" />
                <Field label="Expected arrival time" value={form.arrivalTime} onChangeText={(v) => setForm({ ...form, arrivalTime: v })} placeholder="e.g. 10:00" />
              </>
            )}
            {formType === 'early_collection' && (
              <>
                <Field label="Date" value={form.date} onChangeText={(v) => setForm({ ...form, date: v })} placeholder="YYYY-MM-DD" />
                <Field label="Leaving time" value={form.leavingTime} onChangeText={(v) => setForm({ ...form, leavingTime: v })} placeholder="e.g. 14:00" />
                <Field label="Collected by" value={form.collectedBy} onChangeText={(v) => setForm({ ...form, collectedBy: v })} placeholder="Person collecting" />
              </>
            )}
            <Field label="Notes (optional)" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} placeholder="Additional notes…" multiline numberOfLines={2} />
            <Button label="Submit Request" onPress={submit} loading={saving} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
