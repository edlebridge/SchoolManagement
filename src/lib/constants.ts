export const ATTENDANCE_LABELS: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
};

export const EXAM_SESSION_STATUSES = ['draft', 'scheduled', 'completed', 'published'] as const;
export const EXAM_SESSION_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  completed: 'Completed',
  published: 'Published',
};
