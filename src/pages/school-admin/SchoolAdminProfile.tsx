import { useState, useEffect, type FormEvent } from 'react';
import { User, Upload, Pencil, KeyRound, Mail, Phone, MapPin, Calendar, Globe, Briefcase, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Badge, statusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { uploadFile, formatDate, cn } from '@/lib/utils';

export function SchoolAdminProfile() {
  const { profile, school } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url ?? null);

  const [editForm, setEditForm] = useState({
    full_name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    address: profile?.address ?? '',
    gender: profile?.gender ?? '',
    date_of_birth: profile?.date_of_birth ?? '',
    nationality: profile?.nationality ?? '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setEmail(session.user.email);
    });
  }, []);

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile || !profile) return profile?.avatar_url ?? null;
    const ext = avatarFile.name.split('.').pop();
    const path = `${profile.school_id}/avatars/${profile.id}-${Date.now()}.${ext}`;
    const url = await uploadFile('teacher-photos', path, avatarFile);
    return url ?? profile.avatar_url;
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!editForm.full_name.trim()) {
      toast('Full name is required', 'error');
      return;
    }
    setSaving(true);

    const avatarUrl = await uploadAvatar();

    const { error } = await supabase
      .from('app_users')
      .update({
        full_name: editForm.full_name.trim(),
        phone: editForm.phone || null,
        address: editForm.address || null,
        gender: editForm.gender || null,
        date_of_birth: editForm.date_of_birth || null,
        nationality: editForm.nationality || null,
        avatar_url: avatarUrl,
      })
      .eq('id', profile.id);

    setSaving(false);
    if (error) {
      toast(error.message, 'error');
      return;
    }
    toast('Profile updated successfully');
    setEditOpen(false);
    setAvatarFile(null);
    // Reload page to reflect changes
    window.location.reload();
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      toast('All fields are required', 'error');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast('New password must be at least 8 characters', 'error');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast('New passwords do not match', 'error');
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      password: passwordForm.newPassword,
    });
    setSaving(false);

    if (error) {
      toast(error.message, 'error');
      return;
    }

    toast('Password changed successfully');
    setPasswordOpen(false);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  if (!profile) {
    return (
      <div>
        <PageHeader title="Profile" icon={<User className="h-6 w-6" />} />
        <Card><p className="text-sm text-ink-muted">Loading profile…</p></Card>
      </div>
    );
  }

  const statusInfo = statusBadge(profile.active ? 'active' : 'inactive');

  return (
    <div>
      <PageHeader
        title="My Profile"
        subtitle="Manage your account and professional information"
        icon={<User className="h-6 w-6" />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <Avatar name={profile.full_name} src={avatarPreview} size="lg" />
              <label className="absolute bottom-0 right-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-primary-600 text-white shadow-md hover:bg-primary-700">
                <Upload className="h-3.5 w-3.5" />
                <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
              </label>
            </div>
            <h3 className="mt-3 text-lg font-bold text-ink dark:text-slate-100">{profile.full_name}</h3>
            <p className="text-sm text-ink-muted capitalize">{profile.role.replace('_', ' ')}</p>
            <div className="mt-2">
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            {school && (
              <div className="mt-4 w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                <p className="text-xs text-ink-muted">School</p>
                <p className="text-sm font-medium text-ink dark:text-slate-100">{school.name}</p>
              </div>
            )}
            <div className="mt-4 flex w-full gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setEditOpen(true)} leftIcon={<Pencil className="h-3.5 w-3.5" />}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => setPasswordOpen(true)} leftIcon={<KeyRound className="h-3.5 w-3.5" />}>
                Password
              </Button>
            </div>
            {avatarFile && (
              <p className="mt-2 text-xs text-primary-600">New photo selected. Save to upload.</p>
            )}
          </div>
        </Card>

        {/* Details Card */}
        <Card className="lg:col-span-2">
          <CardHeader title="Profile Details" subtitle="Your professional information" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DetailField icon={<User className="h-4 w-4" />} label="Full Name" value={profile.full_name} />
            <DetailField icon={<Shield className="h-4 w-4" />} label="Role" value={profile.role.replace('_', ' ')} capitalize />
            <DetailField icon={<Mail className="h-4 w-4" />} label="Email" value={email} />
            <DetailField icon={<Phone className="h-4 w-4" />} label="Phone" value={profile.phone} />
            <DetailField icon={<MapPin className="h-4 w-4" />} label="Address" value={profile.address} />
            <DetailField icon={<User className="h-4 w-4" />} label="Gender" value={profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : null} />
            <DetailField icon={<Calendar className="h-4 w-4" />} label="Date of Birth" value={profile.date_of_birth ? formatDate(profile.date_of_birth) : null} />
            <DetailField icon={<Globe className="h-4 w-4" />} label="Nationality" value={profile.nationality} />
            <DetailField icon={<Briefcase className="h-4 w-4" />} label="Department" value={profile.department} />
            <DetailField icon={<Calendar className="h-4 w-4" />} label="Joined Date" value={profile.created_at ? formatDate(profile.created_at) : null} />
          </div>

          {profile.qualification && (
            <div className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
              <p className="text-xs text-ink-muted mb-1">Qualification</p>
              <p className="text-sm text-ink dark:text-slate-100">{profile.qualification}</p>
            </div>
          )}

          {profile.medical_history && (
            <div className="mt-4 rounded-lg bg-rose-50 dark:bg-rose-500/10 p-3">
              <p className="text-xs text-rose-600 dark:text-rose-400 mb-1">Medical History</p>
              <p className="text-sm text-ink dark:text-slate-100">{profile.medical_history}</p>
            </div>
          )}

          {profile.emergency_contact_name && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 p-3">
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Emergency Contact</p>
                <p className="text-sm font-medium text-ink dark:text-slate-100">{profile.emergency_contact_name}</p>
                <p className="text-xs text-ink-muted">{profile.emergency_contact_phone ?? '—'}</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        open={editOpen}
        onClose={() => { setEditOpen(false); setAvatarFile(null); setAvatarPreview(profile.avatar_url); }}
        title="Edit Profile"
        description="Update your personal information"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setEditOpen(false); setAvatarFile(null); setAvatarPreview(profile.avatar_url); }}>Cancel</Button>
            <Button type="submit" form="edit-profile-form" loading={saving}>Save Changes</Button>
          </>
        }
      >
        <form id="edit-profile-form" onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className="input-label">Profile Picture</label>
            <div className="flex items-center gap-4">
              <Avatar name={editForm.full_name || 'Profile'} src={avatarPreview} size="lg" />
              <div>
                <label className={cn('btn btn-secondary cursor-pointer', saving && 'opacity-50 pointer-events-none')}>
                  <Upload className="h-4 w-4" />
                  <span>Upload Photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} disabled={saving} />
                </label>
                <p className="text-xs text-ink-muted mt-1">JPG, PNG up to 5MB</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Full Name *" required value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            <Input label="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+1 234 567 8900" />
            <Select label="Gender" value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
            <Input label="Date of Birth" type="date" value={editForm.date_of_birth} onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })} />
            <Input label="Nationality" value={editForm.nationality} onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value })} placeholder="e.g. American" />
          </div>

          <Textarea label="Address" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="123 Main St, City, Country" />
        </form>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        open={passwordOpen}
        onClose={() => { setPasswordOpen(false); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }}
        title="Change Password"
        description="Enter your new password below"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setPasswordOpen(false); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }}>Cancel</Button>
            <Button type="submit" form="password-form" loading={saving}>Change Password</Button>
          </>
        }
      >
        <form id="password-form" onSubmit={changePassword} className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            required
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            placeholder="••••••••"
          />
          <Input
            label="New Password"
            type="password"
            required
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            placeholder="••••••••"
          />
          <Input
            label="Confirm New Password"
            type="password"
            required
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            placeholder="••••••••"
          />
          <p className="text-xs text-ink-muted">Password must be at least 8 characters long.</p>
        </form>
      </Modal>
    </div>
  );
}

function DetailField({ icon, label, value, capitalize }: { icon: React.ReactNode; label: string; value: string | null | undefined; capitalize?: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-800 text-ink-muted">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-ink-muted">{label}</p>
        <p className={cn('text-sm font-medium text-ink dark:text-slate-100 truncate', capitalize && 'capitalize')}>
          {value || '—'}
        </p>
      </div>
    </div>
  );
}
