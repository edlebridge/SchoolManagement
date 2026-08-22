import { useState, useEffect, type FormEvent } from 'react';
import { Megaphone, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
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

const SCHOOL_ID = 'ddccbf60-353f-40c5-a83f-3f8cf84eccfb';

interface Announcement {
  id: string;
  school_id: string;
  author_id: string | null;
  title: string;
  body: string;
  audience: string;
  created_at: string;
}

interface AnnouncementFormState {
  title: string;
  body: string;
  audience: string;
}

const emptyForm: AnnouncementFormState = { title: '', body: '', audience: 'all' };

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'Everyone',
  teachers: 'Teachers',
  parents: 'Parents',
};

const AUDIENCE_VARIANTS: Record<string, 'primary' | 'success' | 'warning' | 'secondary'> = {
  all: 'primary',
  teachers: 'success',
  parents: 'warning',
};

export function SchoolAdminAnnouncements() {
  const { profile } = useAuth();
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

  const load = () => {
    setLoading(true);
    supabase
      .from('announcements')
      .select('*')
      .eq('school_id', SCHOOL_ID)
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
    setForm({ title: a.title, body: a.body, audience: a.audience });
    setModalOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast('Title and body are required', 'error');
      return;
    }

    setSaving(true);
    const payload = {
      school_id: SCHOOL_ID,
      title: form.title.trim(),
      body: form.body.trim(),
      audience: form.audience,
      author_id: profile?.id ?? null,
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
      render: (a) => <Badge variant={AUDIENCE_VARIANTS[a.audience] ?? 'secondary'}>{AUDIENCE_LABELS[a.audience] ?? a.audience}</Badge>,
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
          <Select label="Audience" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
            <option value="all">Everyone</option>
            <option value="teachers">Teachers</option>
            <option value="parents">Parents</option>
          </Select>
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
