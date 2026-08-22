import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RowSkeleton } from '@/components/ui/Spinner';
import { Settings, Save, DollarSign, Globe, Phone, Mail, ToggleLeft, ToggleRight } from 'lucide-react';

interface PlatformSettings {
  id: string;
  default_plan: string;
  default_trial_days: number;
  default_currency: string;
  default_student_limit: number;
  platform_fee_pct: number;
  maintenance_mode: boolean;
  contact_email: string | null;
  support_phone: string | null;
}

export function SuperAdminSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PlatformSettings | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('platform_settings').select('*').limit(1).maybeSingle();
    if (data) {
      setSettings(data as PlatformSettings);
      setForm(data as PlatformSettings);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    const { error } = await supabase.from('platform_settings').update({
      default_plan: form.default_plan,
      default_trial_days: form.default_trial_days,
      default_currency: form.default_currency,
      default_student_limit: form.default_student_limit,
      platform_fee_pct: form.platform_fee_pct,
      maintenance_mode: form.maintenance_mode,
      contact_email: form.contact_email,
      support_phone: form.support_phone,
      updated_at: new Date().toISOString(),
    }).eq('id', form.id);

    if (error) {
      toast(`Failed to save settings: ${error.message}`, 'error');
    } else {
      toast('Settings saved', 'success');
      setSettings(form);
    }
    setSaving(false);
  };

  if (loading) return (
    <div>
      <PageHeader title="Settings" subtitle="Platform-wide configuration" icon={<Settings className="h-6 w-6" />} />
      <RowSkeleton rows={4} />
    </div>
  );

  if (!form) return (
    <div>
      <PageHeader title="Settings" subtitle="Platform-wide configuration" icon={<Settings className="h-6 w-6" />} />
      <Card><p className="text-sm text-ink-muted text-center py-6">No settings found. Please contact support.</p></Card>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Platform-wide configuration"
        icon={<Settings className="h-6 w-6" />}
        action={<Button onClick={save} loading={saving} leftIcon={<Save className="h-4 w-4" />}>Save Changes</Button>}
      />

      <div className="space-y-6">
        {/* Pricing Defaults */}
        <Card>
          <CardHeader title="Pricing Defaults" subtitle="Default plan and billing settings for new schools" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Default Plan</label>
              <select value={form.default_plan} onChange={(e) => setForm({ ...form, default_plan: e.target.value })} className="input">
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <p className="text-xs text-ink-muted mt-1">Plan assigned to new schools when they register.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Default Currency</label>
              <select value={form.default_currency} onChange={(e) => setForm({ ...form, default_currency: e.target.value })} className="input">
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="KES">KES (KSh)</option>
                <option value="NGN">NGN (₦)</option>
                <option value="ZAR">ZAR (R)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Trial Period (days)</label>
              <input type="number" value={form.default_trial_days} onChange={(e) => setForm({ ...form, default_trial_days: Number(e.target.value) })} className="input" min={1} max={90} />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Default Student Limit</label>
              <input type="number" value={form.default_student_limit} onChange={(e) => setForm({ ...form, default_student_limit: Number(e.target.value) })} className="input" min={1} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-ink mb-1">Platform Fee (%)</label>
              <input type="number" step="0.5" value={form.platform_fee_pct} onChange={(e) => setForm({ ...form, platform_fee_pct: Number(e.target.value) })} className="input" min={0} max={100} />
              <p className="text-xs text-ink-muted mt-1">Commission percentage taken from each subscription payment.</p>
            </div>
          </div>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader title="Contact Information" subtitle="Shown to schools for support" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Contact Email</label>
              <input type="email" value={form.contact_email ?? ''} onChange={(e) => setForm({ ...form, contact_email: e.target.value || null })} className="input" placeholder="support@edubridge.app" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Support Phone</label>
              <input type="tel" value={form.support_phone ?? ''} onChange={(e) => setForm({ ...form, support_phone: e.target.value || null })} className="input" placeholder="+1 234 567 890" />
            </div>
          </div>
        </Card>

        {/* Maintenance Mode */}
        <Card>
          <CardHeader title="Maintenance Mode" subtitle="Temporarily disable access to the platform" />
          <button
            onClick={() => setForm({ ...form, maintenance_mode: !form.maintenance_mode })}
            className="flex items-center gap-3 rounded-xl border border-surface-border p-4 w-full transition-colors hover:bg-surface-overlay text-left"
          >
            {form.maintenance_mode ? (
              <ToggleRight className="h-8 w-8 text-error-soft-text shrink-0" />
            ) : (
              <ToggleLeft className="h-8 w-8 text-ink-muted shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium text-ink">{form.maintenance_mode ? 'Maintenance Mode is ON' : 'Maintenance Mode is OFF'}</p>
              <p className="text-xs text-ink-muted mt-0.5">
                {form.maintenance_mode
                  ? 'All schools will be blocked from accessing the platform until turned off.'
                  : 'Platform is operating normally. Toggle this to temporarily block all access.'}
              </p>
            </div>
          </button>
        </Card>
      </div>
    </div>
  );
}
