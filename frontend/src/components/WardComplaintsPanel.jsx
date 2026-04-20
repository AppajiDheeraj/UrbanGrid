import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock3, MapPin, MessageSquareWarning, ShieldCheck } from "lucide-react";

const stageConfig = [
  { key: "received", field: "submittedAt", label: "Received", icon: Clock3 },
  { key: "viewed", field: "officialViewedAt", label: "Viewed", icon: MessageSquareWarning },
  { key: "notified", field: "contractorNotifiedAt", label: "Contractor Notified", icon: ShieldCheck },
  { key: "work_done", field: "workCompletedAt", label: "Work Done", icon: CheckCircle2 }
];

const formatDate = (value) => {
  if (!value) return "Pending";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const getStatusLabel = (status) => {
  const value = String(status || "").toLowerCase();
  if (value === "resolved") return "Resolved";
  if (value === "pending_admin_verification") return "Pending Admin Verification";
  if (value === "closed") return "Resolved";
  if (value === "completed") return "Completed";
  if (value === "in_progress") return "In Progress";
  if (value === "tender_created") return "Contractor Notified";
  if (value === "verified" || value === "under_review") return "Under Review";
  return "Received";
};

const getLocationLabel = (complaint, wardNo) => {
  const pinCode = String(complaint.pinCode || "").trim();

  if (pinCode && pinCode !== "000000") {
    return pinCode;
  }

  return complaint.wardNo || wardNo ? `Ward ${complaint.wardNo || wardNo}` : "N/A";
};

export function WardComplaintsPanel({
  wardNo,
  complaints,
  selectedComplaintId,
  onSelectComplaint,
  onVoteComplaint,
  voteBusyId,
  loading
}) {
  const selectedComplaint = complaints.find((item) => String(item.id || item._id) === String(selectedComplaintId)) || complaints[0] || null;

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Ward {wardNo || "N/A"}</p>
            <h2 className="mt-2 text-lg font-semibold">Ward Complaints</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              See every complaint filed in your ward, track the status, and vote on what needs urgent attention.
            </p>
          </div>
          <div className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            {complaints.length} active
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading ward complaints...</p>
          ) : complaints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active complaints in this ward right now.</p>
          ) : (
            complaints.map((complaint) => {
              const complaintId = complaint.id || complaint._id;
              const active = String(complaintId) === String(selectedComplaint?.id || selectedComplaint?._id);
              return (
                <button
                  key={complaintId}
                  type="button"
                  onClick={() => onSelectComplaint?.(complaintId)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition",
                    active ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{complaint.title}</p>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {getStatusLabel(complaint.status)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{complaint.description}</p>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5" />
                          {getLocationLabel(complaint, wardNo)}
                        </span>
                        <span>Votes: {complaint.voteSummary?.totalVotes || 0}</span>
                        <span>Priority: {(complaint.voteSummary?.averageVote || 0).toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        {!selectedComplaint ? (
          <p className="text-sm text-muted-foreground">Pick a complaint to see the full detail and tracking steps.</p>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">
                    Complaint {selectedComplaint.complaintId || selectedComplaint.id}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">{selectedComplaint.title}</h3>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  {getStatusLabel(selectedComplaint.status)}
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{selectedComplaint.description}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Location</p>
                <p className="mt-1 text-sm font-medium">{selectedComplaint.address || "N/A"}</p>
                <p className="text-xs text-muted-foreground">{getLocationLabel(selectedComplaint, wardNo)}</p>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Ward Priority</p>
                <p className="mt-1 text-sm font-medium">{(selectedComplaint.voteSummary?.averageVote || 0).toFixed(1)} / 5</p>
                <p className="text-xs text-muted-foreground">{selectedComplaint.voteSummary?.totalVotes || 0} resident vote(s)</p>
                {selectedComplaint.voteSummary?.myVote ? (
                  <p className="mt-1 text-xs text-primary">Your vote: {selectedComplaint.voteSummary.myVote}/5</p>
                ) : null}
              </div>
            </div>

            {selectedComplaint.images?.length > 0 && (
              <div>
                <p className="text-sm font-medium">Images</p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {selectedComplaint.images.map((image, index) => (
                    <a
                      key={`${image.url || index}`}
                      href={image.url ? `http://localhost:5000${image.url}` : "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="overflow-hidden rounded-xl border border-border/60"
                    >
                      <img
                        src={image.url ? `http://localhost:5000${image.url}` : ""}
                        alt={`Complaint evidence ${index + 1}`}
                        className="h-24 w-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium">Tracking</p>
              <div className="mt-3 space-y-3">
                {stageConfig.map((stage) => {
                  const completedAt = selectedComplaint.tracking?.[stage.field] || selectedComplaint[stage.field];
                  const completed = Boolean(completedAt);
                  const Icon = stage.icon;
                  return (
                    <div key={stage.key} className="flex items-start gap-3 rounded-xl border border-border/60 p-3">
                      <div className={cn("mt-0.5 rounded-full p-2", completed ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground")}>
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{stage.label}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(completedAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Resident vote</p>
                  <p className="text-xs text-muted-foreground">
                    Residents in the same ward can vote 1 to 5. The complaint reporter cannot vote on their own complaint.
                  </p>
                </div>
                {selectedComplaint.canVote ? (
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Button
                        key={value}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={voteBusyId === selectedComplaint.id}
                        onClick={() => onVoteComplaint?.(selectedComplaint.id, value)}
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">This complaint cannot be voted on by you.</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default WardComplaintsPanel;
