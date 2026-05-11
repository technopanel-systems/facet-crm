"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, startOfMonth, subMonths } from "date-fns";

type Activity = {
  id: string; activity_code: string; activity_date: string;
  company_name: string; interaction_type: string | null;
  project_name: string | null; contact_person: string | null;
  region: string | null; sqm_done: number; sqm_expected: number;
  submission_status: string | null; notes: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  on_time: "bg-green-100 text-green-800",
  late:    "bg-amber-100 text-amber-800",
  missing: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  on_time: "On Time", late: "Late", missing: "Missing",
};

export default function RepHistoryPage() {
  const supabase = createClient();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [expanded, setExpanded]     = useState<string | null>(null);

  // Build last 12 months for dropdown
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });

  useEffect(() => { load(); }, [selectedMonth]);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: rep } = await supabase.from("reps").select("id").eq("auth_user_id", user.id).single();
    if (!rep) return;

    const monthStart = `${selectedMonth}-01`;
    const [year, month] = selectedMonth.split("-").map(Number);
    const nextMonth = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    const { data } = await supabase.from("activities")
      .select("id,activity_code,activity_date,company_name,interaction_type,project_name,contact_person,region,sqm_done,sqm_expected,submission_status,notes")
      .eq("rep_id", rep.id)
      .gte("activity_date", monthStart)
      .lt("activity_date", nextMonth)
      .order("activity_date", { ascending: false });

    setActivities(data ?? []);
    setLoading(false);
  }

  const totalSqm     = activities.reduce((s, a) => s + (a.sqm_done ?? 0), 0);
  const totalExp     = activities.reduce((s, a) => s + (a.sqm_expected ?? 0), 0);
  const onTimeCount  = activities.filter(a => a.submission_status === "on_time").length;
  const lateCount    = activities.filter(a => a.submission_status === "late").length;

  // Group by date
  const grouped = activities.reduce<Record<string, Activity[]>>((acc, a) => {
    if (!acc[a.activity_date]) acc[a.activity_date] = [];
    acc[a.activity_date].push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">History</h1>
          <p className="text-gray-500 text-sm mt-1">Your submitted activity reports</p>
        </div>
        <select className="input w-44" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
          {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {/* Month summary */}
      {!loading && activities.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Activities", value: activities.length },
            { label: "SQM Done",   value: `${totalSqm.toLocaleString()} m²` },
            { label: "SQM Expected", value: `${totalExp.toLocaleString()} m²` },
            { label: "On Time",    value: `${onTimeCount} / ${activities.length}` },
          ].map(s => (
            <div key={s.label} className="card px-4 py-3 text-center">
              <div className="text-xs text-gray-500 mb-1">{s.label}</div>
              <div className="text-lg font-bold text-gray-900">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="card p-10 text-center text-gray-400">Loading…</div>
      ) : activities.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">No activities submitted for this month.</div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([date, acts]) => (
            <div key={date}>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
                {format(new Date(date + "T12:00:00"), "EEEE, dd MMMM")}
              </div>
              <div className="card divide-y divide-gray-50 overflow-hidden">
                {acts.map(a => (
                  <div key={a.id}>
                    <div className="px-5 py-3.5 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{a.company_name}</span>
                          {a.interaction_type && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a.interaction_type}</span>
                          )}
                          {a.submission_status && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[a.submission_status] ?? ""}`}>
                              {STATUS_LABEL[a.submission_status] ?? a.submission_status}
                            </span>
                          )}
                        </div>
                        {a.project_name && <div className="text-xs text-gray-500 mt-0.5">📁 {a.project_name}</div>}
                        <div className="flex gap-4 mt-1 text-xs text-gray-400">
                          {a.contact_person && <span>👤 {a.contact_person}</span>}
                          {a.region         && <span>📍 {a.region}</span>}
                          {a.sqm_done > 0   && <span className="text-green-700 font-medium">{a.sqm_done} SQM done</span>}
                          {a.sqm_expected > 0 && <span>{a.sqm_expected} SQM expected</span>}
                        </div>
                      </div>
                      {a.notes && (
                        <button onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                          className="text-xs text-brand-blue hover:underline flex-shrink-0">
                          {expanded === a.id ? "Hide" : "Notes"}
                        </button>
                      )}
                    </div>
                    {expanded === a.id && a.notes && (
                      <div className="px-5 pb-3.5">
                        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3 italic">"{a.notes}"</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
