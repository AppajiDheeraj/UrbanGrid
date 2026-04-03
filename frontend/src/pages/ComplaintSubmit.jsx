import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeftIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DashboardLayout from "@/layouts/dashboard-layout";
import { citizenAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const categories = [
  { value: "road_damage", label: "Road Damage" },
  { value: "street_light", label: "Street Light" },
  { value: "water_leak", label: "Water Leak" },
  { value: "garbage", label: "Garbage" },
  { value: "drainage", label: "Drainage" }
];

export default function ComplaintSubmitPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "road_damage",
    area: "",
    wardNo: user?.wardNo || user?.ward_no || ""
  });
  const [images, setImages] = useState([]);

  useEffect(() => {
    if (user?.wardNo || user?.ward_no) {
      setForm((prev) => ({
        ...prev,
        wardNo: user?.wardNo || user?.ward_no || prev.wardNo
      }));
    }
  }, [user?.wardNo, user?.ward_no]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleFiles = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (images.length + files.length > 5) {
      setError("You can upload up to 5 images.");
      return;
    }
    setImages((prev) => [...prev, ...files]);
    setError("");
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, current) => current !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.title || !form.description || !form.area || !form.wardNo) {
      setError("Please fill in title, description, area, and ward number.");
      return;
    }

    if (images.length === 0) {
      setError("Please upload at least one image.");
      return;
    }

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value) payload.append(key, value);
    });
    images.forEach((file) => payload.append("images", file));

    setSubmitting(true);
    try {
      await citizenAPI.submitComplaint(payload);
      toast.success("Complaint submitted successfully");
      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      setError(
        submitError.response?.data?.message ||
          submitError.message ||
          "Failed to submit complaint"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">UrbanGrid</p>
            <h1 className="mt-2 text-3xl font-semibold">File a Complaint</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Report road, water, drainage, garbage, or street light issues with photos, your ward number, and the area name.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            <ArrowLeftIcon className="size-4" />
            Back to Dashboard
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium">Title</span>
              <Input name="title" value={form.title} onChange={updateField} placeholder="Short issue title" />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium">Category</span>
              <select
                name="category"
                value={form.category}
                onChange={updateField}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {categories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-2 block">
            <span className="text-sm font-medium">Description</span>
            <textarea
              name="description"
              value={form.description}
              onChange={updateField}
              rows={5}
              placeholder="Describe the issue in detail"
              className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium">Area</span>
              <Input name="area" value={form.area} onChange={updateField} placeholder="Area, locality, or landmark" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Ward Number</span>
              <Input name="wardNo" value={form.wardNo} onChange={updateField} placeholder="Ward number" />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Photos</span>
              <span className="text-xs text-muted-foreground">Up to 5 images</span>
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-8 text-sm text-muted-foreground">
              <UploadIcon className="size-4" />
              Upload complaint images
              <input type="file" className="hidden" multiple accept="image/*" onChange={handleFiles} />
            </label>
            {images.length > 0 && (
              <div className="grid gap-3 md:grid-cols-3">
                {images.map((image, index) => (
                  <div key={`${image.name}-${index}`} className="overflow-hidden rounded-xl border border-border">
                    <img
                      src={URL.createObjectURL(image)}
                      alt={`Preview ${index + 1}`}
                      className="h-32 w-full object-cover"
                    />
                    <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs">
                      <span className="truncate">{image.name}</span>
                      <button type="button" className="text-red-600" onClick={() => removeImage(index)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Complaint"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
