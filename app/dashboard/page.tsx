import { createClient } from "@/lib/supabase/server";
import { format, subDays, startOfMonth } from "date-fns";

async function getDashboardData(branchId?: string) {
  const supabase = createClient();
    // Fire missing submission notifications for expired grace periods
  await supabase.rpc('check_missing_submissions');
  const today      = new Date();
  const yesterday  = subDays(today, 1);
  const monthStart = startOfMonth(today);

  const yesterdayStr = format(yesterday,"yyyy-MM-dd");

  const [
    repsRes, activitiesYesterdayRes, activitiesMonthRes,
    projectsRes, staleRes, pipelineRes, quotationsRes, branchesRes,
    holidaysRes, absencesRes,
  ] = await Promise.all([
    branchId
      ? supabase.from("reps").select("*").eq("status","active").eq("branch_id", branchId).order("name")
      : supabase.from("reps").select("*").eq("status","active").order("name"),
    supabase.from("activities")
      .select("rep_name,submission_status,sqm_done")
      .eq("activity_date", yesterdayStr),
    supabase.from("activities")
      .select("rep_name,sqm_done,sqm_expected,interaction_type")
      .gte("activity_date", format(monthStart,"yyyy-MM-dd")),
    supabase.from("projects").select("id,stage,quoted_sqm,won_sqm,assigned_rep_id"),
    supabase.from("stale_projects").select("id,project_name,company_name,stage,assigned_rep_name,next_follow_up").limit(8),
    supabase.from("pipeline_summary").select("*"),
    supabase.from("quotations").select("status,sqm_quoted,sqm_invoiced"),
    supabase.from("branches").select("id,name").eq("is_active", true).order("name"),
    supabase.from("company_holidays").select("date_from,date_to")
      .lte("date_from", yesterdayStr).gte("date_to", yesterdayStr),
    supabase.from("rep_absences").select("rep_id,date_from,date_to")
      .lte("date_from", yesterdayStr).gte("date_to", yesterdayStr),
  ]);

  return {
    reps:                repsRes.data ?? [],
    activitiesYesterday: activitiesYesterdayRes.data ?? [],
    activitiesMonth:     activitiesMonthRes.data ?? [],
    projects:            projectsRes.data ?? [],
    staleProjects:       staleRes.data ?? [],
    pipeline:            pipelineRes.data ?? [],
    quotations:          quotationsRes.data ?? [],
    branches:            branchesRes.data ?? [],
    holidays:            holidaysRes.data ?? [],
    absences:            absencesRes.data ?? [],
    yesterday:           format(yesterday,"dd MMM yyyy"),
    yesterdayStr,
    month:               format(today,"MMMM yyyy"),
  };
}

const STAGE_ORDER = ["New Lead","Catalog Sent","Quotation Sent","Under Review","Won","In Production","Delivered","Lost"];
const STAGE_COLOR: Record<string,string> = {
  "Won":      "bg-green-100 text-green-800 border-green-200",
  "Lost":     "bg-red-100 text-red-800 border-red-200",
  "New Lead": "bg-gray-100 text-gray-700 border-gray-200",
};

