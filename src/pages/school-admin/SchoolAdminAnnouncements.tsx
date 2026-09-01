import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Megaphone, Plus, Pencil, Trash2, Search, Paperclip, X, FileText, File } from 'lucide-react';
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

interface Attachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

interface Announcement {
  id: string;
  school_id: string;
  author_id: string | null;
  title: string;
  body: string;
  audience: string;
  class_id: string | null;
  attachments: Attachment[] | null;
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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string) {
  if (type.startsWith('image/')) return <FileText className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
}

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

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    setAttachments([]);
    setModalOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({ title: a.title, body: a.body, audience: a.audience, class_id: a.class_id ?? '' });
    setAttachments(a.attachments ?? []);
    setModalOpen(true);
  };

  const needsClass = AUDIENCES_REQUIRING_CLASS.includes(form.audience);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast(`"${file.name}" exceeds the 10 MB limit`, 'error');
        return;
      }
    }

    setUploading(true);
    try {
      const uploaded: Attachment[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop() ?? 'file';
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const path = `${schoolId}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('announcement-attachments')
          .upload(path, file, { upsert: false });
        if (uploadError) {
          toast(`Failed to upload ${file.name}: ${uploadError.message}`, 'error');
          continue;
        }
        const { data: urlData } = supabase.storage
          .from('announcement-attachments')
          .getPublicUrl(path);
        uploaded.push({ name: file.name, url: urlData.publicUrl, size: file.size, type: file.type || ext });
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

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
      attachments: attachments.length > 0 ? attachments : [],
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

      // Send notifications to relevant users
      try {
        let targetUserIds: string[] = [];
        const audience = form.audience;

        if (audience === 'school' || audience === 'teachers' || audience === 'parents') {
          const roleFilter = audience === 'school' ? undefined : audience;
          let query = supabase.from('app_users').select('user_id').eq('school_id', schoolId).eq('active', true);
          if (roleFilter) query = query.eq('role', roleFilter);
          const { data: users } = await query;
          targetUserIds = (users ?? []).map((u: { user_id: string }) => u.user_id);
        } else if (audience === 'class' || audience === 'class_all') {
          // Get parents of students in this class
          const { data: students } = await supabase
            .from('students')
            .select('id')
            .eq('school_id', schoolId)
            .eq('class_id', form.class_id);
          const studentIds = (students ?? []).map((s: { id: string }) => s.id);

          if (studentIds.length > 0) {
            const { data: parentLinks } = await supabase
              .from('student_parents')
              .select('parent_user_id')
              .in('student_id', studentIds);
            targetUserIds = [...new Set((parentLinks ?? []).map((p: { parent_user_id: string }) => p.parent_user_id))];
          }

          if (audience === 'class_all') {
            // Also notify the class teacher
            const { data: cls } = await supabase
              .from('classes')
              .select('class_teacher_id')
              .eq('id', form.class_id)
              .maybeSingle();
            if (cls?.class_teacher_id) {
              const { data: teacher } = await supabase
                .from('app_users')
                .select('user_id')
                .eq('id', cls.class_teacher_id)
                .maybeSingle();
              if (teacher?.user_id) targetUserIds.push(teacher.user_id);
            }
          }
        }

        if (targetUserIds.length > 0) {
          const notifs = targetUserIds.map((uid) => ({
            school_id: schoolId,
            user_id: uid,
            type: 'announcement',
            title: `New Announcement: ${form.title.trim()}`,
            body: form.body.trim().slice(0, 100),
            link: '/parent',
          }));
          await supabase.from('notifications').insert(notifs);
        }
      } catch {
        // Non-critical: notification failure shouldn't block the announcement
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
          {a.attachments && a.attachments.length > 0 && (
            <div className="mt-1 flex items-center gap-1 text-xs text-primary-600 dark:text-primary-light">
              <Paperclip className="h-3 w-3" />
              <span>{a.attachments.length} attachment{a.attachments.length !== 1 ? 's' : ''}</span>
            </div>
          )}
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
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="announcement-form" loading={saving}>{editing ? 'Save Changes' : 'Publish'}</Button>
          </>
        }
      >
        <form id="announcement-form" onSubmit={submit} className="space-y-4">
          <Input label="Title *" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. School Closure Notice" />
          <Textarea label="Body *" required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write your announcement here…" className="min-h-[260px] text-sm leading-relaxed" />
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

          {/* Attachments */}
          <div>
            <label className="input-label">Attachments</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Paperclip className="h-4 w-4" />}
                loading={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                Attach File
              </Button>
              <span className="text-xs text-ink-muted">PDF, Word, Excel, images — up to 10 MB each</span>
            </div>

            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-light">
                      {fileIcon(att.type)}
                    </div>
                    <div className="min-w0 flex-1">
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-ink hover:text-primary-600 dark:text-slate-100">
                        {att.name}
                      </a>
                      <p className="text-xs text-ink-muted">{formatFileSize(att.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="rounded-lg p-1 text-ink-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
