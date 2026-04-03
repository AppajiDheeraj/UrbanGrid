import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import DashboardLayout from "@/layouts/dashboard-layout";
import { useAuth } from "@/contexts/AuthContext";
import {
  adminAPI,
  alertAPI,
  approvalAPI,
  citizenAPI,
  contractorAPI,
  ministryAPI,
  projectAPI,
  reportAPI,
  regionAPI
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import WardComplaintsPanel from "@/components/WardComplaintsPanel";

const roleCopy = {
  citizen: {
    heading: "Resident Dashboard",
    subtitle: "Track ward complaints, resident votes, and resolution progress.",
    cards: [
      { label: "Ward Complaints", key: "totalComplaints" },
      { label: "Under Review", key: "inReview" },
      { label: "In Progress", key: "inProgress" }
    ]
  },
  contractor: {
    heading: "Contractor Dashboard",
    subtitle: "Review bids, monitor projects, and update milestones.",
    cards: [
      { label: "Available Tenders", key: "availableTenders" },
      { label: "My Bids", key: "myBids" },
      { label: "My Projects", key: "myProjects" }
    ]
  },
  admin: {
    heading: "Admin Dashboard",
    subtitle: "Monitor complaint verification, reports, and alerts.",
    cards: [
      { label: "Total Complaints", key: "total" },
      { label: "Pending", key: "pending" },
      { label: "Verified", key: "verified" }
    ]
  },
  ministry_officer: {
    heading: "Ministry Dashboard",
    subtitle: "Manage routed complaints, tenders, and approvals.",
    cards: [
      { label: "Routed Complaints", key: "complaints" },
      { label: "Total Tenders", key: "tenders" },
      { label: "Approved Tenders", key: "approvedTenders" }
    ]
  },
  department_head: {
    heading: "Department Head Dashboard",
    subtitle: "Review tenders and move approvals quickly.",
    cards: [
      { label: "Routed Complaints", key: "complaints" },
      { label: "Total Tenders", key: "tenders" },
      { label: "Approved Tenders", key: "approvedTenders" }
    ]
  },
  senior_official: {
    heading: "Senior Official Dashboard",
    subtitle: "Oversee approvals and completion quality.",
    cards: [
      { label: "Pending Approvals", key: "pendingApprovals" },
      { label: "Approval History", key: "approvalHistory" },
      { label: "Published Tenders", key: "publishedTenders" }
    ]
  },
  regional_manager: {
    heading: "Regional Manager Dashboard",
    subtitle: "Monitor region-level complaints, projects, and milestones.",
    cards: [
      { label: "Regional Projects", key: "regionalProjects" },
      { label: "Regional Complaints", key: "regionalComplaints" },
      { label: "Active Projects", key: "activeRegionalProjects" }
    ]
  }
};

const statusTone = (status) => {
  const value = String(status || "").toLowerCase();
  if (["approved", "verified", "completed", "published"].includes(value)) return "bg-emerald-500/15 text-emerald-700";
  if (["rejected", "cancelled", "closed"].includes(value)) return "bg-red-500/15 text-red-700";
  if (["pending", "submitted", "draft", "under_review", "pending_approval"].includes(value)) return "bg-amber-500/15 text-amber-700";
  return "bg-slate-500/15 text-slate-700";
};

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
};

const Badge = ({ className = "", children }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
    {children}
  </span>
);

