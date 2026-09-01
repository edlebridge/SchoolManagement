import { useState, useEffect, type FormEvent } from 'react';
import { Megaphone, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Spinner';
import { relativeTime } from '@/lib/utils';

interface Announcement {
  id: string;
  school_id: string;
  author_id: string | null;
  title: string;
  body: string;
  audience: string;
  class_id: string | null;
  created_at: string;
}

interface AnnouncementFormState {
  title: string;
  body: string;
  audience: string;
  class_id: string;
}

const emptyForm: AnnouncementFormState = { title: '', body: '', audience: 'school', class_id: '' };

const AUDIENCE_LABELS: Record<string, string> = {
  school: 'Everyone',
  teachers: 'Teachers',
  parents: 'Parents',
  students: 'Students',
  class: 'Specific Class',
  class_all: 'Class (Students + Parents + Teacher)',
  staff: 'Staff',
  emergency: 'Emergency',
};

const AUDIENCE_VARIANTS: Record<string, 'primary' | 'success' | 'warning' | 'secondary' | 'error'> = {
  school: 'primary',
  teachers: 'success',
  parents: 'warning',
  students: 'secondary',
  class: 'secondary',
  class_all: 'primary',
  staff: 'secondary',
  emergency: 'error',
};

const AUDIENCES_REQUIRING_CLASS = ['class', 'class_all'];

export function SchoolAdminAnnouncements() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? '';
  const { classes, loading: schoolDataLoading } = useSchoolData();
  const { toast } = useToast();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<AnnouncementFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const classNameMap = useState(() => {
    const map: Record<string, string> = {};
    classes.forEach((c) => { map[c.id] = c.name; });
    return map;
  })[0];

  const load = () => {
    setLoading(true);
    supabase
      .from('announcements')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast(error.message, 'error');
          setAnnouncements([]);
        } else {
          setAnnouncements((data as Announcement[]) ?? []);
        }
        setLoading(false);
      });
  };

  useEffect(() => { load(); }, []);

  const filteredAnnouncements = search.trim()
    ? announcements.filter((a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.body.toLowerCase().includes(search.toLowerCase()) ||
      a.audience.toLowerCase().includes(search.toLowerCase())
    )
    : announcements;

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({ title: a.title, body: a.body, audience: a.audience, class_id: a.class_id ?? '' });
    setModalOpen(true);
  };

  const needsClass = AUDIENCES_REQUIRING_CLASS.includes(form.audience);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast('Title and body are required', 'error');
      return;
    }
    if (needsClass && !form.class_id) {
      toast('Please select a class for this audience', 'error');
      return;
    }

    setSaving(true);
    const payload = {
      school_id: schoolId,
      title: form.title.trim(),
      body: form.body.trim(),
      audience: form.audience,
      class_id: needsClass ? form.class_id : null,
      author_id: profile?.user_id ?? null,
    };

    if (editing) {
      const { error } = await supabase.from('announcements').update(payload).eq('id', editing.id);
      if (error) {
        toast(error.message, 'error');
        setSaving(false);
        return;
      }
      toast('Announcement updated');
    } else {
      const { error } = await supabase.from('announcements').insert(payload);
      if (error) {
        toast(error.message, 'error');
        setSaving(false);
        return;
      }
      toast('Announcement published');
    }

    setSaving(false);
    setModalOpen(false);
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('announcements').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast('Announcement deleted');
    setDeleteTarget(null);
    load();
  };

  const columns: Column<Announcement>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (a) => (
        <div className="max-w-md">
          <p className="font-medium text-ink dark:text-slate-100">{a.title}</p>
          <p className="text-xs text-ink-muted truncate">{a.body}</p>
        </div>
      ),
    },
    {
      key: 'audience',
      header: 'Audience',
      render: (a) => {
        const label = AUDIENCE_LABELS[a.audience] ?? a.audience;
        const classPart = a.class_id ? ` · ${classNameMap[a.class_id] ?? 'Class'}` : '';
        return <Badge variant={AUDIENCE_VARIANTS[a.audience] ?? 'secondary'}>{label}{classPart}</Badge>;
      },
    },
    {
      key: 'created_at',
      header: 'Posted',
      render: (a) => <span className="text-ink-muted text-xs">{relativeTime(a.created_at)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (a) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(a)} className="rounded-lg p-1.5 text-ink-muted hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setDeleteTarget(a)} className="rounded-lg p-1.5 text-ink-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="Post announcements to your school community"
        icon={<Megaphone className="h-6 w-6" />}
        action={<Button onClick={openAdd} leftIcon={<Plus className="h-4 w-4" />}>New Announcement</Button>}
      />

      <Card>
        <div className="mb-4 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input
            className="input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search announcements…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <RowSkeleton rows={5} />
        ) : filteredAnnouncements.length === 0 ? (
          <EmptyState title="No announcements" description={search ? 'Try adjusting your search.' : 'Click "New Announcement" to post your first announcement.'} icon={<Megaphone className="h-10 w-10" />} />
        ) : (
          <DataTable columns={columns} data={filteredAnnouncements} rowKey={(a) => a.id} />
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Announcement' : 'New Announcement'}
        description={editing ? `Editing "${editing.title}"` : 'Post a new announcement'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="announcement-form" loading={saving}>{editing ? 'Save Changes' : 'Publish'}</Button>
          </>
        }
      >
        <form id="announcement-form" onSubmit={submit} className="space-y-4">
          <Input label="Title *" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. School Closure Notice" />
          <Textarea label="Body *" required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write your announcement here…" className="min-h-[120px]" />
          <Select label="Audience" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value, class_id: '' })}>
            <option value="school">Everyone</option>
            <option value="teachers">Teachers only</option>
            <option value="parents">Parents only</option>
            <option value="students">Students only</option>
            <option value="class">A specific class</option>
            <option value="class_all">A specific class (Students + Parents + Class Teacher)</option>
          </Select>
          {needsClass && (
            <Select
              label="Class *"
              required
              value={form.class_id}
              onChange={(e) => setForm({ ...form, class_id: e.target.value })}
              disabled={schoolDataLoading}
            >
              <option value="">Select a class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          )}
          {needsClass && form.class_id && form.audience === 'class_all' && (
            <div className="rounded-lg bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/20 p-3">
              <p className="text-sm text-primary-700 dark:text-primary-light">
                This announcement will be visible to all students, parents, and the class teacher of <strong>{classNameMap[form.class_id] ?? 'this class'}</strong>.
              </p>
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Announcement"
        description={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">This announcement will be permanently removed.</p>
      </Modal>
    </div>
  );
}
