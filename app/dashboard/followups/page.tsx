"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, isToday, isPast, differenceInDays } from "date-fns";

type Rep = { id: string; name: string };

type Project = {
  id: string;
  project_code: string;
  project_name: string | null;
  stage: string;
  quoted_sqm: number;
  project_date: string | null;
  assigned_rep_id: string | null;
  companies: any;
};

const STAGE_COLOR: Record<string, string> = {
  "New Lead":       "bg-gray-100 text-gray-700",
  "Catalog Sent":   "bg-blue-50 text-blue-700",
  "Quotation Sent": "bg-indigo-100 text-indigo-700",
  "Under Review":   "bg-amber-100 text-amber-700",
  "Won":            "bg-green-100 text-green-800",
  "In Production":  "bg-teal-100 text-teal-700",
  "Delivered":      "bg-emerald-100 text-emerald-700",
  "Lost":           "bg-red-100 text-red-700",
};

const ACTIVE_STAGES = ["New Lead","Catalog Sent","Quotation Sent","Under Review","In Production"];

export default function FollowupsPage() {
  const supabase = createClient();
  const [projects, setProjects] = useState<Project[]>([]);
  const [reps, setReps]         = useState<Rep[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterRep, setFilterRep] = useState("");
  const [filterUrgency, setFilterUrgency] = useState("all");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");

    const [projRes, repRes] = await Promise.all([
      supabase.from("projects")
        .select("id,project_code,project_name,stage,quoted_sqm,project_date,assigned_rep_id,companies(company_name)")
        .in("stage", ACTIVE_STAGES)
        .not("project_date", "is", null)
        .lte("project_date", today)
        .order("project_date", { ascending: true }),
      supabase.from("reps").select("id,name")
        .in("role",["rep","marketing"]).eq("status","active").order("name"),
    ]);

    setProjects((projRes.data ?? []) as unknown as Project[]);
    setReps(repRes.data ?? []);
    setLoading(false);
  }

  function getUrgency(dateStr: string): "today" | "overdue" | "old" {
    const d = new Date(dateStr + "T12:00:00");
    if (isToday(d)) return "today";
    const days = differenceInDays(new Date(), d);
    if (days <= 7) return "overdue";
    return "old";
  }

  function getUrgencyStyle(u: string) {
    if (u === "today")   return "bg-amber-100 text-amber-800";
    if (u === "overdue") return "bg-red-100 text-red-700";
    return "bg-red-200 text-red-900";
  }

  function getUrgencyLabel(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    if (isToday(d)) return "Due today";
    const days = differenceInDays(new Date(), d);
    return `${days}d overdue`;
  }

  const filtered = projects.filter(p => {
    const urgency = getUrgency(p.project_date!);
    return (
      (!filterRep || p.assigned_rep_id === filterRep) &&
      (filterUrgency === "all" ||
        (filterUrgency === "today" && urgency === "today") ||
        (filterUrgency === "overdue" && urgency !== "today"))
    );
  });

  // Group by rep
  const grouped = filtered.reduce<Record<string, Project[]>>((acc, p) => {
    const repId = p.assigned_rep_id ?? "unassigned";
    if (!acc[repId]) acc[repId] = [];
    acc[repId].push(p);
    return acc;
  }, {});

  const todayCount   = filtered.filter(p => getUrgency(p.project_date!) === "today").length;
  const overdueCount = filtered.filter(p => getUrgency(p.project_date!) !== "today").length;

  function getRepName(repId: string) {
    if (repId === "unassigned") return "Unassigned";
    return reps.find(r => r.id === repId)?.name ?? "Unknown";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Follow-ups Due</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? "—" : `${todayCount} due today · ${overdueCount} overdue`}
          </p>
        </div>
        <div className="flex gap-3">
          <select className="input w-44" value={filterRep} onChange={e => setFilterRep(e.target.value)}>
            <option value="">All Reps</option>
            {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select className="input w-40" value={filterUrgency} onChange={e => setFilterUrgency(e.target.value)}>
            <option value="all">All Due</option>
            <option value="today">Due Today</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Due Today",      value: todayCount,        color: "text-amber-600" },
            { label: "Overdue",        value: overdueCount,      color: "text-red-600"   },
            { label: "Total Projects", value: filtered.length,   color: "text-gray-700"  },
          ].map(c => (
            <div key={c.label} className="card px-5 py-4 text-center">
              <div className="text-xs text-gray-500 mb-1">{c.label}</div>
              <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="card p-10 text-center text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">✅</div>
          <div className="text-gray-600 font-medium">No follow-ups due</div>
          <div className="text-gray-400 text-sm mt-1">All active projects are on track</div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([repId, repProjects]) => (
            <div key={repId}>
              {/* Rep header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 rounded-full bg-brand-blue/10 flex items-center justify-center text-xs font-bold text-brand-blue flex-shrink-0">
                  {getRepName(repId).charAt(0)}
                </div>
                <div>
                  <span className="font-semibold text-gray-900">{getRepName(repId)}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    {repProjects.length} project{repProjects.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <div className="card divide-y divide-gray-50 overflow-hidden">
                {repProjects.map(p => {
                  const urgency    = getUrgency(p.project_date!);
                  const companyName = Array.isArray(p.companies)
                    ? p.companies[0]?.company_name
                    : p.companies?.company_name;
                  const daysLabel  = getUrgencyLabel(p.project_date!);

                  return (
                    <div key={p.id} className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={`/dashboard/projects/${p.id}`}
                            className="font-medium text-gray-900 hover:text-brand-blue transition-colors"
                          >
                            {p.project_name || "(No name)"}
                          </a>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLOR[p.stage] ?? "bg-gray-100 text-gray-700"}`}>
                            {p.stage}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getUrgencyStyle(urgency)}`}>
                            {daysLabel}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{companyName}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          Project date: {format(new Date(p.project_date! + "T12:00:00"), "dd MMM yyyy")}
                          {p.quoted_sqm > 0 && (
                            <span className="ml-3">{p.quoted_sqm.toLocaleString()} SQM quoted</span>
                          )}
                        </div>
                      </div>
                      <a
                        href={`/dashboard/projects/${p.id}`}
                        className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0"
                      >
                        View
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
