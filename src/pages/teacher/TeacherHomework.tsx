import { useMemo, useState, useEffect } from 'react';
import { BookOpen, Plus, Calendar, Trash2, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Spinner';
import { formatDate, relativeTime } from '@/lib/utils';
import type { Homework } from '@/types';

export function TeacherHomework() {
  const { profile } = useAuth();
  const { classes, classSubjects, subjects, loading } = useSchoolData();
  const { toast } = useToast();

  const [homework, setHomework] = useState<Homework[]>([]);
  const [homeworkLoading, setHomeworkLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    class_id: '',
    subject_id: '',
    due_date: '',
  });

  // My classes: class_teacher_id === profile.id OR class_subjects has teacher_id === profile.id
  const myClasses = useMemo(() => {
    if (!profile) return [];
    return classes.filter(
      (c) =>
        c.class_teacher_id === profile.id ||
        classSubjects.some((cs) => cs.class_id === c.id && cs.teacher_id === profile.id)
    );
  }, [classes, classSubjects, profile]);

  // Subjects available for selected class (via class_subjects where teacher_id === profile.id)
  const availableSubjects = useMemo(() => {
    if (!form.class_id || !profile) return [];
    const csForClass = classSubjects.filter(
      (cs) => cs.class_id === form.class_id && cs.teacher_id === profile.id
    );
    return subjects.filter((s) => csForClass.some((cs) => cs.subject_id === s.id));
  }, [form.class_id, classSubjects, subjects, profile]);

  // Load homework created by this teacher
  const loadHomework = async () => {
    if (!profile?.id) return;
    setHomeworkLoading(true);
    const { data } = await supabase
      .from('homework')
      .select('*')
      .eq('teacher_id', profile.id)
      .order('created_at', { ascending: false });
    setHomework((data as Homework[]) ?? []);
    setHomeworkLoading(false);
  };

  useEffect(() => {
    loadHomework();
  }, [profile?.id]);

  const openCreate = () => {
    setEditId(null);
    setForm({
      title: '',
      description: '',
      class_id: myClasses[0]?.id ?? '',
      subject_id: '',
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    setModalOpen(true);
  };

  const openEdit = (hw: Homework) => {
    setEditId(hw.id);
    setForm({
      title: hw.title,
      description: hw.description ?? '',
      class_id: hw.class_id,
      subject_id: hw.subject_id ?? '',
      due_date: hw.due_date?.split('T')[0] ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!profile?.id || !profile?.school_id) {
      toast('Missing profile information', 'error');
      return;
    }
    if (!form.title.trim() || !form.class_id || !form.due_date) {
      toast('Please fill in title, class, and due date', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        school_id: profile.school_id,
        teacher_id: profile.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        class_id: form.class_id,
        subject_id: form.subject_id || null,
        due_date: form.due_date,
      };

      if (editId) {
        const { error } = await supabase.from('homework').update(payload).eq('id', editId);
        if (error) throw error;
        toast('Homework updated successfully');
      } else {
        const { error } = await supabase.from('homework').insert(payload);
        if (error) throw error;
        toast('Homework assigned successfully');
      }
      setModalOpen(false);
      loadHomework();
    } catch {
      toast('Failed to save homework', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this homework?')) return;
    setDeleting(id);
    try {
      const { error } = await supabase.from('homework').delete().eq('id', id);
      if (error) throw error;
      toast('Homework deleted');
      loadHomework();
    } catch {
      toast('Failed to delete homework', 'error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Homework"
        subtitle="Assign and manage homework for your classes"
        icon={<BookOpen className="h-5 w-5" />}
        action={
          <Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
            Assign Homework
          </Button>
        }
      />

      {loading || homeworkLoading ? (
        <RowSkeleton rows={5} />
      ) : homework.length === 0 ? (
        <Card>
          <EmptyState
            title="No homework assigned"
            description="Click 'Assign Homework' to create your first homework assignment."
            icon={<BookOpen className="h-10 w-10" />}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {homework.map((hw) => {
            const cls = classes.find((c) => c.id === hw.class_id);
            const subj = subjects.find((s) => s.id === hw.subject_id);
            const isOverdue = new Date(hw.due_date) < new Date();
            return (
              <Card key={hw.id} hover>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-ink dark:text-slate-100">{hw.title}</p>
                      <p className="text-xs text-ink-muted">{cls?.name ?? '—'}</p>
                    </div>
                  </div>
                  <Badge variant={isOverdue ? 'error' : 'secondary'}>
                    {isOverdue ? 'Overdue' : 'Active'}
                  </Badge>
                </div>

                {hw.description && (
                  <p className="mt-3 text-sm text-ink-muted line-clamp-3">{hw.description}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {subj && <Badge variant="primary">{subj.name}</Badge>}
                  <Badge variant="secondary">
                    <Calendar className="mr-1 h-3 w-3" />
                    Due {formatDate(hw.due_date)}
                  </Badge>
                  <Badge variant="secondary">{relativeTime(hw.created_at)}</Badge>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(hw)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={deleting === hw.id}
                    leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => handleDelete(hw.id)}
                    className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Assign/Edit Homework Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Edit Homework' : 'Assign Homework'}
        description="Create a homework assignment for one of your classes"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editId ? 'Update' : 'Assign'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Title"
            placeholder="e.g. Chapter 5 Exercises"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />

          <Textarea
            label="Description"
            placeholder="Describe the homework assignment..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Class"
              value={form.class_id}
              onChange={(e) => setForm({ ...form, class_id: e.target.value, subject_id: '' })}
            >
              <option value="">Select a class</option>
              {myClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>

            <Select
              label="Subject"
              value={form.subject_id}
              onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
              disabled={!form.class_id}
            >
              <option value="">Select a subject</option>
              {availableSubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>

          <Input
            label="Due Date"
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
}
