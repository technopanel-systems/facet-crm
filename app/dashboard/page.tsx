import { createClient } from "@/lib/supabase/server";
import { format, subDays, startOfMonth } from "date-fns";

async function getDashboardData() {
  const supabase = createClient();
  const today = new Date();
  const yesterday = subDays(today, 1);
  const monthStart = startOfMonth(today);

  const [repsRes, activitiesTodayRes, activitiesMonthRes, customersRes, projectsRes] = await Promise.all([
    supabase.from("reps").select("*").eq("status", "active").order("name"),
    supabase.from("activities").select("rep_name, submission_status, activity_date, sqm_done")
      .eq("activity_date", format(yesterday, "yyyy-MM-dd")),
    supabase.from("activities").select("rep_name, sqm_done, sqm_expected, interaction_type")
      .gte("activity_date", format(monthStart, "yyyy-MM-dd")),
    supabase.from("customers").select("id, status", { count: "exact" }).eq("status", "active"),
    supabase.from("projects").select("id, stage, won_sqm, quoted_sqm", { count: "exact" }),
  ]);

  return {
    reps: repsRes.data ?? [],
    activitiesYesterday: activitiesTodayRes.data ?? [],
    activitiesMonth: activitiesMonthRes.data ?? [],
    totalCustomers: customersRes.count ?? 0,
    projects: projectsRes.data ?? [],
    yesterday: format(yesterday, "dd MMM yyyy"),
    month: format(today, "MMMM yyyy"),
  };
}

function StatCard({ label, value, sub, color = "blue" }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: "bg-brand-blue/10 text-brand-blue",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    purple: "bg-purple-100 text-purple-700",
  };
  return (
    <div className="stat-card">
      <div className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold mb-3 ${colors[color]}`}>{label}</div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-sm text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  // Submission status per rep for yesterday
  const repStatus = data.reps
    .filter(r => r.role === "rep")
    .map(rep => {
      const repActivities = data.activitiesYesterday.filter(a => a.rep_name === rep.name);
      let status: "on_time" | "late" | "missing" = "missing";
      if (repActivities.length > 0) {
        status = repActivities.some(a => a.submission_status === "on_time") ? "on_time" : "late";
      }
      return { ...rep, status, count: repActivities.length };
    });

  // Monthly SQM per rep
  const repSqm = data.reps.filter(r => r.role === "rep").map(rep => {
    const sqm = data.activitiesMonth
      .filter(a => a.rep_name === rep.name)
      .reduce((sum, a) => sum + (a.sqm_done ?? 0), 0);
    const pct = rep.monthly_target_sqm > 0 ? Math.min(100, Math.round((sqm / rep.monthly_target_sqm) * 100)) : 0;
    return { ...rep, sqm, pct };
  });

  const totalSqmDone = repSqm.reduce((s, r) => s + r.sqm, 0);
  const totalTarget = repSqm.reduce((s, r) => s + (r.monthly_target_sqm ?? 0), 0);
  const pipelineSqm = data.activitiesMonth.reduce((s, a) => s + (a.sqm_expected ?? 0), 0);
  const wonProjects = data.projects.filter(p => p.stage === "Won").length;

  const statusConfig = {
    on_time: { label: "✅ Submitted",      cls: "badge-on-time" },
    late:    { label: "🕒 Late",           cls: "badge-late" },
    missing: { label: "❌ Missing",        cls: "badge-missing" },
  };

  const submittedCount = repStatus.filter(r => r.status !== "missing").length;
  const missingCount   = repStatus.filter(r => r.status === "missing").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">{data.month} · Showing yesterday's report status: {data.yesterday}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="SQM This Month" value={totalSqmDone.toLocaleString()} sub={`Target: ${totalTarget.toLocaleString()} SQM`} color="blue" />
        <StatCard label="Pipeline SQM"   value={pipelineSqm.toLocaleString()} sub="Expected from activities" color="purple" />
        <StatCard label="Active Customers" value={data.totalCustomers} sub="Total in system" color="green" />
        <StatCard label="Won Projects"   value={wonProjects} sub={`${data.projects.length} total projects`} color="amber" />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Submission status */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Daily Report Status</h2>
              <p className="text-xs text-gray-500 mt-0.5">Reports for {data.yesterday}</p>
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
                      {rep.count > 0 && <div className="text-xs text-gray-400">{rep.count} activit{rep.count === 1 ? "y" : "ies"}</div>}
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
                  <span className="text-xs text-gray-500">
                    {rep.sqm.toLocaleString()} / {(rep.monthly_target_sqm ?? 0).toLocaleString()} m²
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${rep.pct >= 100 ? "bg-green-500" : rep.pct >= 60 ? "bg-brand-blue" : rep.pct >= 30 ? "bg-amber-500" : "bg-red-400"}`}
                    style={{ width: `${rep.pct}%` }}
                  />
                </div>
                <div className="text-right text-xs text-gray-400 mt-0.5">{rep.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Projects pipeline */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Project Pipeline</h2>
        </div>
        <div className="px-5 py-4 grid grid-cols-4 lg:grid-cols-8 gap-3">
          {["New Lead","Catalog Sent","Quotation Sent","Under Review","Won","In Production","Delivered","Lost"].map(stage => {
            const count = data.projects.filter(p => p.stage === stage).length;
            const stageColors: Record<string,string> = {
              "Won": "bg-green-100 text-green-800 border-green-200",
              "Lost": "bg-red-100 text-red-800 border-red-200",
              "New Lead": "bg-gray-100 text-gray-700 border-gray-200",
            };
            const cls = stageColors[stage] ?? "bg-blue-50 text-blue-700 border-blue-100";
            return (
              <div key={stage} className={`border rounded-xl p-3 text-center ${cls}`}>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-xs font-medium mt-1 leading-tight">{stage}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

