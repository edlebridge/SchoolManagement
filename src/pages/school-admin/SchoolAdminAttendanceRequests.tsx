import { useState, useEffect, useCallback } from 'react';
import { CalendarCheck, Check, X, Clock3, DoorOpen, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useSchoolData } from '@/hooks/useSchoolData';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { RowSkeleton } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatDate, relativeTime } from '@/lib/utils';
import type { ParentAttendanceRequest, AttendanceRequestType, AttendanceRequestStatus } from '@/types';

const REQUEST_TYPE_META: Record<AttendanceRequestType, { label: string; icon: typeof Clock3; color: string }> = {
  absence: { label: 'Absence', icon: FileText, color: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400' },
  late: { label: 'Late Arrival', icon: Clock3, color: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' },
  early_collection: { label: 'Early Collection', icon: DoorOpen, color: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400' },
};

const STATUS_META: Record<AttendanceRequestStatus, { label: string; variant: 'warning' | 'success' | 'error' | 'primary' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'error' },
  acknowledged: { label: 'Acknowledged', variant: 'primary' },
};

const ABSENCE_REASONS: Record<string, string> = {
  holiday: 'Holiday',
  illness: 'Illness',
  urgent_family: 'Urgent Family Reason',
  other: 'Other',
};

export function SchoolAdminAttendanceRequests() {
  const { profile } = useAuth();
  const { students, classes, loading: schoolLoading } = useSchoolData();
  const { toast } = useToast();
  const [requests, setRequests] = useState<ParentAttendanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('pending');
  const [reviewTarget, setReviewTarget] = useState<ParentAttendanceRequest | null>(null);
  const [reviewStatus, setReviewStatus] = useState<AttendanceRequestStatus>('approved');
  const [reviewNotes, setReviewNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.school_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('parent_attendance_requests')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false });
    if (error) {
      toast(error.message, 'error');
      setRequests([]);
    } else {
      setRequests((data as ParentAttendanceRequest[]) ?? []);
    }
    setLoading(false);
  }, [profile?.school_id, toast]);

  useEffect(() => {
    load();
    if (!profile?.school_id) return;
    const channel = supabase
      .channel('admin-attendance-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parent_attendance_requests', filter: `school_id=eq.${profile.school_id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, profile?.school_id]);

  const studentMap = useCallback(() => {
    const map: Record<string, { name: string; photo: string | null; className: string }> = {};
    students.forEach((s) => {
      const cls = classes.find((c) => c.id === s.class_id);
      map[s.id] = { name: s.full_name, photo: s.photo_url, className: cls?.name ?? '—' };
    });
    return map;
  }, [students, classes]);

  const filtered = filter === 'pending'
    ? requests.filter((r) => r.status === 'pending')
    : filter === 'reviewed'
    ? requests.filter((r) => r.status !== 'pending')
    : requests;

  const openReview = (req: ParentAttendanceRequest) => {
    setReviewTarget(req);
    setReviewStatus(req.status === 'pending' ? 'approved' : req.status);
    setReviewNotes(req.review_notes ?? '');
  };

  const submitReview = async () => {
    if (!reviewTarget || !profile?.user_id) return;
    setSaving(true);
    const { error } = await supabase
      .from('parent_attendance_requests')
      .update({
        status: reviewStatus,
        review_notes: reviewNotes.trim() || null,
        reviewed_by: profile.user_id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reviewTarget.id);

    if (error) {
      toast(error.message, 'error');
      setSaving(false);
      return;
    }

    // Notify the parent
    await supabase.from('notifications').insert({
      school_id: reviewTarget.school_id,
      user_id: reviewTarget.parent_user_id,
      type: 'attendance_request_review',
      title: `Request ${STATUS_META[reviewStatus].label}: ${REQUEST_TYPE_META[reviewTarget.request_type].label}`,
      body: reviewNotes.trim() || undefined,
      link: '/parent/attendance-requests',
    });

    toast('Request reviewed');
    setSaving(false);
    setReviewTarget(null);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Attendance Requests"
        subtitle="Review parent-submitted absence, late, and early collection requests"
        icon={<CalendarCheck className="h-6 w-6" />}
      />

      <Card>
        <div className="mb-4 flex gap-2">
          {(['pending', 'reviewed', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                filter === f
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-light'
                  : 'text-ink-muted hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {loading || schoolLoading ? (
          <RowSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={filter === 'pending' ? 'No pending requests' : 'No requests found'}
            description={filter === 'pending' ? 'There are no pending attendance requests.' : 'No attendance requests match this filter.'}
            icon={<CalendarCheck className="h-10 w-10" />}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((req) => {
              const meta = REQUEST_TYPE_META[req.request_type];
              const Icon = meta.icon;
              const status = STATUS_META[req.status];
              const sMap = studentMap();
              const studentInfo = sMap[req.student_id ?? ''];
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
                    {studentInfo && (
                      <div className="mt-1 flex items-center gap-2">
                        <Avatar name={studentInfo.name} src={studentInfo.photo} size="xs" />
                        <p className="text-xs text-ink-muted">{studentInfo.name} · {studentInfo.className}</p>
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-muted">
                      {req.request_type === 'absence' && (
                        <>
                          <span>Reason: {req.reason === 'other' ? req.custom_reason : ABSENCE_REASONS[req.reason ?? ''] ?? req.reason}</span>
                          <span>From: {formatDate(req.from_date)}</span>
                          <span>To: {formatDate(req.to_date)}</span>
                        </>
                      )}
                      {req.request_type === 'late' && (
                        <>
                          <span>Date: {formatDate(req.date)}</span>
                          <span>Expected: {req.expected_arrival_time}</span>
                        </>
                      )}
                      {req.request_type === 'early_collection' && (
                        <>
                          <span>Date: {formatDate(req.date)}</span>
                          <span>Leaving: {req.leaving_time}</span>
                          {req.collected_by && <span>By: {req.collected_by}</span>}
                        </>
                      )}
                    </div>
                    {req.notes && <p className="mt-1 text-xs text-ink-muted">Notes: {req.notes}</p>}
                    {req.review_notes && (
                      <p className="mt-1 text-xs text-primary-600 dark:text-primary-light">Response: {req.review_notes}</p>
                    )}
                    <p className="mt-1 text-xs text-ink-muted">{relativeTime(req.created_at)}</p>
                  </div>
                  {req.status === 'pending' && (
                    <Button size="sm" variant="secondary" onClick={() => openReview(req)}>Review</Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        title="Review Request"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewTarget(null)}>Cancel</Button>
            <Button loading={saving} onClick={submitReview}>Submit Review</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['approved', 'acknowledged', 'rejected'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setReviewStatus(s)}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors',
                  reviewStatus === s
                    ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/15 dark:text-primary-light'
                    : 'border-slate-200 text-ink-muted hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                )}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
          <Textarea label="Response Notes" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Optional message to the parent…" />
        </div>
      </Modal>
    </div>
  );
}
