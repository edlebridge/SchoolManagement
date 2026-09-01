import { useState, useEffect, useCallback } from 'react';
import { CalendarCheck, Plus, Clock, DoorOpen, FileText, X, Check, Circle as XCircle, CircleCheck as CheckCircle, Clock3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useParent } from '@/context/ParentContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatDate } from '@/lib/utils';
import type { ParentAttendanceRequest, AttendanceRequestType, AttendanceRequestStatus } from '@/types';

type FormType = AttendanceRequestType | null;

const REQUEST_TYPE_META: Record<AttendanceRequestType, { label: string; icon: typeof Clock; color: string }> = {
  absence: { label: 'Report Absence', icon: FileText, color: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400' },
  late: { label: 'Report Late', icon: Clock3, color: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' },
  early_collection: { label: 'Collected Early', icon: DoorOpen, color: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400' },
};

const STATUS_META: Record<AttendanceRequestStatus, { label: string; variant: 'warning' | 'success' | 'error' | 'primary' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'error' },
  acknowledged: { label: 'Acknowledged', variant: 'primary' },
};

const ABSENCE_REASONS = [
  { value: 'holiday', label: 'Holiday' },
  { value: 'illness', label: 'Illness' },
  { value: 'urgent_family', label: 'Urgent Family Reason' },
  { value: 'other', label: 'Other' },
];

export function ParentAttendanceRequests() {
  const { profile } = useAuth();
  const { children, selectedChild, selectedChildClass, loading: childrenLoading, selectChild } = useParent();
  const { toast } = useToast();

  const [requests, setRequests] = useState<ParentAttendanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formType, setFormType] = useState<FormType>(null);
  const [saving, setSaving] = useState(false);
  const [childMenuOpen, setChildMenuOpen] = useState(false);

  // Form state
  const [selectedChildId, setSelectedChildId] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [date, setDate] = useState('');
  const [expectedArrivalTime, setExpectedArrivalTime] = useState('');
  const [leavingTime, setLeavingTime] = useState('');
  const [collectedBy, setCollectedBy] = useState('');
  const [notes, setNotes] = useState('');

  const loadRequests = useCallback(async () => {
    if (!profile?.user_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('parent_attendance_requests')
      .select('*')
      .eq('parent_user_id', profile.user_id)
      .order('created_at', { ascending: false });
    if (error) {
      toast(error.message, 'error');
      setRequests([]);
    } else {
      setRequests((data as ParentAttendanceRequest[]) ?? []);
    }
    setLoading(false);
  }, [profile?.user_id, toast]);

  useEffect(() => {
    loadRequests();
    if (!profile?.user_id) return;
    const channel = supabase
      .channel('parent-attendance-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parent_attendance_requests', filter: `parent_user_id=eq.${profile.user_id}` },
        () => loadRequests()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadRequests, profile?.user_id]);

  const resetForm = () => {
    setSelectedChildId('');
    setReason('');
    setCustomReason('');
    setFromDate('');
    setToDate('');
    setDate('');
    setExpectedArrivalTime('');
    setLeavingTime('');
    setCollectedBy('');
    setNotes('');
  };

  const openModal = (type: AttendanceRequestType) => {
    setFormType(type);
    resetForm();
    if (selectedChild) setSelectedChildId(selectedChild.id);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormType(null);
    resetForm();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.user_id || !profile?.school_id) return;
    if (!selectedChildId) {
      toast('Please select a child', 'error');
      return;
    }

    const child = children.find((c) => c.id === selectedChildId);
    if (!child) {
      toast('Please select a valid child', 'error');
      return;
    }

    setSaving(true);

    const basePayload = {
      school_id: profile.school_id,
      parent_user_id: profile.user_id,
      student_id: selectedChildId,
      class_id: child.class_id ?? null,
      request_type: formType,
      notes: notes.trim() || null,
    };

    let payload: Record<string, unknown> = { ...basePayload };

    if (formType === 'absence') {
      if (!fromDate || !toDate) {
        toast('Please select absence dates', 'error');
        setSaving(false);
        return;
      }
      if (!reason) {
        toast('Please select a reason', 'error');
        setSaving(false);
        return;
      }
      payload = {
        ...basePayload,
        reason,
        custom_reason: reason === 'other' ? customReason.trim() || null : null,
        from_date: fromDate,
        to_date: toDate,
      };
    } else if (formType === 'late') {
      if (!date) {
        toast('Please select a date', 'error');
        setSaving(false);
        return;
      }
      if (!expectedArrivalTime) {
        toast('Please enter expected arrival time', 'error');
        setSaving(false);
        return;
      }
      payload = {
        ...basePayload,
        date,
        expected_arrival_time: expectedArrivalTime,
      };
    } else if (formType === 'early_collection') {
      if (!date) {
        toast('Please select a date', 'error');
        setSaving(false);
        return;
      }
      if (!leavingTime) {
        toast('Please enter leaving time', 'error');
        setSaving(false);
        return;
      }
      payload = {
        ...basePayload,
        date,
        leaving_time: leavingTime,
        collected_by: collectedBy.trim() || null,
      };
    }

    const { error } = await supabase.from('parent_attendance_requests').insert(payload);

    if (error) {
      toast(error.message, 'error');
      setSaving(false);
      return;
    }

    // Create notifications for school admins and class teacher
    const childName = child.full_name;
    const typeLabel = REQUEST_TYPE_META[formType!].label;
    const notifTitle = `${typeLabel}: ${childName}`;
    const notifBody = notes.trim() || null;

    // Find school admins for this school
    const { data: admins } = await supabase
      .from('app_users')
      .select('user_id')
      .eq('school_id', profile.school_id)
      .eq('role', 'school_admin')
      .eq('active', true);

    const notifications: { school_id: string; user_id: string; type: string; title: string; body: string | null; link: string | null }[] = [];

    (admins ?? []).forEach((a: { user_id: string }) => {
      notifications.push({
        school_id: profile.school_id!,
        user_id: a.user_id,
        type: 'attendance_request',
        title: notifTitle,
        body: notifBody,
        link: '/school-admin',
      });
    });

    // Find class teacher
    if (child.class_id) {
      const { data: cls } = await supabase
        .from('classes')
        .select('class_teacher_id')
        .eq('id', child.class_id)
        .maybeSingle();

      if (cls?.class_teacher_id) {
        const { data: teacher } = await supabase
          .from('app_users')
          .select('user_id')
          .eq('id', cls.class_teacher_id)
          .maybeSingle();
        if (teacher?.user_id) {
          notifications.push({
            school_id: profile.school_id!,
            user_id: teacher.user_id,
            type: 'attendance_request',
            title: notifTitle,
            body: notifBody,
            link: '/teacher',
          });
        }
      }
    }

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }

    toast('Request submitted successfully');
    setSaving(false);
    closeModal();
    loadRequests();
  };

  const childNameMap = useCallback(() => {
    const map: Record<string, string> = {};
    children.forEach((c) => { map[c.id] = c.full_name; });
    return map;
  }, [children]);

  if (childrenLoading) {
    return (
      <div>
        <PageHeader title="Attendance Requests" subtitle="Report absences, late arrivals, and early collections" icon={<CalendarCheck className="h-5 w-5" />} />
        <Card><RowSkeleton rows={5} /></Card>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div>
        <PageHeader title="Attendance Requests" subtitle="Report absences, late arrivals, and early collections" icon={<CalendarCheck className="h-5 w-5" />} />
        <Card>
          <EmptyState title="No children linked" description="No student records are linked to your account. Please contact the school administrator." icon={<CalendarCheck className="h-10 w-10" />} />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Attendance Requests"
        subtitle="Report absences, late arrivals, and early collections"
        icon={<CalendarCheck className="h-5 w-5" />}
        action={
          children.length > 1 ? (
            <div className="relative">
              <button
                onClick={() => setChildMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <Avatar name={selectedChild?.full_name ?? ''} src={selectedChild?.photo_url} size="xs" />
                <span className="max-w-[120px] truncate">{selectedChild?.full_name}</span>
              </button>
              {childMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setChildMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-100 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => { selectChild(child.id); setChildMenuOpen(false); }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors',
                          selectedChild?.id === child.id ? 'bg-primary-50 dark:bg-primary-500/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        )}
                      >
                        <Avatar name={child.full_name} src={child.photo_url} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink dark:text-slate-100">{child.full_name}</p>
                          <p className="text-xs text-ink-muted">{child.admission_number}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : undefined
        }
      />

      {/* Action Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(Object.keys(REQUEST_TYPE_META) as AttendanceRequestType[]).map((type) => {
          const meta = REQUEST_TYPE_META[type];
          const Icon = meta.icon;
          return (
            <Card key={type}>
              <button onClick={() => openModal(type)} className="flex w-full items-center gap-3 text-left">
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', meta.color)}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-ink dark:text-slate-100">{meta.label}</p>
                  <p className="text-xs text-ink-muted">Click to submit</p>
                </div>
                <Plus className="h-4 w-4 text-ink-muted" />
              </button>
            </Card>
          );
        })}
      </div>

      {/* Submitted Requests */}
      <Card className="mt-6">
        <CardHeader title="My Requests" subtitle="Track the status of your submitted requests" />
        {loading ? (
          <RowSkeleton rows={5} />
        ) : requests.length === 0 ? (
          <EmptyState title="No requests submitted" description="You haven't submitted any attendance requests yet." icon={<CalendarCheck className="h-10 w-10" />} />
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const meta = REQUEST_TYPE_META[req.request_type];
              const Icon = meta.icon;
              const status = STATUS_META[req.status];
              const nameMap = childNameMap();
              return (
                <div key={req.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', meta.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-ink dark:text-slate-100">{meta.label}</p>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="text-xs text-ink-muted">
                      {req.student_id ? (nameMap[req.student_id] ?? 'Unknown child') : 'Unknown child'}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-muted">
                      {req.request_type === 'absence' && (
                        <>
                          <span>Reason: {req.reason === 'other' ? req.custom_reason : ABSENCE_REASONS.find((r) => r.value === req.reason)?.label ?? req.reason}</span>
                          <span>From: {formatDate(req.from_date)}</span>
                          <span>To: {formatDate(req.to_date)}</span>
                        </>
                      )}
                      {req.request_type === 'late' && (
                        <>
                          <span>Date: {formatDate(req.date)}</span>
                          <span>Expected arrival: {req.expected_arrival_time}</span>
                        </>
                      )}
                      {req.request_type === 'early_collection' && (
                        <>
                          <span>Date: {formatDate(req.date)}</span>
                          <span>Leaving: {req.leaving_time}</span>
                          {req.collected_by && <span>Collected by: {req.collected_by}</span>}
                        </>
                      )}
                    </div>
                    {req.notes && <p className="mt-1 text-xs text-ink-muted">Notes: {req.notes}</p>}
                    {req.review_notes && (
                      <p className="mt-1 text-xs text-primary-600 dark:text-primary-light">
                        School response: {req.review_notes}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-ink-muted">Submitted: {formatDate(req.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={formType ? REQUEST_TYPE_META[formType].label : ''}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" form="attendance-request-form" loading={saving}>Submit Request</Button>
          </>
        }
      >
        <form id="attendance-request-form" onSubmit={submit} className="space-y-4">
          <Select label="Select Child *" required value={selectedChildId} onChange={(e) => setSelectedChildId(e.target.value)}>
            <option value="">Select a child…</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>{child.full_name}</option>
            ))}
          </Select>

          {formType === 'absence' && (
            <>
              <Select label="Reason *" required value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Select a reason…</option>
                {ABSENCE_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Select>
              {reason === 'other' && (
                <Input label="Custom Reason *" required value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="Specify the reason" />
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Absent From *" type="date" required value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                <Input label="Absent To *" type="date" required value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </>
          )}

          {formType === 'late' && (
            <>
              <Input label="Date *" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              <Input label="Expected Arrival Time *" type="time" required value={expectedArrivalTime} onChange={(e) => setExpectedArrivalTime(e.target.value)} />
            </>
          )}

          {formType === 'early_collection' && (
            <>
              <Input label="Date *" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              <Input label="Leaving Time *" type="time" required value={leavingTime} onChange={(e) => setLeavingTime(e.target.value)} />
              <Input label="Collected By" value={collectedBy} onChange={(e) => setCollectedBy(e.target.value)} placeholder="Name of person collecting the child" />
            </>
          )}

          <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes for the school…" />
        </form>
      </Modal>
    </div>
  );
}
