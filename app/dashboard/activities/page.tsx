"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";

const INTERACTIONS = ["Visit","Call","WhatsApp","Email","Meeting","Site Visit"];

type Activity = {
  id: string; activity_code: string; activity_date: string;
  rep_name: string; company_name: string; company_type: string | null;
  contact_person: string | null; interaction_type: string | null;
  project_name: string | null; region: string | null;
  sqm_done: number; sqm_expected: number;
  submission_status: string | null; notes: string | null;
  submitted_at: string;
};

type Rep = { id: string; name: string };

const STATUS_STYLE: Record<string, string> = {
  on_time: "bg-green-100 text-green-800",
  late:    "bg-amber-100 text-amber-800",
  missing: "bg-red-100 text-red-700",
};

export default function ManagerActivitiesPage() {
  const supabase = createClient();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reps, setReps]             = useState<Rep[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterRep, setFilterRep]   = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");
  const [search, setSearch]         = useState("");
  const [expanded, setExpanded]     = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [actRes, repRes] = await Promise.all([
      supabase.from("activities")
        .select("id,activity_code,activity_date,rep_name,company_name,company_type,contact_person,interaction_type,project_name,region,sqm_done,sqm_expected,submission_status,notes,submitted_at")
        .order("activity_date", { ascending: false })
        .order("submitted_at", { ascending: false })
        .limit(500),
      supabase.from("reps").select("id,name").in("role",["rep","marketing"]).eq("status","active").order("name"),
    ]);
    setActivities(actRes.data ?? []);
    setReps(repRes.data ?? []);
    setLoading(false);
  }

  const filtered = activities.filter(a => {
    const q = search.toLowerCase();
    return (
      (!search       || (a.company_name||"").toLowerCase().includes(q) || (a.project_name||"").toLowerCase().includes(q) || (a.rep_name||"").toLowerCase().includes(q)) &&
      (!filterRep    || a.rep_name === filterRep) &&
      (!filterType   || a.interaction_type === filterType) &&
      (!filterStatus || a.submission_status === filterStatus) &&
      (!dateFrom     || a.activity_date >= dateFrom) &&
      (!dateTo       || a.activity_date <= dateTo)
    );
  });

  const totalSqm = filtered.reduce((s, a) => s + (a.sqm_done ?? 0), 0);

  function clearFilters() {
    setSearch(""); setFilterRep(""); setFilterType("");
    setFilterStatus(""); setDateFrom(""); setDateTo("");
  }

  const hasFilters = search || filterRep || filterType || filterStatus || dateFrom || dateTo;

function exportCSV() {
    const headers = ["Date","Rep","Company","Project","Type","Region","SQM Done","SQM Expected","Status"];
    const rows = filtered.map(a => [
      a.activity_date, a.rep_name, a.company_name, a.project_name ?? "",
      a.interaction_type ?? "", a.region ?? "", a.sqm_done, a.sqm_expected,
      a.submission_status ?? ""
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => JSON.stringify(v)).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "activities.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activities</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? "—" : `${filtered.length} activities · ${totalSqm.toLocaleString()} SQM total`}
          </p>
        </div>
        <button onClick={exportCSV} disabled={filtered.length===0} className="btn-secondary text-sm flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <input className="input max-w-xs" placeholder="Search company, project, rep…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input w-44" value={filterRep} onChange={e => setFilterRep(e.target.value)}>
            <option value="">All Reps</option>
            {reps.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
          </select>
          <select className="input w-44" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            {INTERACTIONS.map(i => <option key={i}>{i}</option>)}
          </select>
          <select className="input w-36" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="on_time">On Time</option>
            <option value="late">Late</option>
            <option value="missing">Missing</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
            <input type="date" className="input w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
            <input type="date" className="input w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="btn-secondary text-sm px-3">Clear filters</button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card p-10 text-center text-gray-400">Loading activities…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">No activities match your filters.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Rep</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">SQM</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(a => (
                <>
                  <tr key={a.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.activity_date}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{a.rep_name}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{a.company_name}</div>
                      {a.project_name && <div className="text-xs text-gray-400">{a.project_name}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{a.interaction_type || "—"}</td>
                    <td className="px-4 py-3">
                      {a.sqm_done > 0 && <div className="text-green-700 font-medium">{a.sqm_done.toLocaleString()} done</div>}
                      {a.sqm_expected > 0 && <div className="text-gray-400 text-xs">{a.sqm_expected.toLocaleString()} exp</div>}
                      {!a.sqm_done && !a.sqm_expected && <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {a.submission_status ? (
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[a.submission_status] ?? "bg-gray-100 text-gray-600"}`}>
                          {a.submission_status.replace("_"," ")}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {(a.notes || a.contact_person || a.region) && (
                        <button onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                          className="text-brand-blue hover:underline text-xs">
                          {expanded === a.id ? "Hide" : "View"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === a.id && (
                    <tr key={`${a.id}-exp`} className="bg-blue-50/30">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex flex-wrap gap-6 text-sm text-gray-600">
                          {a.contact_person && <span>👤 {a.contact_person}</span>}
                          {a.region         && <span>📍 {a.region}</span>}
                          {a.company_type   && <span>📁 {a.company_type}</span>}
                        </div>
                        {a.notes && <p className="mt-2 text-sm text-gray-600 italic">"{a.notes}"</p>}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
            Showing {filtered.length} of {activities.length} activities · Total SQM done: {totalSqm.toLocaleString()} m²
          </div>
        </div>
      )}
    </div>
  );
}
