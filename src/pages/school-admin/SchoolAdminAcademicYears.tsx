import { useState, useMemo, type FormEvent } from 'react';
import { CalendarDays, Plus, Pencil, Trash2, Archive, ArchiveRestore, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAcademic } from '@/context/AcademicContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { CardSkeleton, RowSkeleton } from '@/components/ui/Spinner';
import { formatDate, cn } from '@/lib/utils';
import type { AcademicYear, Term } from '@/types';

const SCHOOL_ID = '47e97532-69b5-4229-92ff-7c15b7135ac5';

interface YearFormState {
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

const emptyYearForm: YearFormState = { name: '', start_date: '', end_date: '', is_active: false };

interface TermFormState {
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

const emptyTermForm: TermFormState = { name: '', start_date: '', end_date: '', is_active: false };

export function SchoolAdminAcademicYears() {
  const { years, terms, loading, refresh } = useAcademic();
  const { toast } = useToast();

  const [yearModalOpen, setYearModalOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [yearForm, setYearForm] = useState<YearFormState>(emptyYearForm);
  const [savingYear, setSavingYear] = useState(false);

  const [expandedYear, setExpandedYear] = useState<string | null>(null);
  const [termModalOpen, setTermModalOpen] = useState(false);
  const [termParentYear, setTermParentYear] = useState<AcademicYear | null>(null);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [termForm, setTermForm] = useState<TermFormState>(emptyTermForm);
  const [savingTerm, setSavingTerm] = useState(false);

  const [deleteYearTarget, setDeleteYearTarget] = useState<AcademicYear | null>(null);
  const [deletingYear, setDeletingYear] = useState(false);
  const [deleteTermTarget, setDeleteTermTarget] = useState<Term | null>(null);
  const [deletingTerm, setDeletingTerm] = useState(false);

  const termsByYear = useMemo(() => {
    const map: Record<string, Term[]> = {};
    terms.forEach((t) => {
      if (!map[t.academic_year_id]) map[t.academic_year_id] = [];
      map[t.academic_year_id].push(t);
    });
    return map;
  }, [terms]);

  const openAddYear = () => {
    setEditingYear(null);
    setYearForm(emptyYearForm);
    setYearModalOpen(true);
  };

  const openEditYear = (y: AcademicYear) => {
    setEditingYear(y);
    setYearForm({
      name: y.name,
      start_date: y.start_date,
      end_date: y.end_date,
      is_active: y.is_active,
    });
    setYearModalOpen(true);
  };

  const submitYear = async (e: FormEvent) => {
    e.preventDefault();
    if (!yearForm.name.trim() || !yearForm.start_date || !yearForm.end_date) {
      toast('Name, start date, and end date are required', 'error');
      return;
    }
    if (new Date(yearForm.end_date) <= new Date(yearForm.start_date)) {
      toast('End date must be after start date', 'error');
      return;
    }

    setSavingYear(true);

    // If marking as active, deactivate other years
    if (yearForm.is_active) {
      await supabase.from('academic_years').update({ is_active: false }).eq('school_id', SCHOOL_ID).neq('id', editingYear?.id ?? '00000000-0000-0000-0000-000000000000');
    }

    const payload = {
      school_id: SCHOOL_ID,
      name: yearForm.name.trim(),
      start_date: yearForm.start_date,
      end_date: yearForm.end_date,
      is_active: yearForm.is_active,
    };

    if (editingYear) {
      const { error } = await supabase.from('academic_years').update(payload).eq('id', editingYear.id);
      if (error) {
        toast(error.message, 'error');
        setSavingYear(false);
        return;
      }
      toast('Academic year updated');
    } else {
      const { error } = await supabase.from('academic_years').insert(payload);
      if (error) {
        toast(error.message, 'error');
        setSavingYear(false);
        return;
      }
      toast('Academic year created');
    }

    setSavingYear(false);
    setYearModalOpen(false);
    refresh();
  };

  const archiveYear = async (y: AcademicYear) => {
    const { error } = await supabase.from('academic_years').update({ archived: !y.archived }).eq('id', y.id);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast(y.archived ? 'Academic year restored' : 'Academic year archived');
    refresh();
  };

  const confirmDeleteYear = async () => {
    if (!deleteYearTarget) return;
    setDeletingYear(true);
    // Delete terms first
    await supabase.from('terms').delete().eq('academic_year_id', deleteYearTarget.id);
    const { error } = await supabase.from('academic_years').delete().eq('id', deleteYearTarget.id);
    setDeletingYear(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast('Academic year deleted');
    setDeleteYearTarget(null);
    refresh();
  };

  const openAddTerm = (year: AcademicYear) => {
    setTermParentYear(year);
    setEditingTerm(null);
    setTermForm(emptyTermForm);
    setTermModalOpen(true);
  };

  const openEditTerm = (year: AcademicYear, t: Term) => {
    setTermParentYear(year);
    setEditingTerm(t);
    setTermForm({
      name: t.name,
      start_date: t.start_date,
      end_date: t.end_date,
      is_active: t.is_active,
    });
    setTermModalOpen(true);
  };

  const submitTerm = async (e: FormEvent) => {
    e.preventDefault();
    if (!termParentYear) return;
    if (!termForm.name.trim() || !termForm.start_date || !termForm.end_date) {
      toast('Name, start date, and end date are required', 'error');
      return;
    }

    setSavingTerm(true);

    if (termForm.is_active) {
      await supabase.from('terms').update({ is_active: false }).eq('school_id', SCHOOL_ID).eq('academic_year_id', termParentYear.id).neq('id', editingTerm?.id ?? '00000000-0000-0000-0000-000000000000');
    }

    const payload = {
      school_id: SCHOOL_ID,
      academic_year_id: termParentYear.id,
      name: termForm.name.trim(),
      start_date: termForm.start_date,
      end_date: termForm.end_date,
      is_active: termForm.is_active,
    };

    if (editingTerm) {
      const { error } = await supabase.from('terms').update(payload).eq('id', editingTerm.id);
      if (error) {
        toast(error.message, 'error');
        setSavingTerm(false);
        return;
      }
      toast('Term updated');
    } else {
      const { error } = await supabase.from('terms').insert(payload);
      if (error) {
        toast(error.message, 'error');
        setSavingTerm(false);
        return;
      }
      toast('Term created');
    }

    setSavingTerm(false);
    setTermModalOpen(false);
    refresh();
  };

  const confirmDeleteTerm = async () => {
    if (!deleteTermTarget) return;
    setDeletingTerm(true);
    const { error } = await supabase.from('terms').delete().eq('id', deleteTermTarget.id);
    setDeletingTerm(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast('Term deleted');
    setDeleteTermTarget(null);
    refresh();
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Academic Years" subtitle="Manage academic years and terms" icon={<CalendarDays className="h-6 w-6" />} action={<Button leftIcon={<Plus className="h-4 w-4" />}>Add Year</Button>} />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Academic Years"
        subtitle="Manage academic years and terms"
        icon={<CalendarDays className="h-6 w-6" />}
        action={<Button onClick={openAddYear} leftIcon={<Plus className="h-4 w-4" />}>Add Year</Button>}
      />

      {years.length === 0 ? (
        <Card>
          <EmptyState title="No academic years" description="Create your first academic year to get started." icon={<CalendarDays className="h-10 w-10" />} />
        </Card>
      ) : (
        <div className="space-y-4">
          {years.map((y) => {
            const yearTerms = termsByYear[y.id] ?? [];
            const isExpanded = expandedYear === y.id;
            return (
              <Card key={y.id} className={cn(y.archived && 'opacity-60')}>
                <CardHeader
                  title={y.name}
                  subtitle={`${formatDate(y.start_date)} — ${formatDate(y.end_date)}`}
                  action={
                    <div className="flex items-center gap-2">
                      {y.is_active && <Badge variant="success">Active</Badge>}
                      {y.archived && <Badge variant="secondary">Archived</Badge>}
                      <Button size="sm" variant="ghost" onClick={() => setExpandedYear(isExpanded ? null : y.id)} leftIcon={isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}>
                        {yearTerms.length} Terms
                      </Button>
                      <button onClick={() => archiveYear(y)} className="rounded-lg p-1.5 text-ink-muted hover:bg-slate-100 dark:hover:bg-slate-800" title={y.archived ? 'Restore' : 'Archive'}>
                        {y.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </button>
                      <button onClick={() => openEditYear(y)} className="rounded-lg p-1.5 text-ink-muted hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-800">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteYearTarget(y)} className="rounded-lg p-1.5 text-ink-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  }
                />

                {isExpanded && (
                  <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-ink dark:text-slate-100">Terms</h4>
                      <Button size="sm" variant="secondary" onClick={() => openAddTerm(y)} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add Term</Button>
                    </div>
                    {yearTerms.length === 0 ? (
                      <p className="text-sm text-ink-muted py-2">No terms created for this year.</p>
                    ) : (
                      <div className="space-y-2">
                        {yearTerms.map((t) => (
                          <div key={t.id} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="text-sm font-medium text-ink dark:text-slate-100">{t.name}</p>
                                <p className="text-xs text-ink-muted">{formatDate(t.start_date)} — {formatDate(t.end_date)}</p>
                              </div>
                              {t.is_active && <Badge variant="success">Active</Badge>}
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEditTerm(y, t)} className="rounded-lg p-1.5 text-ink-muted hover:bg-slate-100 hover:text-primary-600 dark:hover:bg-slate-700">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setDeleteTermTarget(t)} className="rounded-lg p-1.5 text-ink-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-700">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Year Modal */}
      <Modal
        open={yearModalOpen}
        onClose={() => setYearModalOpen(false)}
        title={editingYear ? 'Edit Academic Year' : 'Add Academic Year'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setYearModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="year-form" loading={savingYear}>{editingYear ? 'Save Changes' : 'Add Year'}</Button>
          </>
        }
      >
        <form id="year-form" onSubmit={submitYear} className="space-y-4">
          <Input label="Year Name *" required value={yearForm.name} onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })} placeholder="e.g. 2025-2026" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Start Date *" type="date" required value={yearForm.start_date} onChange={(e) => setYearForm({ ...yearForm, start_date: e.target.value })} />
            <Input label="End Date *" type="date" required value={yearForm.end_date} onChange={(e) => setYearForm({ ...yearForm, end_date: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={yearForm.is_active}
              onChange={(e) => setYearForm({ ...yearForm, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-ink dark:text-slate-100">Set as active academic year</span>
          </label>
        </form>
      </Modal>

      {/* Term Modal */}
      <Modal
        open={termModalOpen}
        onClose={() => setTermModalOpen(false)}
        title={editingTerm ? 'Edit Term' : 'Add Term'}
        description={termParentYear ? `For ${termParentYear.name}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTermModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="term-form" loading={savingTerm}>{editingTerm ? 'Save Changes' : 'Add Term'}</Button>
          </>
        }
      >
        <form id="term-form" onSubmit={submitTerm} className="space-y-4">
          <Input label="Term Name *" required value={termForm.name} onChange={(e) => setTermForm({ ...termForm, name: e.target.value })} placeholder="e.g. Term 1" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Start Date *" type="date" required value={termForm.start_date} onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })} />
            <Input label="End Date *" type="date" required value={termForm.end_date} onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={termForm.is_active}
              onChange={(e) => setTermForm({ ...termForm, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-ink dark:text-slate-100">Set as active term</span>
          </label>
        </form>
      </Modal>

      {/* Delete Year Modal */}
      <Modal
        open={!!deleteYearTarget}
        onClose={() => setDeleteYearTarget(null)}
        title="Delete Academic Year"
        description={`Delete ${deleteYearTarget?.name} and all its terms? This cannot be undone.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteYearTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deletingYear} onClick={confirmDeleteYear}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">All terms within this year will also be deleted.</p>
      </Modal>

      {/* Delete Term Modal */}
      <Modal
        open={!!deleteTermTarget}
        onClose={() => setDeleteTermTarget(null)}
        title="Delete Term"
        description={`Delete ${deleteTermTarget?.name}? This cannot be undone.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTermTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deletingTerm} onClick={confirmDeleteTerm}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">This will remove the term from the academic year.</p>
      </Modal>
    </div>
  );
}