function StatCard({ label, value, sub, color = "blue" }: { label:string; value:string|number; sub?:string; color?:string }) {
  const colors: Record<string,string> = {
    blue:   "bg-brand-blue/10 text-brand-blue",
    green:  "bg-green-100 text-green-700",
    amber:  "bg-amber-100 text-amber-700",
    purple: "bg-purple-100 text-purple-700",
    red:    "bg-red-100 text-red-600",
  };
  return (
    <div className="stat-card">
      <div className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold mb-3 ${colors[color]}`}>{label}</div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-sm text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: { branch?: string } }) {
  const data = await getDashboardData(searchParams?.branch);

 // Check if yesterday was a weekend
  const yesterdayDow = new Date(data.yesterdayStr).getDay(); // 0=Sun,5=Fri,6=Sat
  const yesterdayIsWeekend = yesterdayDow === 5 || yesterdayDow === 6;

  // Check if yesterday was a company holiday
  const yesterdayIsHoliday = (data.holidays ?? []).length > 0;

  // Submission status per rep
  const repStatus = data.reps.filter(r => r.role === "rep").map(rep => {
    // Weekend or company holiday — everyone is excused
    if (yesterdayIsWeekend || yesterdayIsHoliday) {
      return { ...rep, status: "excused" as const, count: 0 };
    }

    // Check if this specific rep has an approved absence
    const isAbsent = (data.absences ?? []).some(a => a.rep_id === rep.id);
    if (isAbsent) {
      return { ...rep, status: "excused" as const, count: 0 };
    }

    const acts = data.activitiesYesterday.filter(a => a.rep_name === rep.name);
    const status: "on_time"|"late"|"missing"|"excused" = acts.length === 0 ? "missing"
      : acts.some(a => a.submission_status === "on_time") ? "on_time" : "late";
    return { ...rep, status, count: acts.length };
  });

  // Monthly SQM per rep
  const repSqm = data.reps.filter(r => r.role === "rep").map(rep => {
    const sqm = data.activitiesMonth.filter(a => a.rep_name === rep.name).reduce((s,a) => s + (a.sqm_done ?? 0), 0);
    const pct = rep.monthly_target_sqm > 0 ? Math.min(100, Math.round((sqm / rep.monthly_target_sqm) * 100)) : 0;
    return { ...rep, sqm, pct };
  });

  const totalSqmDone = repSqm.reduce((s,r) => s + r.sqm, 0);
  const totalTarget  = repSqm.reduce((s,r) => s + (r.monthly_target_sqm ?? 0), 0);
  const pipelineSqm  = data.activitiesMonth.reduce((s,a) => s + (a.sqm_expected ?? 0), 0);

  // Quotation KPIs
  const wonQuotations  = data.quotations.filter(q => q.status === "won");
  const sqmWon         = wonQuotations.reduce((s,q) => s + (q.sqm_quoted ?? 0), 0);
  const sqmInvoiced    = data.quotations.reduce((s,q) => s + (q.sqm_invoiced ?? 0), 0);
  const totalQuoted    = data.quotations.reduce((s,q) => s + (q.sqm_quoted ?? 0), 0);
  const winRate        = data.quotations.length > 0
    ? Math.round((wonQuotations.length / data.quotations.length) * 100) : 0;

  // Pipeline SQM by stage
  const pipelineMap: Record<string,{count:number;sqm:number}> = {};
  (data.pipeline ?? []).forEach((p:any) => {
    pipelineMap[p.stage] = { count: Number(p.project_count), sqm: Number(p.total_sqm) };
  });

  // Interaction breakdown this month
  const interactionMap: Record<string,number> = {};
  data.activitiesMonth.forEach(a => {
    if (a.interaction_type) interactionMap[a.interaction_type] = (interactionMap[a.interaction_type] ?? 0) + 1;
  });
  const totalInteractions = Object.values(interactionMap).reduce((s,v) => s+v, 0);

  const submittedCount = repStatus.filter(r => r.status !== "missing").length;
  const missingCount   = repStatus.filter(r => r.status === "missing").length;

  const statusConfig = {
    on_time: { label: "✅ Submitted", cls: "badge-on-time" },
    late:    { label: "🕒 Late",      cls: "badge-late" },
    missing: { label: "❌ Missing",   cls: "badge-missing" },
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">{data.month} · Yesterday: {data.yesterday}</p>
      </div>

      {/* Branch filter */}
      <div className="flex items-center gap-3">
        {(data.branches as any[]).map((b:any) => (
          <a key={b.id} href={searchParams?.branch===b.id ? '/dashboard' : `/dashboard?branch=${b.id}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${searchParams?.branch===b.id ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-blue'}`}>
            {b.name}
          </a>
        ))}
        {searchParams?.branch && (
          <a href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600">Clear filter ×</a>
        )}
      </div>

      {/* KPI row 1 — SQM */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="SQM This Month"   value={totalSqmDone.toLocaleString()}  sub={`Target: ${totalTarget.toLocaleString()}`} color="blue" />
        <StatCard label="Pipeline SQM"     value={pipelineSqm.toLocaleString()}   sub="Expected from activities"                  color="purple" />
        <StatCard label="SQM Won (Quoted)" value={sqmWon.toLocaleString()}        sub={`${winRate}% win rate`}                    color="green" />
        <StatCard label="SQM Invoiced"     value={sqmInvoiced.toLocaleString()}   sub={`of ${totalQuoted.toLocaleString()} quoted`} color="amber" />
      </div>

      {/* KPI row 2 — Operations */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Projects"  value={data.projects.filter(p => !["Won","Delivered","Lost"].includes(p.stage)).length} sub="In pipeline" color="blue" />
        <StatCard label="Won Projects"     value={data.projects.filter(p => p.stage === "Won").length}      sub="All time"       color="green" />
        <StatCard label="Stale Projects"   value={data.staleProjects.length}  sub="No update 14+ days"     color="red" />
        <StatCard label="Submitted Today"  value={`${submittedCount}/${repStatus.length}`} sub={`${missingCount} missing`} color={missingCount > 0 ? "amber" : "green"} />
      </div>

      {/* Row: Submission status + SQM progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submission status */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Daily Report Status</h2>
              <p className="text-xs text-gray-500 mt-0.5">{data.yesterday}</p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="text-green-700 font-semibold">{submittedCount} submitted</span>
              <span className="text-red-600 font-semibold">{missingCount} missing</span>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {repStatus.map(rep => {
              const s = statusConfig[rep.status as keyof typeof statusConfig];
              return (
                <div key={rep.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                      {rep.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{rep.name}</div>
                      {rep.count > 0 && <div className="text-xs text-gray-400">{rep.count} activit{rep.count===1?"y":"ies"}</div>}
                    </div>
                  </div>
                  <span className={s.cls}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SQM Progress */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">SQM Progress — {data.month}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Individual vs monthly target</p>
          </div>
          <div className="divide-y divide-gray-50">
            {repSqm.map(rep => (
              <div key={rep.id} className="px-5 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-gray-900">{rep.name}</span>
                  <span className="text-xs text-gray-500">{rep.sqm.toLocaleString()} / {(rep.monthly_target_sqm??0).toLocaleString()} m²</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${rep.pct>=100?"bg-green-500":rep.pct>=60?"bg-brand-blue":rep.pct>=30?"bg-amber-500":"bg-red-400"}`}
                    style={{ width:`${rep.pct}%` }}
                  />
                </div>
                <div className="text-right text-xs text-gray-400 mt-0.5">{rep.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline by stage — SQM view */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Pipeline — SQM by Stage</h2>
          <p className="text-xs text-gray-500 mt-0.5">Projects and quoted SQM across all stages</p>
        </div>
        <div className="px-5 py-4 grid grid-cols-4 lg:grid-cols-8 gap-3">
          {STAGE_ORDER.map(stage => {
            const info = pipelineMap[stage] ?? { count: 0, sqm: 0 };
            const cls  = STAGE_COLOR[stage] ?? "bg-blue-50 text-blue-700 border-blue-100";
            return (
              <div key={stage} className={`border rounded-xl p-3 text-center ${cls}`}>
                <div className="text-2xl font-bold">{info.count}</div>
                <div className="text-xs font-medium mt-1 leading-tight">{stage}</div>
                {info.sqm > 0 && (
                  <div className="text-xs mt-1 opacity-70">{(info.sqm/1000).toFixed(1)}k m²</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Row: Stale projects + Interaction breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stale projects */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">⚠️ Stale Projects</h2>
            <p className="text-xs text-gray-500 mt-0.5">No stage update in 14+ days</p>
          </div>
          {data.staleProjects.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-green-600">✅ No stale projects — all active!</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.staleProjects.map((p:any) => (
                <div key={p.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{p.project_name || "(No name)"}</div>
                    <div className="text-xs text-gray-500">{p.company_name}</div>
                    {p.assigned_rep_name && <div className="text-xs text-gray-400">Rep: {p.assigned_rep_name}</div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{p.stage}</span>
                    {p.next_follow_up && (
                      <div className="text-xs text-red-500 mt-1">📅 {p.next_follow_up}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Interaction breakdown */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Activity Breakdown — {data.month}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Interaction types across all reps</p>
          </div>
          {totalInteractions === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-gray-400">No activities logged this month yet.</div>
          ) : (
            <div className="px-5 py-4 space-y-3">
              {Object.entries(interactionMap).sort((a,b) => b[1]-a[1]).map(([type, count]) => {
                const pct = Math.round((count / totalInteractions) * 100);
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{type}</span>
                      <span className="text-gray-500">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-brand-blue transition-all" style={{ width:`${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="text-xs text-gray-400 pt-1">Total: {totalInteractions} interactions</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
