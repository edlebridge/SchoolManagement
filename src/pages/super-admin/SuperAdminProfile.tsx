import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { User } from 'lucide-react';

export function SuperAdminProfile() {
  const { profile } = useAuth();
  return (
    <div>
      <PageHeader title="Profile" subtitle="Your account details" icon={<User className="h-6 w-6" />} />
      <Card>
        <div className="flex items-center gap-4 mb-6">
          <Avatar name={profile?.full_name ?? ''} src={profile?.avatar_url} size="lg" />
          <div>
            <h2 className="text-lg font-semibold text-ink">{profile?.full_name}</h2>
            <p className="text-sm text-ink-muted">Platform Owner</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between"><span className="text-sm text-ink-muted">Phone</span><span className="text-sm text-ink">{profile?.phone ?? '—'}</span></div>
          <div className="flex justify-between"><span className="text-sm text-ink-muted">Role</span><span className="text-sm text-ink">Super Admin</span></div>
        </div>
      </Card>
    </div>
  );
}
