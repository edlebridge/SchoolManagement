import { useState, useMemo, type FormEvent } from 'react';
import { BookOpen, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSchoolData } from '@/hooks/useSchoolData';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Spinner';
import type { ClassRow, AppUser } from '@/types';

const SCHOOL_ID = 'ddccbf60-353f-40c5-a83f-3f8cf84eccfb';

interface ClassFormState {
  name: string;
  grade_level: string;
  stream: string;
  class_teacher_id: string;
  capacity: string;
}

const emptyForm: ClassFormState = {
  name: '',
  grade_level: '',
  stream: '',
  class_teacher_id: '',
  capacity: '',
};

export function SchoolAdminClasses() {
  const { classes, teachers, students, loading, refresh } = useSchoolData();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [form, setForm] = useState<ClassFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const teacherMap = useMemo(() => {
    const map: Record<string, AppUser> = {};
    teachers.forEach((t) => { map[t.id] = t; });
    return map;
  }, [teachers]);

  const studentCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    students.forEach((s) => {
      if (s.class_id) map[s.class_id] = (map[s.class_id] ?? 0) + 1;
    });
    return map;
  }, [students]);

  const filtered = useMemo(() => {
    if (!search.trim()) return classes;
    const q = search.toLowerCase();
    return classes.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.grade_level ?? '').toLowerCase().includes(q) ||
      (c.stream ?? '').toLowerCase().includes(q)
    );
  }, [classes, search]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (c: ClassRow) => {
    setEditing(c);
    setForm({
      name: c.name,
      grade_level: c.grade_level ?? '',
      stream: c.stream ?? '',
      class_teacher_id: c.class_teacher_id ?? '',
      capacity: c.capacity?.toString() ?? '',
    });
    setModalOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast('Class name is required', 'error');
      return;
    }

    setSaving(true);
    const payload = {
      school_id: SCHOOL_ID,
      name: form.name.trim(),
      grade_level: form.grade_level || null,
      stream: form.stream || null,
      class_teacher_id: form.class_teacher_id || null,
      capacity: form.capacity ? parseInt(form.capacity, 10) : null,
    };

    if (editing) {
      const { error } = await supabase.from('classes').update(payload).eq('id', editing.id);
      if (error) {
        toast(error.message, 'error');
        setSaving(false);
        return;
      }
      toast('Class updated successfully');
    } else {
      const { error } = await supabase.from('classes').insert(payload);
      if (error) {
        toast(error.message, 'error');
        setSaving(false);
        return;
      }
      toast('Class created successfully');
    }

    setSaving(false);
    setModalOpen(false);
    refresh();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('classes').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast('Class deleted');
    setDeleteTarget(null);
    refresh();
  };

  const columns: Column<ClassRow>[] = [
    {
      key: 'name',
      header: 'Class',
      render: (c) => (
        <div>
          <p className="font-medium text-ink dark:text-slate-100">{c.name}</p>
          <p className="text-xs text-ink-muted">{c.grade_level ?? '—'} {c.stream ? `· ${c.stream}` : ''}</p>
        </div>
      ),
    },
    {
      key: 'class_teacher',
      header: 'Class Teacher',
      render: (c) => {
        const teacher = c.class_teacher_id ? teacherMap[c.class_teacher_id] : null;
        return <span className="text-ink-soft dark:text-slate-300">{teacher?.full_name ?? '—'}</span>;
      },
    },
    {
      key: 'capacity',
      header: 'Capacity',
      render: (c) => {
        const count = studentCountMap[c.id] ?? 0;
        return (
          <span className="text-ink-soft dark:text-slate-300">
            {count} / {c.capacity ?? '∞'}
          </span>
        );
      },
    },
    {
      key: 'stream',
      header: 'Stream',
      render: (c) => c.stream ? <Badge variant="secondary">{c.stream}</Badge> : <span className="text-ink-muted">—</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-ink-muted hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setDeleteTarget(c)} className="rounded-lg p-1.5 text-ink-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Classes"
        subtitle="Manage classes and assign teachers"
        icon={<BookOpen className="h-6 w-6" />}
        action={<Button onClick={openAdd} leftIcon={<Plus className="h-4 w-4" />}>Add Class</Button>}
      />

      <Card>
        <div className="mb-4 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input
            className="input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search by name, grade, stream…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <RowSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No classes found" description={search ? 'Try adjusting your search.' : 'Click "Add Class" to create your first class.'} icon={<BookOpen className="h-10 w-10" />} />
        ) : (
          <DataTable columns={columns} data={filtered} rowKey={(c) => c.id} />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Class' : 'Add Class'}
        description={editing ? `Editing ${editing.name}` : 'Create a new class'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="class-form" loading={saving}>{editing ? 'Save Changes' : 'Add Class'}</Button>
          </>
        }
      >
        <form id="class-form" onSubmit={submit} className="space-y-4">
          <Input label="Class Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Grade 5A" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Grade Level" value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })} placeholder="e.g. Grade 5" />
            <Input label="Stream" value={form.stream} onChange={(e) => setForm({ ...form, stream: e.target.value })} placeholder="e.g. A" />
            <Input label="Capacity" type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="e.g. 30" />
            <Select label="Class Teacher" value={form.class_teacher_id} onChange={(e) => setForm({ ...form, class_teacher_id: e.target.value })}>
              <option value="">Select teacher</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </Select>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Class"
        description={`Are you sure you want to delete ${deleteTarget?.name}? Students in this class will become unassigned.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">This action cannot be undone.</p>
      </Modal>
    </div>
  );
}
