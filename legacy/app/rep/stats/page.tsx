"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, subMonths } from "date-fns";

type Rep = { id: string; name: string; monthly_target_sqm: number };
type Activity = { sqm_done: number; sqm_expected: number; interaction_type: string | null; submission_status: string | null; activity_date: string; company_name: string };
type Project  = { stage: string; quoted_sqm: number; project_name: string | null; companies: any };
type Quotation = { status: string; sqm_quoted: number; sqm_invoiced: number };

const STAGE_COLOR: Record<string,string> = {
  "New Lead":"bg-gray-100 text-gray-700","Catalog Sent":"bg-blue-50 text-blue-700",
  "Quotation Sent":"bg-indigo-100 text-indigo-700","Under Review":"bg-amber-100 text-amber-700",
  "Won":"bg-green-100 text-green-800","In Production":"bg-teal-100 text-teal-700",
  "Delivered":"bg-emerald-100 text-emerald-700","Lost":"bg-red-100 text-red-700",
};
const QUOT_STYLE: Record<string,string> = {
  pending:"bg-amber-100 text-amber-800",submitted:"bg-blue-100 text-blue-700",
  won:"bg-green-100 text-green-800",lost:"bg-red-100 text-red-700",
  expired:"bg-gray-100 text-gray-500",cancelled:"bg-gray-100 text-gray-500",
};

