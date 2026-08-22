import { useState, useEffect, useRef } from 'react';
import { User, Mail, Phone, MapPin, Calendar, Globe, Shield, Camera, Pencil, KeyRound, Check } from 'lucide-react';
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
import { formatDate, cn, uploadFile } from '@/lib/utils';

export function TeacherProfile() {
  const { profile, school } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [email, setEmail] = useState('');

  // Edit form state
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    address: '',
    gender: '',
    date_of_birth: '',
    nationality: '',
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Get email from auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setEmail(session.user.email);
    });
  }, []);

  // Initialize edit form when opening
  useEffect(() => {
    if (editOpen && profile) {
      setEditForm({
        full_name: profile.full_name ?? '',
        phone: profile.phone ?? '',
        address: profile.address ?? '',
        gender: profile.gender ?? '',
        date_of_birth: profile.date_of_birth?.split('T')[0] ?? '',
        nationality: profile.nationality ?? '',
      });
    }
  }, [editOpen, profile]);

  // Initialize password form when opening
  useEffect(() => {
    if (passwordOpen) {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    }
  }, [passwordOpen]);

  // Handle avatar upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id || !profile?.school_id) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${profile.school_id}/teachers/${profile.id}/avatar.${ext}`;
      const publicUrl = await uploadFile('avatars', path, file);
      if (!publicUrl) throw new Error('Upload failed');

      const { error } = await supabase
        .from('app_users')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (error) throw error;
      toast('Profile picture updated');
      // Reload page to refresh profile
      window.location.reload();
    } catch {
      toast('Failed to upload image', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Save profile edits
  const handleSaveProfile = async () => {
    if (!profile?.id) return;
    if (!editForm.full_name.trim()) {
      toast('Full name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_users')
        .update({
          full_name: editForm.full_name.trim(),
          phone: editForm.phone || null,
          address: editForm.address || null,
          gender: editForm.gender || null,
          date_of_birth: editForm.date_of_birth || null,
          nationality: editForm.nationality || null,
        })
        .eq('id', profile.id);

      if (error) throw error;
      toast('Profile updated successfully');
      setEditOpen(false);
      window.location.reload();
    } catch {
      toast('Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      toast('Please fill in all fields', 'error');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast('New passwords do not match', 'error');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast('Password must be at least 6 characters', 'error');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) throw error;
      toast('Password changed successfully');
      setPasswordOpen(false);
    } catch {
      toast('Failed to change password', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <div>
        <PageHeader title="My Profile" subtitle="View and manage your profile" icon={<User className="h-5 w-5" />} />
        <Card>
          <p className="text-sm text-ink-muted">Profile not found.</p>
        </Card>
      </div>
    );
  }

  const statusInfo = statusBadge(profile.active ? 'active' : 'inactive');

  return (
    <div>
      <PageHeader
        title="My Profile"
        subtitle="Manage your professional profile"
        icon={<User className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>
              Edit Profile
            </Button>
            <Button variant="secondary" leftIcon={<KeyRound className="h-4 w-4" />} onClick={() => setPasswordOpen(true)}>
              Change Password
            </Button>
          </div>
        }
      />

      {/* Profile Card */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Avatar & Quick Info */}
        <div className="lg:col-span-1">
          <Card className="text-center">
            {/* Avatar with upload */}
            <div className="relative mx-auto w-fit">
              <Avatar name={profile.full_name} src={profile.avatar_url} size="lg" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {uploading ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>

            <h2 className="mt-4 text-lg font-bold text-ink dark:text-slate-100">{profile.full_name}</h2>
            <p className="text-sm text-ink-muted capitalize">{profile.role}</p>

            <div className="mt-3 flex justify-center">
              <Badge variant={statusInfo.variant}>
                {statusInfo.label}
              </Badge>
            </div>

            {/* School info */}
            {school && (
              <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                <p className="text-xs text-ink-muted">School</p>
                <p className="text-sm font-medium text-ink dark:text-slate-100">{school.name}</p>
              </div>
            )}

            {/* Quick stats */}
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div>
                <p className="text-xs text-ink-muted">Joined</p>
                <p className="text-sm font-medium text-ink dark:text-slate-100">{formatDate(profile.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">User ID</p>
                <p className="text-xs font-mono text-ink-muted truncate" title={profile.user_id}>
                  {profile.user_id.slice(0, 8)}...
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Detailed Info */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Personal Information" subtitle="Your profile details" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoRow
                icon={<User className="h-4 w-4" />}
                label="Full Name"
                value={profile.full_name}
              />
              <InfoRow
                icon={<Shield className="h-4 w-4" />}
                label="Role"
                value={<span className="capitalize">{profile.role}</span>}
              />
              <InfoRow
                icon={<Mail className="h-4 w-4" />}
                label="Email"
                value={email || '—'}
              />
              <InfoRow
                icon={<Phone className="h-4 w-4" />}
                label="Phone"
                value={profile.phone ?? '—'}
              />
              <InfoRow
                icon={<MapPin className="h-4 w-4" />}
                label="Address"
                value={profile.address ?? '—'}
              />
              <InfoRow
                icon={<User className="h-4 w-4" />}
                label="Gender"
                value={profile.gender ? <span className="capitalize">{profile.gender}</span> : '—'}
              />
              <InfoRow
                icon={<Calendar className="h-4 w-4" />}
                label="Date of Birth"
                value={formatDate(profile.date_of_birth)}
              />
              <InfoRow
                icon={<Globe className="h-4 w-4" />}
                label="Nationality"
                value={profile.nationality ?? '—'}
              />
              <InfoRow
                icon={<Calendar className="h-4 w-4" />}
                label="Joined Date"
                value={formatDate(profile.created_at)}
              />
              <InfoRow
                icon={<Check className="h-4 w-4" />}
                label="Status"
                value={<Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>}
              />
            </div>
          </Card>

          {/* Professional Details */}
          {(profile.qualification || profile.department || profile.employment_date || profile.employment_status) && (
            <Card className="mt-6">
              <CardHeader title="Professional Details" subtitle="Employment information" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {profile.qualification && (
                  <InfoRow
                    icon={<Shield className="h-4 w-4" />}
                    label="Qualification"
                    value={profile.qualification}
                  />
                )}
                {profile.department && (
                  <InfoRow
                    icon={<User className="h-4 w-4" />}
                    label="Department"
                    value={profile.department}
                  />
                )}
                {profile.employment_date && (
                  <InfoRow
                    icon={<Calendar className="h-4 w-4" />}
                    label="Employment Date"
                    value={formatDate(profile.employment_date)}
                  />
                )}
                {profile.employment_status && (
                  <InfoRow
                    icon={<Check className="h-4 w-4" />}
                    label="Employment Status"
                    value={profile.employment_status}
                  />
                )}
              </div>
            </Card>
          )}

          {/* Emergency Contact */}
          {(profile.emergency_contact_name || profile.emergency_contact_phone) && (
            <Card className="mt-6">
              <CardHeader title="Emergency Contact" subtitle="Emergency contact information" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {profile.emergency_contact_name && (
                  <InfoRow
                    icon={<User className="h-4 w-4" />}
                    label="Contact Name"
                    value={profile.emergency_contact_name}
                  />
                )}
                {profile.emergency_contact_phone && (
                  <InfoRow
                    icon={<Phone className="h-4 w-4" />}
                    label="Contact Phone"
                    value={profile.emergency_contact_phone}
                  />
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Profile"
        description="Update your personal information"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveProfile} loading={saving}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={editForm.full_name}
            onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
            placeholder="Enter your full name"
          />

          <Input
            label="Phone"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            placeholder="Enter your phone number"
          />

          <Textarea
            label="Address"
            value={editForm.address}
            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            placeholder="Enter your address"
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Gender"
              value={editForm.gender}
              onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
            >
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>

            <Input
              label="Date of Birth"
              type="date"
              value={editForm.date_of_birth}
              onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
            />
          </div>

          <Input
            label="Nationality"
            value={editForm.nationality}
            onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value })}
            placeholder="Enter your nationality"
          />
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Change Password"
        description="Update your account password"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPasswordOpen(false)}>Cancel</Button>
            <Button onClick={handleChangePassword} loading={saving}>Change Password</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
            placeholder="Enter current password"
          />

          <Input
            label="New Password"
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            placeholder="Enter new password"
          />

          <Input
            label="Confirm New Password"
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            placeholder="Confirm new password"
          />

          {passwordForm.newPassword && passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
            <p className="text-xs text-rose-600">Passwords do not match</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-light">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <p className="text-sm text-ink dark:text-slate-100 break-words">{value}</p>
      </div>
    </div>
  );
}
