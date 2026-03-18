import { useEffect, useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/layouts/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authAPI } from "@/lib/api";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    theme: "system",
    language: "en",
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    currentPassword: "",
    newPassword: ""
  });

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      setLoading(true);
      try {
        const { data } = await authAPI.getSettings();
        if (!active) return;
        setForm((prev) => ({
          ...prev,
          ...data.settings,
          currentPassword: "",
          newPassword: ""
        }));
      } catch (error) {
        if (!active) return;
        toast.error(error.response?.data?.message || "Failed to load settings");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadSettings();
    return () => {
      active = false;
    };
  }, []);

  const onFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        theme: form.theme,
        language: form.language,
        emailNotifications: form.emailNotifications,
        smsNotifications: form.smsNotifications,
        pushNotifications: form.pushNotifications
      };

      if (form.newPassword || form.currentPassword) {
        payload.currentPassword = form.currentPassword;
        payload.newPassword = form.newPassword;
      }

      const { data } = await authAPI.updateSettings(payload);
      setForm((prev) => ({
        ...prev,
        ...data.settings,
        currentPassword: "",
        newPassword: ""
      }));
      toast.success("Settings updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">UrbanGrid</p>
          <h1 className="mt-2 text-3xl font-semibold">Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage notification preferences, language, and account security for every role.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Theme</label>
              <select
                name="theme"
                value={form.theme}
                onChange={onFieldChange}
                disabled={loading}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Language</label>
              <select
                name="language"
                value={form.language}
                onChange={onFieldChange}
                disabled={loading}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="kn">Kannada</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium">Notifications</label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="emailNotifications"
                checked={form.emailNotifications}
                onChange={onFieldChange}
                disabled={loading}
              />
              Email notifications
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="smsNotifications"
                checked={form.smsNotifications}
                onChange={onFieldChange}
                disabled={loading}
              />
              SMS notifications
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="pushNotifications"
                checked={form.pushNotifications}
                onChange={onFieldChange}
                disabled={loading}
              />
              Push notifications
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Current Password</label>
              <Input
                type="password"
                name="currentPassword"
                value={form.currentPassword}
                onChange={onFieldChange}
                placeholder="Only needed for password change"
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">New Password</label>
              <Input
                type="password"
                name="newPassword"
                value={form.newPassword}
                onChange={onFieldChange}
                placeholder="Min 8 chars, strong password"
                disabled={loading}
              />
            </div>
          </div>

          <Button type="submit" disabled={loading || saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </div>
    </DashboardLayout>
  );
}