export default function RepStatsPage() {
  const supabase = createClient();
  const [rep, setRep]               = useState<Rep | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [projects, setProjects]     = useState<Project[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });

  useEffect(() => { load(); }, [selectedMonth]);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: repData } = await supabase.from("reps").select("id,name,monthly_target_sqm").eq("auth_user_id", user.id).single();
    if (!repData) return;
    setRep(repData);

    const [year, month] = selectedMonth.split("-").map(Number);
    const monthStart = `${selectedMonth}-01`;
    const nextMonth  = month === 12 ? `${year+1}-01-01` : `${year}-${String(month+1).padStart(2,"0")}-01`;

    const [actRes, projRes, quotRes] = await Promise.all([
      supabase.from("activities")
        .select("sqm_done,sqm_expected,interaction_type,submission_status,activity_date,company_name")
        .eq("rep_id", repData.id)
        .gte("activity_date", monthStart)
        .lt("activity_date", nextMonth),
      supabase.from("projects")
        .select("stage,quoted_sqm,project_name,companies(company_name)")
        .order("created_at", { ascending: false }),
      supabase.from("quotations")
        .select("status,sqm_quoted,sqm_invoiced")
        .or(`rep_id.eq.${repData.id},assigned_to_id.eq.${repData.id}`),
    ]);

    setActivities(actRes.data ?? []);
    setProjects((projRes.data ?? []) as unknown as Project[]);
    setQuotations(quotRes.data ?? []);
    setLoading(false);
  }

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>;
  if (!rep)    return <div className="p-8 text-gray-400">Rep not found.</div>;

  const target      = rep.monthly_target_sqm ?? 0;
  const totalSqm    = activities.reduce((s,a) => s+(a.sqm_done??0), 0);
  const pipelineSqm = activities.reduce((s,a) => s+(a.sqm_expected??0), 0);
  const pct         = target > 0 ? Math.min(100, Math.round((totalSqm/target)*100)) : 0;
  const onTime      = activities.filter(a => a.submission_status==="on_time").length;
  const late        = activities.filter(a => a.submission_status==="late").length;
  const compliance  = activities.length > 0 ? Math.round((onTime/activities.length)*100) : 0;

  const wonQ             = quotations.filter(q => q.status==="won");
  const totalSqmQuoted   = quotations.reduce((s,q) => s+(q.sqm_quoted??0), 0);
  const totalSqmInvoiced = quotations.reduce((s,q) => s+(q.sqm_invoiced??0), 0);
  const winRate          = quotations.length > 0 ? Math.round((wonQ.length/quotations.length)*100) : 0;

  const interactionMap: Record<string,number> = {};
  activities.forEach(a => { if(a.interaction_type) interactionMap[a.interaction_type]=(interactionMap[a.interaction_type]??0)+1; });
  const interactionTotal = Object.values(interactionMap).reduce((s,v) => s+v, 0);

  const stageMap: Record<string,number> = {};
  projects.forEach(p => { stageMap[p.stage]=(stageMap[p.stage]??0)+1; });

  const quotStatusMap: Record<string,number> = {};
  quotations.forEach(q => { quotStatusMap[q.status]=(quotStatusMap[q.status]??0)+1; });

  const companyMap: Record<string,number> = {};
  activities.forEach(a => { companyMap[a.company_name]=(companyMap[a.company_name]??0)+1; });
  const topCompanies = Object.entries(companyMap).sort((a,b) => b[1]-a[1]).slice(0,5);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Stats</h1>
          <p className="text-gray-500 text-sm mt-1">{rep.name}</p>
        </div>
        <select className="input w-44" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
          {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {/* SQM bar */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-700">SQM Progress</div>
          <div className="text-sm text-gray-500">{totalSqm.toLocaleString()} / {target.toLocaleString()} m²</div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
          <div className={`h-3 rounded-full transition-all ${pct>=100?"bg-green-500":pct>=60?"bg-brand-blue":pct>=30?"bg-amber-500":"bg-red-400"}`} style={{ width:`${pct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>{pct}% of target</span>
          {pipelineSqm>0 && <span>{pipelineSqm.toLocaleString()} m² in pipeline</span>}
        </div>
      </div>

      {/* Activity KPIs */}
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Activity — {selectedMonth}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label:"Activities", value:activities.length, color:"text-brand-blue" },
            { label:"On Time",    value:onTime,            color:"text-green-600" },
            { label:"Late",       value:late,              color:"text-amber-600" },
            { label:"Compliance", value:`${compliance}%`,  color:compliance>=80?"text-green-600":"text-red-500" },
          ].map(k => (
            <div key={k.label} className="card px-4 py-4 text-center">
              <div className="text-xs text-gray-500 mb-1">{k.label}</div>
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quotation KPIs */}
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Quotations — All Time</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label:"Total Quotes", value:quotations.length,                        color:"text-gray-700" },
            { label:"Won",          value:wonQ.length,                              color:"text-green-600" },
            { label:"Win Rate",     value:`${winRate}%`,                            color:winRate>=50?"text-green-600":"text-amber-600" },
            { label:"SQM Invoiced", value:`${totalSqmInvoiced.toLocaleString()}`,   color:"text-brand-blue" },
          ].map(k => (
            <div key={k.label} className="card px-4 py-4 text-center">
              <div className="text-xs text-gray-500 mb-1">{k.label}</div>
              <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Interaction breakdown */}
        <div className="card p-5">
          <div className="font-semibold text-gray-900 text-sm mb-4">Interaction Types</div>
          {interactionTotal===0 ? <p className="text-gray-400 text-sm">No activities this month.</p> : (
            <div className="space-y-2.5">
              {Object.entries(interactionMap).sort((a,b)=>b[1]-a[1]).map(([type,count]) => {
                const p = Math.round((count/interactionTotal)*100);
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1"><span className="text-gray-700">{type}</span><span className="text-gray-500">{count} ({p}%)</span></div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-brand-blue" style={{ width:`${p}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Project stages */}
        <div className="card p-5">
          <div className="font-semibold text-gray-900 text-sm mb-4">My Projects by Stage</div>
          {projects.length===0 ? <p className="text-gray-400 text-sm">No projects.</p> : (
            <div className="space-y-2">
              {Object.entries(stageMap).sort((a,b)=>b[1]-a[1]).map(([stage,count]) => (
                <div key={stage} className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLOR[stage]??"bg-gray-100 text-gray-700"}`}>{stage}</span>
                  <span className="text-sm font-semibold text-gray-700">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quotation status */}
        {quotations.length>0 && (
          <div className="card p-5">
            <div className="font-semibold text-gray-900 text-sm mb-1">Quotation Status</div>
            <div className="text-xs text-gray-400 mb-4">{totalSqmQuoted.toLocaleString()} m² total quoted</div>
            <div className="space-y-2">
              {Object.entries(quotStatusMap).sort((a,b)=>b[1]-a[1]).map(([status,count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${QUOT_STYLE[status]??"bg-gray-100 text-gray-600"}`}>{status}</span>
                  <span className="text-sm font-semibold text-gray-700">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top companies */}
      {topCompanies.length>0 && (
        <div className="card p-5">
          <div className="font-semibold text-gray-900 text-sm mb-4">Most Active Companies This Month</div>
          <div className="space-y-2">
            {topCompanies.map(([name,count],i) => (
              <div key={name} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-bold flex-shrink-0">{i+1}</span>
                <span className="flex-1 text-sm text-gray-800">{name}</span>
                <span className="text-xs text-gray-500">{count} activities</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
