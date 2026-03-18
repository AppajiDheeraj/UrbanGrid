import { useEffect, useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/layouts/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const roleTitles = {
  citizen: "Resident",
  admin: "Administrator",
  ministry_officer: "Ministry Officer",
  department_head: "Department Head",
  senior_official: "Senior Official",
  contractor: "Contractor",
  regional_manager: "Regional Manager"
};

export default function ProfilePage() {
  const { refreshMe } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "",
    phone: "",
    address: ""
  });

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      setLoading(true);
      try {
        const { data } = await authAPI.getProfile();
        if (!active) return;
        setForm({
          name: data.profile?.name || "",
          email: data.profile?.email || "",
          role: data.profile?.role || "",
          phone: data.profile?.phone || "",
          address: data.profile?.address || ""
        });
      } catch (error) {
        if (!active) return;
        toast.error(error.response?.data?.message || "Failed to load profile");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await authAPI.updateProfile({
        name: form.name,
        phone: form.phone,
        address: form.address
      });
      await refreshMe();
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">UrbanGrid</p>
          <h1 className="mt-2 text-3xl font-semibold">Profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your identity details used across resident and official workflows.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Full Name</label>
              <Input name="name" value={form.name} onChange={onChange} disabled={loading} required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Email</label>
              <Input value={form.email} disabled />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Role</label>
              <Input value={roleTitles[form.role] || form.role || "User"} disabled />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Phone</label>
              <Input name="phone" value={form.phone} onChange={onChange} disabled={loading} />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Address</label>
            <Input name="address" value={form.address} onChange={onChange} disabled={loading} />
          </div>
          <Button type="submit" disabled={loading || saving}>
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </form>
      </div>
    </DashboardLayout>
  );
}
