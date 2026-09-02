import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { BookOpen, Plus, Trash2, Pencil, Calendar } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { supabase } from '@/lib/supabase';
import type { Homework as HW } from '@/lib/types';
import { Card, Empty, Loading, Button, Field, Badge, Select } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';

export default function TeacherHomework() {
  const { profile } = useAuth();
  const { colors, styles } = useTheme();
  const { classes, subjects, classSubjects, loading } = useSchoolData();
  const [items, setItems] = useState<HW[]>([]);
  const [fetching, setFetching] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState({ title: '', description: '', class_id: '', subject_id: '', due_date: '' });
  const [saving, setSaving] = useState(false);

  const myClassIds = useMemo(() => {
    if (!profile?.id) return [];
    return classes.filter((c) => c.class_teacher_id === profile.id || classSubjects.some((cs) => cs.class_id === c.id && cs.teacher_id === profile.id)).map((c) => c.id);
  }, [classes, classSubjects, profile?.id]);

  const load = async () => {
    if (!profile?.id) return;
    setFetching(true);
    const { data } = await supabase.from('homework').select('*').eq('teacher_id', profile.id).order('created_at', { ascending: false });
    setItems((data as HW[]) ?? []);
    setFetching(false);
  };

  useEffect(() => { load(); }, [profile?.id]);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const availableSubjects = useMemo(() => {
    if (!form.class_id || !profile?.id) return [];
    return subjects.filter((s) => classSubjects.some((cs) => cs.class_id === form.class_id && cs.subject_id === s.id && cs.teacher_id === profile.id));
  }, [form.class_id, subjects, classSubjects, profile?.id]);

  const openCreate = () => { setEditId(''); setForm({ title: '', description: '', class_id: '', subject_id: '', due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) }); setModal(true); };
  const openEdit = (h: HW) => { setEditId(h.id); setForm({ title: h.title, description: h.description ?? '', class_id: h.class_id, subject_id: h.subject_id ?? '', due_date: h.due_date?.slice(0, 10) ?? '' }); setModal(true); };

  const save = async () => {
    if (!form.title.trim() || !form.class_id || !profile?.id || !profile.school_id) return;
    setSaving(true);
    const payload = { school_id: profile.school_id, teacher_id: profile.id, title: form.title.trim(), description: form.description.trim() || null, class_id: form.class_id, subject_id: form.subject_id || null, due_date: form.due_date };
    if (editId) { await supabase.from('homework').update(payload).eq('id', editId); } else { await supabase.from('homework').insert(payload); }
    setSaving(false); setModal(false); load();
  };

  const del = (id: string) => {
    if (!profile) return;
    supabase.from('homework').delete().eq('id', id).then(() => load());
  };

  if (loading || fetching) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Teaching workspace</Text>
        <Text style={styles.title}>Homework</Text>
        <Text style={styles.subtitle}>{items.length} assignments</Text>
        <Pressable onPress={openCreate} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 13, marginTop: 16, marginBottom: 8 }}>
          <Plus color="#fff" size={20} /><Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>Assign Homework</Text>
        </Pressable>
        {!items.length ? <Card><Empty title="No homework yet" body="Tap 'Assign Homework' to create your first assignment." /></Card> : items.map((h) => {
          const isOverdue = new Date(h.due_date) < new Date();
          return (
            <Card key={h.id}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 }}>{h.title}</Text>
                  <Text style={{ color: colors.muted, marginTop: 4 }}>{classMap.get(h.class_id)?.name ?? 'Class'} · {subjectMap.get(h.subject_id ?? '')?.name ?? 'General'}</Text>
                </View>
                <Badge label={isOverdue ? 'Overdue' : 'Active'} color={isOverdue ? colors.error : colors.success} bg={isOverdue ? colors.errorSoft : colors.successSoft} />
              </View>
              {h.description ? <Text style={{ color: colors.muted, lineHeight: 20, marginTop: 10 }}>{h.description}</Text> : null}
              <View style={[styles.row, { marginTop: 10 }]}>
                <Calendar color={colors.muted} size={15} /><Text style={{ color: colors.muted, marginLeft: 6 }}>Due {formatDate(h.due_date)} · {relativeTime(h.created_at)}</Text>
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => openEdit(h)} style={{ marginRight: 12 }}><Pencil color={colors.primary} size={18} /></Pressable>
                <Pressable onPress={() => del(h.id)}><Trash2 color={colors.error} size={18} /></Pressable>
              </View>
            </Card>
          );
        })}
      </ScrollView>
      <Modal visible={modal} animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Pressable onPress={() => setModal(false)}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>‹ Cancel</Text></Pressable>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink, marginLeft: 16 }}>{editId ? 'Edit Homework' : 'Assign Homework'}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Field label="Title" value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} placeholder="Homework title" />
            <Field label="Description" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="Instructions…" multiline numberOfLines={3} />
            <Select label="Class" value={form.class_id} options={classes.filter((c) => myClassIds.includes(c.id)).map((c) => ({ label: c.name, value: c.id }))} onSelect={(v) => setForm({ ...form, class_id: v, subject_id: '' })} />
            {availableSubjects.length > 0 && <Select label="Subject" value={form.subject_id} options={availableSubjects.map((s) => ({ label: s.name, value: s.id }))} onSelect={(v) => setForm({ ...form, subject_id: v })} />}
            <Field label="Due Date" value={form.due_date} onChangeText={(v) => setForm({ ...form, due_date: v })} placeholder="YYYY-MM-DD" />
            <Button label={editId ? 'Update' : 'Assign'} onPress={save} loading={saving} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
