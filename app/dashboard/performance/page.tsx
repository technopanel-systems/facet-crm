"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, subMonths } from "date-fns";

type Rep = {
  id: string; name: string; role: string;
  monthly_target_sqm: number; status: string;
};

type Activity = {
  rep_id: string; sqm_done: number; sqm_expected: number;
  interaction_type: string | null; submission_status: string | null;
  company_name: string; activity_date: string;
};

type Quotation = {
  rep_id: string | null; assigned_to_id: string | null;
  status: string; sqm_quoted: number; sqm_invoiced: number;
};

type Project = {
  assigned_rep_id: string | null; stage: string; quoted_sqm: number;
};

const STAGE_COLOR: Record<string,string> = {
  "New Lead":       "bg-gray-100 text-gray-700",
  "Catalog Sent":   "bg-blue-50 text-blue-700",
  "Quotation Sent": "bg-indigo-100 text-indigo-700",
  "Under Review":   "bg-amber-100 text-amber-700",
  "Won":            "bg-green-100 text-green-800",
  "In Production":  "bg-teal-100 text-teal-700",
  "Delivered":      "bg-emerald-100 text-emerald-700",
  "Lost":           "bg-red-100 text-red-700",
};

const STATUS_STYLE: Record<string,string> = {
  pending:   "bg-amber-100 text-amber-800",
  submitted: "bg-blue-100 text-blue-700",
  won:       "bg-green-100 text-green-800",
  lost:      "bg-red-100 text-red-700",
  expired:   "bg-gray-100 text-gray-500",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function PerformancePage() {
  const supabase = createClient();
  const [reps, setReps]             = useState<Rep[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [projects, setProjects]     = useState<Project[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedRep, setSelectedRep]     = useState<Rep | null>(null);

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });

  useEffect(() => { load(); }, [selectedMonth]);

  async function load() {
    setLoading(true);
    const [year, month] = selectedMonth.split("-").map(Number);
    const monthStart = `${selectedMonth}-01`;
    const nextMonth  = month === 12
      ? `${year+1}-01-01`
      : `${year}-${String(month+1).padStart(2,"0")}-01`;

    const [repsRes, actRes, quotRes, projRes] = await Promise.all([
      supabase.from("reps").select("id,name,role,monthly_target_sqm,status")
        .in("role",["rep","marketing"]).eq("status","active").order("name"),
      supabase.from("activities")
        .select("rep_id,sqm_done,sqm_expected,interaction_type,submission_status,company_name,activity_date")
        .gte("activity_date", monthStart)
        .lt("activity_date", nextMonth),
      supabase.from("quotations")
        .select("rep_id,assigned_to_id,status,sqm_quoted,sqm_invoiced"),
      supabase.from("projects")
        .select("assigned_rep_id,stage,quoted_sqm"),
    ]);

    setReps(repsRes.data ?? []);
    setActivities(actRes.data ?? []);
    setQuotations(quotRes.data ?? []);
    setProjects(projRes.data ?? []);
    setLoading(false);
  }

  function getRepStats(rep: Rep) {
    const repActs = activities.filter(a => a.rep_id === rep.id);
    const repQuots = quotations.filter(q =>
      q.rep_id === rep.id || q.assigned_to_id === rep.id
    );
    const repProjs = projects.filter(p => p.assigned_rep_id === rep.id);

    const totalSqm    = repActs.reduce((s,a) => s+(a.sqm_done??0), 0);
    const pipelineSqm = repActs.reduce((s,a) => s+(a.sqm_expected??0), 0);
    const target      = rep.monthly_target_sqm ?? 0;
    const pct         = target > 0 ? Math.min(100, Math.round((totalSqm/target)*100)) : 0;

    const onTime  = repActs.filter(a => a.submission_status === "on_time").length;
    const late    = repActs.filter(a => a.submission_status === "late").length;
    const missing = repActs.filter(a => a.submission_status === "missing").length;
    const compliance = repActs.length > 0 ? Math.round((onTime/repActs.length)*100) : 0;

    const wonQuots = repQuots.filter(q => q.status === "won");
    const sqmInvoiced = repQuots.reduce((s,q) => s+(q.sqm_invoiced??0), 0);
    const winRate = repQuots.length > 0 ? Math.round((wonQuots.length/repQuots.length)*100) : 0;

    const interactionMap: Record<string,number> = {};
    repActs.forEach(a => {
      if (a.interaction_type) interactionMap[a.interaction_type] = (interactionMap[a.interaction_type]??0)+1;
    });

    const stageMap: Record<string,number> = {};
    repProjs.forEach(p => { stageMap[p.stage] = (stageMap[p.stage]??0)+1; });

    const companyMap: Record<string,number> = {};
    repActs.forEach(a => { companyMap[a.company_name] = (companyMap[a.company_name]??0)+1; });
    const topCompanies = Object.entries(companyMap).sort((a,b) => b[1]-a[1]).slice(0,5);

    const quotStatusMap: Record<string,number> = {};
    repQuots.forEach(q => { quotStatusMap[q.status] = (quotStatusMap[q.status]??0)+1; });

    return {
      totalSqm, pipelineSqm, target, pct,
      onTime, late, missing, compliance,
      activityCount: repActs.length,
      wonQuots: wonQuots.length, quotCount: repQuots.length,
      sqmInvoiced, winRate,
      interactionMap, stageMap, topCompanies, quotStatusMap,
      activeProjects: repProjs.filter(p => !["Won","Delivered","Lost"].includes(p.stage)).length,
    };
  }

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>;

  // Overview table view
  if (!selectedRep) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rep Performance</h1>
            <p className="text-gray-500 text-sm mt-1">Monthly KPIs across all reps</p>
          </div>
          <select className="input w-44" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
            {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        {/* Summary cards */}
        <div className="card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3">Rep</th>
                <th className="px-5 py-3">SQM Progress</th>
                <th className="px-5 py-3">Activities</th>
                <th className="px-5 py-3">Compliance</th>
                <th className="px-5 py-3">Quotations</th>
                <th className="px-5 py-3">Win Rate</th>
                <th className="px-5 py-3">SQM Invoiced</th>
                <th className="px-5 py-3">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reps.map(rep => {
                const s = getRepStats(rep);
                return (
                  <tr key={rep.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-900">{rep.name}</div>
                      <div className="text-xs text-gray-400 capitalize">{rep.role}</div>
                    </td>
                    <td className="px-5 py-4 min-w-[160px]">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{s.totalSqm.toLocaleString()} m²</span>
                        <span>{s.pct}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${s.pct>=100?"bg-green-500":s.pct>=60?"bg-brand-blue":s.pct>=30?"bg-amber-500":"bg-red-400"}`}
                          style={{ width:`${s.pct}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Target: {s.target.toLocaleString()}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900">{s.activityCount}</div>
                      <div className="text-xs text-gray-400">{s.onTime} on time · {s.late} late</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-sm font-bold ${s.compliance>=80?"text-green-600":s.compliance>=50?"text-amber-600":"text-red-500"}`}>
                        {s.activityCount > 0 ? `${s.compliance}%` : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900">{s.quotCount}</div>
                      <div className="text-xs text-gray-400">{s.wonQuots} won</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-sm font-bold ${s.winRate>=50?"text-green-600":s.winRate>=25?"text-amber-600":"text-gray-500"}`}>
                        {s.quotCount > 0 ? `${s.winRate}%` : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-brand-blue">
                        {s.sqmInvoiced > 0 ? `${s.sqmInvoiced.toLocaleString()} m²` : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => setSelectedRep(rep)}
                        className="text-brand-blue hover:underline text-xs font-medium"
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Drill-down view for a single rep
  const s = getRepStats(selectedRep);
  const interactionTotal = Object.values(s.interactionMap).reduce((a,b) => a+b, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedRep(null)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            All Reps
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{selectedRep.name}</h1>
            <p className="text-gray-500 text-sm">{selectedMonth}</p>
          </div>
        </div>
        <select className="input w-44" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
          {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {/* SQM Progress bar */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-700">SQM Progress</div>
          <div className="text-sm text-gray-500">{s.totalSqm.toLocaleString()} / {s.target.toLocaleString()} m²</div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
          <div
            className={`h-3 rounded-full transition-all ${s.pct>=100?"bg-green-500":s.pct>=60?"bg-brand-blue":s.pct>=30?"bg-amber-500":"bg-red-400"}`}
            style={{ width:`${s.pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>{s.pct}% of target</span>
          {s.pipelineSqm > 0 && <span>{s.pipelineSqm.toLocaleString()} m² in pipeline</span>}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:"Activities",  value:s.activityCount,         color:"text-brand-blue" },
          { label:"On Time",     value:s.onTime,                color:"text-green-600" },
          { label:"Late",        value:s.late,                  color:"text-amber-600" },
          { label:"Compliance",  value:s.activityCount>0?`${s.compliance}%`:"—", color:s.compliance>=80?"text-green-600":"text-red-500" },
        ].map(k => (
          <div key={k.label} className="card px-4 py-4 text-center">
            <div className="text-xs text-gray-500 mb-1">{k.label}</div>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Quotation KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:"Total Quotes",  value:s.quotCount,             color:"text-gray-700" },
          { label:"Won",           value:s.wonQuots,              color:"text-green-600" },
          { label:"Win Rate",      value:s.quotCount>0?`${s.winRate}%`:"—", color:s.winRate>=50?"text-green-600":"text-amber-600" },
          { label:"SQM Invoiced",  value:`${s.sqmInvoiced.toLocaleString()}`, color:"text-brand-blue" },
        ].map(k => (
          <div key={k.label} className="card px-4 py-4 text-center">
            <div className="text-xs text-gray-500 mb-1">{k.label}</div>
            <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Interaction breakdown */}
        <div className="card p-5">
          <div className="font-semibold text-gray-900 text-sm mb-4">Interaction Types</div>
          {interactionTotal === 0 ? (
            <p className="text-gray-400 text-sm">No activities this month.</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(s.interactionMap).sort((a,b) => b[1]-a[1]).map(([type,count]) => {
                const pct = Math.round((count/interactionTotal)*100);
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{type}</span>
                      <span className="text-gray-500">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-brand-blue" style={{ width:`${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Projects by stage */}
        <div className="card p-5">
          <div className="font-semibold text-gray-900 text-sm mb-4">Projects by Stage</div>
          {Object.keys(s.stageMap).length === 0 ? (
            <p className="text-gray-400 text-sm">No projects assigned.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(s.stageMap).sort((a,b) => b[1]-a[1]).map(([stage,count]) => (
                <div key={stage} className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLOR[stage]??"bg-gray-100 text-gray-700"}`}>
                    {stage}
                  </span>
                  <span className="text-sm font-semibold text-gray-700">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quotation status */}
        {s.quotCount > 0 && (
          <div className="card p-5">
            <div className="font-semibold text-gray-900 text-sm mb-4">Quotation Status</div>
            <div className="space-y-2">
              {Object.entries(s.quotStatusMap).sort((a,b) => b[1]-a[1]).map(([status,count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[status]??"bg-gray-100 text-gray-600"}`}>
                    {status}
                  </span>
                  <span className="text-sm font-semibold text-gray-700">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top companies */}
        {s.topCompanies.length > 0 && (
          <div className="card p-5">
            <div className="font-semibold text-gray-900 text-sm mb-4">Most Active Companies</div>
            <div className="space-y-2">
              {s.topCompanies.map(([name,count],i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-bold flex-shrink-0">
                    {i+1}
                  </span>
                  <span className="flex-1 text-sm text-gray-800 truncate">{name}</span>
                  <span className="text-xs text-gray-500">{count} activities</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
