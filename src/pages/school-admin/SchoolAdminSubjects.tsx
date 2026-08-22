import { useState, useMemo, type FormEvent } from 'react';
import { BookCopy, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSchoolData } from '@/hooks/useSchoolData';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Spinner';
import type { Subject } from '@/types';

const SCHOOL_ID = 'ddccbf60-353f-40c5-a83f-3f8cf84eccfb';

interface SubjectFormState {
  name: string;
  code: string;
}

const emptyForm: SubjectFormState = { name: '', code: '' };

export function SchoolAdminSubjects() {
  const { subjects, classSubjects, loading, refresh } = useSchoolData();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState<SubjectFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState(false);

  const usageMap = useMemo(() => {
    const map: Record<string, number> = {};
    classSubjects.forEach((cs) => {
      map[cs.subject_id] = (map[cs.subject_id] ?? 0) + 1;
    });
    return map;
  }, [classSubjects]);

  const filtered = useMemo(() => {
    if (!search.trim()) return subjects;
    const q = search.toLowerCase();
    return subjects.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.code ?? '').toLowerCase().includes(q)
    );
  }, [subjects, search]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (s: Subject) => {
    setEditing(s);
    setForm({ name: s.name, code: s.code ?? '' });
    setModalOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast('Subject name is required', 'error');
      return;
    }

    setSaving(true);
    const payload = {
      school_id: SCHOOL_ID,
      name: form.name.trim(),
      code: form.code.trim() || null,
    };

    if (editing) {
      const { error } = await supabase.from('subjects').update(payload).eq('id', editing.id);
      if (error) {
        toast(error.message, 'error');
        setSaving(false);
        return;
      }
      toast('Subject updated successfully');
    } else {
      const { error } = await supabase.from('subjects').insert(payload);
      if (error) {
        toast(error.message, 'error');
        setSaving(false);
        return;
      }
      toast('Subject created successfully');
    }

    setSaving(false);
    setModalOpen(false);
    refresh();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Remove class_subjects referencing this subject
    await supabase.from('class_subjects').delete().eq('subject_id', deleteTarget.id);
    const { error } = await supabase.from('subjects').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast('Subject deleted');
    setDeleteTarget(null);
    refresh();
  };

  const columns: Column<Subject>[] = [
    {
      key: 'name',
      header: 'Subject',
      render: (s) => (
        <div>
          <p className="font-medium text-ink dark:text-slate-100">{s.name}</p>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      render: (s) => s.code ? <Badge variant="primary">{s.code}</Badge> : <span className="text-ink-muted">—</span>,
    },
    {
      key: 'usage',
      header: 'Class Assignments',
      render: (s) => <span className="text-ink-soft dark:text-slate-300">{usageMap[s.id] ?? 0} class(es)</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (s) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 text-ink-muted hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setDeleteTarget(s)} className="rounded-lg p-1.5 text-ink-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Subjects"
        subtitle="Manage subjects offered at your school"
        icon={<BookCopy className="h-6 w-6" />}
        action={<Button onClick={openAdd} leftIcon={<Plus className="h-4 w-4" />}>Add Subject</Button>}
      />

      <Card>
        <div className="mb-4 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input
            className="input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search by name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <RowSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No subjects found" description={search ? 'Try adjusting your search.' : 'Click "Add Subject" to create your first subject.'} icon={<BookCopy className="h-10 w-10" />} />
        ) : (
          <DataTable columns={columns} data={filtered} rowKey={(s) => s.id} />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Subject' : 'Add Subject'}
        description={editing ? `Editing ${editing.name}` : 'Create a new subject'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="subject-form" loading={saving}>{editing ? 'Save Changes' : 'Add Subject'}</Button>
          </>
        }
      >
        <form id="subject-form" onSubmit={submit} className="space-y-4">
          <Input label="Subject Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mathematics" />
          <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. MATH" />
        </form>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Subject"
        description={`Are you sure you want to delete ${deleteTarget?.name}? All class assignments for this subject will also be removed.`}
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