const asList = (value) => (Array.isArray(value) ? value : []);

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [panelData, setPanelData] = useState({
    complaints: [],
    tenders: [],
    projects: [],
    reports: [],
    alerts: [],
    milestones: [],
    selectedProjectId: null
  });
  const [reportBusy, setReportBusy] = useState(false);
  const [alertBusyId, setAlertBusyId] = useState(null);
  const [bidBusy, setBidBusy] = useState(false);
  const [progressBusy, setProgressBusy] = useState(false);
  const [selectedTenderId, setSelectedTenderId] = useState(null);
  const [bidFiles, setBidFiles] = useState([]);
  const [bidForm, setBidForm] = useState({
    amount: "",
    proposedStartDate: "",
    proposedEndDate: "",
    durationDays: "",
    proposal: ""
  });
  const [progressFiles, setProgressFiles] = useState([]);
  const [progressForm, setProgressForm] = useState({
    title: "",
    description: "",
    percentageComplete: "",
    updateType: "weekly"
  });
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [voteBusyId, setVoteBusyId] = useState(null);

  const config = roleCopy[user?.role] || roleCopy.citizen;
  const wardLabel = user?.wardNo || user?.ward_no || user?.pincode || "N/A";

  const selectedProject = useMemo(
    () => {
      const projects = asList(panelData.projects);
      return projects.find((project) => String(project.id || project._id) === String(panelData.selectedProjectId)) || projects[0] || null;
    },
    [panelData.projects, panelData.selectedProjectId]
  );

  useEffect(() => {
    let alive = true;

    const loadMilestones = async (projectId) => {
      if (!projectId) {
        return [];
      }

      try {
        const { data } = await projectAPI.getMilestones(projectId);
        return data.milestones || [];
      } catch {
        return [];
      }
    };

    const loadData = async () => {
      setLoading(true);

      try {
        if (user?.role === "citizen") {
          const { data } = await citizenAPI.getWardComplaints();
          const complaints = data.complaints || [];
          if (!alive) return;

          const selectedComplaint = complaints[0] || null;
          setStats({
            totalComplaints: complaints.length,
            inReview: complaints.filter((item) => !item.tracking?.officialViewedAt && item.status !== "closed").length,
            inProgress: complaints.filter((item) => item.tracking?.officialViewedAt && !item.tracking?.workCompletedAt && item.status !== "closed").length
          });
          setPanelData((prev) => ({
            ...prev,
            complaints: asList(complaints)
          }));
          setSelectedComplaintId(selectedComplaint ? (selectedComplaint.id || selectedComplaint._id) : null);
        } else if (user?.role === "contractor") {
          const [tendersRes, bidsRes, projectsRes] = await Promise.all([
            contractorAPI.getAvailableTenders(),
            contractorAPI.getMyBids(),
            contractorAPI.getMyProjects()
          ]);

          const projects = projectsRes.data.projects || [];
          const selectedProjectId = projects[0] ? projects[0].id || projects[0]._id : null;
          const availableTenders = tendersRes.data.tenders || [];
          const selectedTenderId = availableTenders[0] ? availableTenders[0].id || availableTenders[0]._id : null;
          const milestones = await loadMilestones(selectedProjectId);

          if (!alive) return;

          setStats({
            availableTenders: tendersRes.data.tenders?.length || 0,
            myBids: bidsRes.data.bids?.length || 0,
            myProjects: projects.length
          });
          setPanelData((prev) => ({
            ...prev,
            tenders: asList(availableTenders),
            projects: asList(projects),
            selectedProjectId,
            milestones: asList(milestones)
          }));
          setSelectedTenderId(selectedTenderId);
        } else if (user?.role === "admin") {
          const [statsRes, reportsRes, alertsRes] = await Promise.all([
            adminAPI.getDashboardStats(),
            reportAPI.list({ limit: 5 }),
            alertAPI.list({ limit: 5 })
          ]);

          if (!alive) return;

          setStats(statsRes.data.stats || {});
          setPanelData((prev) => ({
            ...prev,
            complaints: asList(statsRes.data.recentComplaints),
            reports: asList(reportsRes.data.reports),
            alerts: asList(alertsRes.data.alerts)
          }));
        } else if (user?.role === "regional_manager") {
          const [projectsRes, complaintsRes] = await Promise.all([
            regionAPI.getProjects(),
            regionAPI.getComplaints()
          ]);

          const projects = projectsRes.data.projects || [];
          const selectedProjectId = projects[0] ? projects[0].id || projects[0]._id : null;
          const milestones = await loadMilestones(selectedProjectId);

          if (!alive) return;

          setStats({
            regionalProjects: projects.length,
            regionalComplaints: complaintsRes.data.complaints?.length || 0,
            activeRegionalProjects: projects.filter((item) => item.status === "in_progress").length
          });
          setPanelData((prev) => ({
            ...prev,
            complaints: asList(complaintsRes.data.complaints),
            projects: asList(projects),
            selectedProjectId,
            milestones: asList(milestones)
          }));
        } else if (user?.role === "senior_official") {
          const [pendingRes, historyRes, tendersRes] = await Promise.all([
            approvalAPI.getPending(),
            approvalAPI.getHistory(),
            ministryAPI.getTenders()
          ]);
          const tenders = tendersRes.data.tenders || [];

          if (!alive) return;

          setStats({
            pendingApprovals: pendingRes.data.tenders?.length || 0,
            approvalHistory: historyRes.data.tenders?.length || 0,
            publishedTenders: tenders.filter((item) => item.status === "published").length
          });
          setPanelData((prev) => ({
            ...prev,
            tenders: asList(tenders).slice(0, 5)
          }));
        } else {
          const [complaintsRes, tendersRes] = await Promise.all([
            ministryAPI.getComplaints(),
            ministryAPI.getTenders()
          ]);
          const tenders = tendersRes.data.tenders || [];

          if (!alive) return;

          setStats({
            complaints: complaintsRes.data.complaints?.length || 0,
            tenders: tenders.length,
            approvedTenders: tenders.filter((item) => item.status === "approved").length
          });
          setPanelData((prev) => ({
            ...prev,
            complaints: asList(complaintsRes.data.complaints),
            tenders: asList(tenders).slice(0, 5)
          }));
        }
      } catch (error) {
        if (!alive) return;
        setStats({});
        toast.error(error.response?.data?.message || "Failed to load dashboard");
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadData();
    return () => {
      alive = false;
    };
  }, [user?.role]);

  const refreshAdminExtras = async () => {
    try {
      const [reportsRes, alertsRes] = await Promise.all([
        reportAPI.list({ limit: 5 }),
        alertAPI.list({ limit: 5 })
      ]);
      setPanelData((prev) => ({
        ...prev,
        reports: asList(reportsRes.data.reports),
        alerts: asList(alertsRes.data.alerts)
      }));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to refresh admin data");
    }
  };

  const handleGenerateReport = async () => {
    setReportBusy(true);
    try {
      const { data } = await reportAPI.generate({ reportType: "complaints" });
      toast.success("Report generated");
      setPanelData((prev) => ({
        ...prev,
        reports: [data.report, ...prev.reports].filter(Boolean).slice(0, 5)
      }));
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to generate report");
    } finally {
      setReportBusy(false);
    }
  };

  const handleResolveAlert = async (alertId) => {
    setAlertBusyId(alertId);
    try {
      await alertAPI.resolve(alertId);
      toast.success("Alert resolved");
      await refreshAdminExtras();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to resolve alert");
    } finally {
      setAlertBusyId(null);
    }
  };

  const selectedTender = useMemo(
    () => {
      const tenders = asList(panelData.tenders);
      return tenders.find((tender) => String(tender.id || tender._id) === String(selectedTenderId)) || tenders[0] || null;
    },
    [panelData.tenders, selectedTenderId]
  );

  const handleTenderFileChange = (event) => {
    setBidFiles(Array.from(event.target.files || []));
  };

  const handleProgressFileChange = (event) => {
    setProgressFiles(Array.from(event.target.files || []));
  };

  const handleBidSubmit = async (event) => {
    event.preventDefault();
    if (!selectedTender) {
      toast.error("Pick a tender first");
      return;
    }

    setBidBusy(true);
    try {
      const payload = new FormData();
      payload.append("amount", bidForm.amount);
      payload.append("proposedStartDate", bidForm.proposedStartDate);
      payload.append("proposedEndDate", bidForm.proposedEndDate);
      payload.append("durationDays", bidForm.durationDays);
      payload.append("proposal", bidForm.proposal);
      bidFiles.forEach((file) => payload.append("documents", file));

      await contractorAPI.submitBid(selectedTender.id || selectedTender._id, payload);
      toast.success("Bid submitted");
      setBidForm({
        amount: "",
        proposedStartDate: "",
        proposedEndDate: "",
        durationDays: "",
        proposal: ""
      });
      setBidFiles([]);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to submit bid");
    } finally {
      setBidBusy(false);
    }
  };

  const handleProgressSubmit = async (event) => {
    event.preventDefault();
    if (!selectedProject) {
      toast.error("Pick a project first");
      return;
    }

    setProgressBusy(true);
    try {
      const payload = new FormData();
      payload.append("title", progressForm.title);
      payload.append("description", progressForm.description);
      payload.append("percentageComplete", progressForm.percentageComplete);
      payload.append("updateType", progressForm.updateType);
      progressFiles.forEach((file) => payload.append("images", file));

      await contractorAPI.updateProgress(selectedProject.id || selectedProject._id, payload);
      toast.success("Progress updated");
      setProgressForm({
        title: "",
        description: "",
        percentageComplete: "",
        updateType: "weekly"
      });
      setProgressFiles([]);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update progress");
    } finally {
      setProgressBusy(false);
    }
  };

  const handleVoteComplaint = async (complaintId, voteValue) => {
    setVoteBusyId(complaintId);
    try {
      await citizenAPI.voteComplaint(complaintId, { voteValue });
      toast.success("Vote recorded");
      const { data } = await citizenAPI.getWardComplaints();
      const complaints = data.complaints || [];
      setPanelData((prev) => ({
        ...prev,
        complaints: asList(complaints)
      }));
      if (!complaints.some((item) => String(item.id || item._id) === String(selectedComplaintId))) {
        setSelectedComplaintId(complaints[0] ? complaints[0].id || complaints[0]._id : null);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to record vote");
    } finally {
      setVoteBusyId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">UrbanGrid</p>
          <h1 className="mt-2 text-3xl font-semibold">{config.heading}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{config.subtitle}</p>
          <div className="mt-4 inline-flex items-center rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            Ward No: {wardLabel}
          </div>
        </div>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {config.cards.map((card) => (
            <div key={card.key} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-medium text-muted-foreground">{card.label}</h2>
              <p className="mt-3 text-4xl font-semibold">{loading ? "--" : stats[card.key] ?? 0}</p>
            </div>
          ))}
        </section>

        {user?.role === "admin" && (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Reports</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Generate and review backend reports for complaints, tenders, projects, and alerts.
                  </p>
                </div>
                <Button onClick={handleGenerateReport} disabled={reportBusy}>
                  {reportBusy ? "Generating..." : "Generate Report"}
                </Button>
              </div>
              <div className="mt-5 space-y-3">
                {panelData.reports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reports yet.</p>
                ) : (
                  panelData.reports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between rounded-xl border border-border/60 p-4">
                      <div>
                        <p className="font-medium capitalize">{report.reportType}</p>
                        <p className="text-xs text-muted-foreground">Generated {formatDate(report.generatedAt)}</p>
                      </div>
                      <Badge variant="secondary">#{report.id}</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Alerts</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Operational warnings and critical workflow alerts.
                  </p>
                </div>
                <Button variant="outline" onClick={refreshAdminExtras}>
                  Refresh
                </Button>
              </div>
              <div className="mt-5 space-y-3">
                {panelData.alerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No alerts yet.</p>
                ) : (
                  panelData.alerts.map((alert) => (
                    <div key={alert.id} className="rounded-xl border border-border/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className={statusTone(alert.status)}>{alert.status}</Badge>
                            <Badge variant="outline">{alert.alertLevel}</Badge>
                          </div>
                          <p className="mt-2 text-sm">{alert.message}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Source: {alert.sourceType} #{alert.sourceId ?? "N/A"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={alert.status === "resolved" || alertBusyId === alert.id}
                          onClick={() => handleResolveAlert(alert.id)}
                        >
                          {alertBusyId === alert.id ? "..." : alert.status === "resolved" ? "Resolved" : "Resolve"}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {user?.role === "citizen" && (
          <section className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Your Ward</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    File complaints, vote on priorities, and track the ward-level complaint flow.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link to="/complaints/new">File Complaint</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="#ward-complaints">View Ward Complaints</a>
                  </Button>
                </div>
              </div>
            </div>

            <div id="ward-complaints">
              <WardComplaintsPanel
                wardNo={wardLabel}
                complaints={panelData.complaints}
                selectedComplaintId={selectedComplaintId}
                onSelectComplaint={setSelectedComplaintId}
                onVoteComplaint={handleVoteComplaint}
                voteBusyId={voteBusyId}
                loading={loading}
              />
            </div>
          </section>
        )}

        {(user?.role === "contractor" || user?.role === "regional_manager") && (
          <section className="grid gap-6 lg:grid-cols-2">
            <div id="recent-complaints" className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Projects</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pick a project to inspect its milestone trail.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {panelData.projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No projects yet.</p>
                ) : (
                  panelData.projects.map((project) => {
                    const projectId = project.id || project._id;
                    const active = String(projectId) === String(selectedProject?.id || selectedProject?._id);
                    return (
                      <button
                        type="button"
                        key={projectId}
                        className={`w-full rounded-xl border p-4 text-left transition ${
                          active ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"
                        }`}
                        onClick={async () => {
                          const milestones = await (async () => {
                            try {
                              const { data } = await projectAPI.getMilestones(projectId);
                              return data.milestones || [];
                            } catch {
                              return [];
                            }
                          })();

                          setPanelData((prev) => ({
                            ...prev,
                            selectedProjectId: projectId,
                            milestones
                          }));
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{project.title || project.projectId || `Project ${projectId}`}</p>
                            <p className="text-xs text-muted-foreground">
                              Status: {project.status || "unknown"} | Updated {formatDate(project.updatedAt || project.createdAt)}
                            </p>
                          </div>
                          <Badge className={statusTone(project.status)}>{project.status || "unknown"}</Badge>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Milestones</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedProject
                  ? `Current project: ${selectedProject.title || selectedProject.projectId || selectedProject.id}`
                  : "Select a project to see milestones."}
              </p>
              <div className="mt-5 space-y-3">
                {panelData.milestones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No milestones recorded yet.</p>
                ) : (
                  panelData.milestones.map((milestone, index) => (
                    <div key={`${milestone.title || "milestone"}-${index}`} className="rounded-xl border border-border/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{milestone.title || `Milestone ${index + 1}`}</p>
                          <p className="text-xs text-muted-foreground">{milestone.description || "No description"}</p>
                        </div>
                        <Badge className="bg-slate-500/15 text-slate-700">{milestone.status || "pending"}</Badge>
                      </div>
                      {milestone.deadline && (
                        <p className="mt-2 text-xs text-muted-foreground">Deadline: {formatDate(milestone.deadline)}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {user?.role === "contractor" && (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Place a Bid</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Select a tender and submit your proposal, cost, timeline, and supporting documents.
                  </p>
                </div>
                <Badge variant="outline">{panelData.tenders.length} open</Badge>
              </div>

              <div className="mt-5 space-y-3">
                {panelData.tenders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tenders available to bid on.</p>
                ) : (
                  panelData.tenders.map((tender) => {
                    const tenderId = tender.id || tender._id;
                    const active = String(tenderId) === String(selectedTender?.id || selectedTender?._id);
                    return (
                      <button
                        key={tenderId}
                        type="button"
                        className={`w-full rounded-xl border p-4 text-left transition ${
                          active ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"
                        }`}
                        onClick={() => setSelectedTenderId(tenderId)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{tender.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {tender.tenderId || tenderId} | {tender.complaint?.title || "No complaint title"}
                            </p>
                          </div>
                          <Badge className={statusTone(tender.status)}>{tender.status}</Badge>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <form className="mt-6 space-y-4" onSubmit={handleBidSubmit}>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
                  {selectedTender ? (
                    <>
                      <p className="font-medium">Selected tender: {selectedTender.title}</p>
                      <p className="mt-1 text-muted-foreground">
                        Budget {selectedTender.estimatedBudget ? `Rs. ${selectedTender.estimatedBudget}` : "N/A"}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Select a tender above to start bidding.</p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Bid Amount</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={bidForm.amount}
                      onChange={(event) => setBidForm((prev) => ({ ...prev, amount: event.target.value }))}
                      placeholder="Your quoted amount"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Timeline Days</span>
                    <Input
                      type="number"
                      min="1"
                      value={bidForm.durationDays}
                      onChange={(event) => setBidForm((prev) => ({ ...prev, durationDays: event.target.value }))}
                      placeholder="Estimated days"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Start Date</span>
                    <Input
                      type="date"
                      value={bidForm.proposedStartDate}
                      onChange={(event) => setBidForm((prev) => ({ ...prev, proposedStartDate: event.target.value }))}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">End Date</span>
                    <Input
                      type="date"
                      value={bidForm.proposedEndDate}
                      onChange={(event) => setBidForm((prev) => ({ ...prev, proposedEndDate: event.target.value }))}
                    />
                  </label>
                </div>

                <label className="space-y-2 block">
                  <span className="text-sm font-medium">Proposal</span>
                  <textarea
                    rows={4}
                    value={bidForm.proposal}
                    onChange={(event) => setBidForm((prev) => ({ ...prev, proposal: event.target.value }))}
                    className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Explain your plan, materials, and approach"
                  />
                </label>

                <label className="space-y-2 block">
                  <span className="text-sm font-medium">Supporting Documents</span>
                  <Input type="file" multiple onChange={handleTenderFileChange} />
                  {bidFiles.length > 0 && (
                    <p className="text-xs text-muted-foreground">{bidFiles.length} file(s) selected</p>
                  )}
                </label>

                <Button type="submit" className="w-full" disabled={bidBusy || !selectedTender}>
                  {bidBusy ? "Submitting Bid..." : "Submit Bid"}
                </Button>
              </form>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Update Progress</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pick a project and share progress with photos, milestones, and percentage complete.
                  </p>
                </div>
              </div>

              <form className="mt-6 space-y-4" onSubmit={handleProgressSubmit}>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
                  {selectedProject ? (
                    <>
                      <p className="font-medium">Selected project: {selectedProject.title || selectedProject.id}</p>
                      <p className="mt-1 text-muted-foreground">Status: {selectedProject.status || "unknown"}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No project selected.</p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Update Title</span>
                    <Input
                      value={progressForm.title}
                      onChange={(event) => setProgressForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Weekly progress update"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Update Type</span>
                    <select
                      value={progressForm.updateType}
                      onChange={(event) => setProgressForm((prev) => ({ ...prev, updateType: event.target.value }))}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="milestone">Milestone</option>
                      <option value="issue">Issue</option>
                      <option value="completion">Completion</option>
                    </select>
                  </label>
                </div>

                <label className="space-y-2 block">
                  <span className="text-sm font-medium">Progress Description</span>
                  <textarea
                    rows={4}
                    value={progressForm.description}
                    onChange={(event) => setProgressForm((prev) => ({ ...prev, description: event.target.value }))}
                    className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Describe what has been completed"
                  />
                </label>

                <label className="space-y-2 block">
                  <span className="text-sm font-medium">Percentage Complete</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={progressForm.percentageComplete}
                    onChange={(event) => setProgressForm((prev) => ({ ...prev, percentageComplete: event.target.value }))}
                    placeholder="0 to 100"
                  />
                </label>

                <label className="space-y-2 block">
                  <span className="text-sm font-medium">Progress Images</span>
                  <Input type="file" multiple accept="image/*" onChange={handleProgressFileChange} />
                  {progressFiles.length > 0 && (
                    <p className="text-xs text-muted-foreground">{progressFiles.length} image(s) selected</p>
                  )}
                </label>

                <Button type="submit" className="w-full" disabled={progressBusy || !selectedProject}>
                  {progressBusy ? "Updating..." : "Update Progress"}
                </Button>
              </form>
            </div>
          </section>
        )}

        {(user?.role === "ministry_officer" || user?.role === "department_head" || user?.role === "senior_official" || user?.role === "regional_manager") && (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">
                {user?.role === "regional_manager" ? "Regional Complaints" : "Recent Routed Complaints"}
              </h2>
              <div className="mt-5 space-y-3">
                {panelData.complaints.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No records yet.</p>
                ) : (
                  panelData.complaints.map((item) => (
                    <div key={item.id || item._id} className="rounded-xl border border-border/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.complaintId || item.id} | {formatDate(item.submittedAt || item.createdAt)}
                          </p>
                        </div>
                        <Badge className={statusTone(item.status)}>{item.status}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">
                {user?.role === "contractor"
                  ? "Available Tenders"
                  : user?.role === "senior_official"
                    ? "Pending / Recent Tenders"
                    : "Recent Tenders"}
              </h2>
              <div className="mt-5 space-y-3">
                {panelData.tenders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tenders yet.</p>
                ) : (
                  panelData.tenders.map((tender) => (
                    <div key={tender.id || tender._id} className="rounded-xl border border-border/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{tender.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {tender.tenderId || tender.id} | Budget {tender.estimatedBudget ? `Rs. ${tender.estimatedBudget}` : "N/A"}
                          </p>
                        </div>
                        <Badge className={statusTone(tender.status)}>{tender.status}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

      </div>
    </DashboardLayout>
  );
}
