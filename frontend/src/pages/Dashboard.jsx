import { useEffect, useState } from "react";
import DashboardLayout from "@/layouts/dashboard-layout";
import { useAuth } from "@/contexts/AuthContext";
import { adminAPI, citizenAPI, contractorAPI, ministryAPI, regionAPI, approvalAPI } from "@/lib/api";

const roleCopy = {
  citizen: {
    heading: "Resident Dashboard",
    subtitle: "Track your complaints and city issue resolution timeline.",
    cards: [
      { label: "My Complaints", key: "totalComplaints" },
      { label: "In Review", key: "inReview" },
      { label: "In Progress", key: "inProgress" }
    ]
  },
  contractor: {
    heading: "Contractor Dashboard",
    subtitle: "Review bids, available tenders, and execution progress.",
    cards: [
      { label: "Available Tenders", key: "availableTenders" },
      { label: "My Bids", key: "myBids" },
      { label: "My Projects", key: "myProjects" }
    ]
  },
  admin: {
    heading: "Admin Dashboard",
    subtitle: "Monitor complaint verification and workflow throughput.",
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
    subtitle: "Monitor region-level complaints and projects.",
    cards: [
      { label: "Regional Projects", key: "regionalProjects" },
      { label: "Regional Complaints", key: "regionalComplaints" },
      { label: "Active Projects", key: "activeRegionalProjects" }
    ]
  }
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const config = roleCopy[user?.role] || roleCopy.citizen;

  useEffect(() => {
    let alive = true;

    const loadData = async () => {
      setLoading(true);
      try {
        if (user?.role === "citizen") {
          const { data } = await citizenAPI.getMyComplaints();
          const complaints = data.complaints || [];
          if (!alive) return;
          setStats({
            totalComplaints: complaints.length,
            inReview: complaints.filter((item) => item.status === "under_review").length,
            inProgress: complaints.filter((item) => item.status === "in_progress").length
          });
        } else if (user?.role === "contractor") {
          const [tendersRes, bidsRes, projectsRes] = await Promise.all([
            contractorAPI.getAvailableTenders(),
            contractorAPI.getMyBids(),
            contractorAPI.getMyProjects()
          ]);
          if (!alive) return;
          setStats({
            availableTenders: tendersRes.data.tenders?.length || 0,
            myBids: bidsRes.data.bids?.length || 0,
            myProjects: projectsRes.data.projects?.length || 0
          });
        } else if (user?.role === "admin") {
          const { data } = await adminAPI.getDashboardStats();
          if (!alive) return;
          setStats(data.stats || {});
        } else if (user?.role === "regional_manager") {
          const [projectsRes, complaintsRes] = await Promise.all([
            regionAPI.getProjects(),
            regionAPI.getComplaints()
          ]);
          const projects = projectsRes.data.projects || [];
          if (!alive) return;
          setStats({
            regionalProjects: projects.length,
            regionalComplaints: complaintsRes.data.complaints?.length || 0,
            activeRegionalProjects: projects.filter((item) => item.status === "in_progress").length
          });
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
        }
      } catch (error) {
        if (!alive) return;
        setStats({});
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      alive = false;
    };
  }, [user?.role]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">UrbanGrid</p>
          <h1 className="mt-2 text-3xl font-semibold">{config.heading}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{config.subtitle}</p>
        </div>
        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {config.cards.map((card) => (
            <div key={card.key} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-sm font-medium text-muted-foreground">{card.label}</h2>
              <p className="mt-3 text-4xl font-semibold">{loading ? "--" : stats[card.key] ?? 0}</p>
            </div>
          ))}
        </section>
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Role Access Summary</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Profile and Settings are available for all roles. Dashboard widgets adapt to your role and current backend data.
          </p>
        </section>
      </div>
    </DashboardLayout>
  );
}
