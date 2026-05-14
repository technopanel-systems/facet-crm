"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Rep = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  monthly_target_sqm: number;
};

type Holiday = {
  id: string;
  holiday_name: string;
  date_from: string;
  date_to: string;
  created_at: string;
};

type Absence = {
  id: string;
  rep_id: string;
  absence_type: string;
  date_from: string;
  date_to: string;
  notes: string | null;
  created_at: string;
};

const ABSENCE_TYPES: Record<string, string> = {
  sick:         "Sick Leave",
  annual_leave: "Annual Leave",
  eid_vacation: "Eid Vacation",
  other:        "Other",
};

const emptyHolidayForm = () => ({
  holiday_name: "",
  date_from: "",
  date_to: "",
});

const emptyAbsenceForm = () => ({
  rep_id:       "",
  absence_type: "sick",
  date_from:    "",
  date_to:      "",
  notes:        "",
});

export default function TeamPage() {
  const supabase = createClient();

  // Team state
  const [reps, setReps]       = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);

  // Holiday state
  const [holidays, setHolidays]           = useState<Holiday[]>([]);
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [holidayForm, setHolidayForm]     = useState(emptyHolidayForm());
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [holidayError, setHolidayError]   = useState("");

  // Absence state
  const [absences, setAbsences]             = useState<Absence[]>([]);
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [absenceForm, setAbsenceForm]       = useState(emptyAbsenceForm());
  const [savingAbsence, setSavingAbsence]   = useState(false);
  const [absenceError, setAbsenceError]     = useState("");

  // Current manager id
  const [managerId, setManagerId] = useState<string>("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: mgr } = await supabase
        .from("reps").select("id").eq("auth_user_id", user.id).single();
      if (mgr) setManagerId(mgr.id);
    }

    const [repsRes, holidaysRes, absencesRes] = await Promise.all([
      supabase.from("reps").select("*")
        .order("status", { ascending: false }).order("name"),
      supabase.from("company_holidays").select("*")
        .order("date_from", { ascending: false }),
      supabase.from("rep_absences").select("*")
  .order("date_from", { ascending: false }),
    ]);

    if (repsRes.data)     setReps(repsRes.data);
    if (holidaysRes.data) setHolidays(holidaysRes.data);
    if (absencesRes.data) setAbsences(absencesRes.data as Absence[]);

    setLoading(false);
  }

  // ── Team functions ──────────────────────────────────────────

  async function updateRep(id: string, field: string, value: string | number) {
    setReps(reps.map(r => r.id === id ? { ...r, [field]: value } : r));
    await supabase.from("reps").update({ [field]: value }).eq("id", id);
  }

  // ── Holiday functions ───────────────────────────────────────

  async function addHoliday() {
    setHolidayError("");
    if (!holidayForm.holiday_name.trim()) { setHolidayError("Holiday name is required."); return; }
    if (!holidayForm.date_from)           { setHolidayError("Start date is required."); return; }
    if (!holidayForm.date_to)             { setHolidayError("End date is required."); return; }
    if (holidayForm.date_to < holidayForm.date_from) {
      setHolidayError("End date must be on or after start date."); return;
    }

    setSavingHoliday(true);
    const { error } = await supabase.from("company_holidays").insert({
      holiday_name: holidayForm.holiday_name.trim(),
      date_from:    holidayForm.date_from,
      date_to:      holidayForm.date_to,
      created_by:   managerId || null,
    });

    if (error) { setHolidayError(error.message); setSavingHoliday(false); return; }

    setHolidayForm(emptyHolidayForm());
    setShowHolidayForm(false);
    setSavingHoliday(false);
    loadAll();
  }

  async function deleteHoliday(id: string, name: string) {
    if (!confirm(`Delete holiday "${name}"?`)) return;
    await supabase.from("company_holidays").delete().eq("id", id);
    loadAll();
  }

  // ── Absence functions ───────────────────────────────────────

  async function addAbsence() {
    setAbsenceError("");
    if (!absenceForm.rep_id)    { setAbsenceError("Please select a rep."); return; }
    if (!absenceForm.date_from) { setAbsenceError("Start date is required."); return; }
    if (!absenceForm.date_to)   { setAbsenceError("End date is required."); return; }
    if (absenceForm.date_to < absenceForm.date_from) {
      setAbsenceError("End date must be on or after start date."); return;
    }

    setSavingAbsence(true);
    const { error } = await supabase.from("rep_absences").insert({
      rep_id:       absenceForm.rep_id,
      absence_type: absenceForm.absence_type,
      date_from:    absenceForm.date_from,
      date_to:      absenceForm.date_to,
      notes:        absenceForm.notes || null,
      created_by:   managerId || null,
    });

    if (error) { setAbsenceError(error.message); setSavingAbsence(false); return; }

    setAbsenceForm(emptyAbsenceForm());
    setShowAbsenceForm(false);
    setSavingAbsence(false);
    loadAll();
  }

  async function deleteAbsence(id: string) {
    if (!confirm("Remove this absence record?")) return;
    await supabase.from("rep_absences").delete().eq("id", id);
    loadAll();
  }

  if (loading) return <div className="p-8 text-gray-500">Loading team...</div>;

  const activeReps = reps.filter(r =>
    r.status === "active" && ["rep", "marketing"].includes(r.role)
  );

  return (
    <div className="space-y-10">

      {/* ── Section 1: Team Members ── */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            Approve accounts, set roles, and assign monthly SQM targets.
          </p>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold uppercase tracking-wider text-xs">
              <tr>
                <th className="px-5 py-4">Name / Email</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Target (SQM)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reps.map((rep) => (
                <tr key={rep.id}
                  className={rep.status === "pending" ? "bg-amber-50/30" : "bg-white"}>
                  <td className="px-5 py-4">
                    <div className="font-medium text-gray-900">{rep.name}</div>
                    <div className="text-gray-500 text-xs">{rep.email}</div>
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={rep.status}
                      onChange={(e) => updateRep(rep.id, "status", e.target.value)}
                      className={`text-xs font-semibold rounded-full px-2 py-1 outline-none border cursor-pointer ${
                        rep.status === "active"  ? "bg-green-100 text-green-800 border-green-200" :
                        rep.status === "pending" ? "bg-amber-100 text-amber-800 border-amber-200" :
                        "bg-gray-100 text-gray-800 border-gray-200"
                      }`}
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={rep.role}
                      onChange={(e) => updateRep(rep.id, "role", e.target.value)}
                      className="input py-1.5 px-2 text-xs w-36"
                    >
                      <option value="rep">Sales Rep</option>
                      <option value="sales_coordinator">Coordinator</option>
                      <option value="marketing">Marketing</option>
                      <option value="manager">Manager</option>
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <input
                      type="number"
                      value={rep.monthly_target_sqm}
                      onChange={(e) => updateRep(rep.id, "monthly_target_sqm", Number(e.target.value))}
                      className="input py-1.5 px-3 w-32"
                      min="0"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 2: Company Holidays ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Company Holidays</h2>
            <p className="text-gray-500 text-sm mt-1">
              Holidays apply to the entire team. Submissions on these days are excused.
            </p>
          </div>
          <button
            onClick={() => { setShowHolidayForm(true); setHolidayError(""); }}
            className="btn-primary flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Holiday
          </button>
        </div>

        {holidays.length === 0 ? (
          <div className="card p-8 text-center text-gray-400">
            No holidays added yet. Add Eid, National Day, or any team-wide holiday above.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-5 py-3">Holiday</th>
                  <th className="px-5 py-3">From</th>
                  <th className="px-5 py-3">To</th>
                  <th className="px-5 py-3">Days</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {holidays.map(h => {
                  const days = Math.round(
                    (new Date(h.date_to).getTime() - new Date(h.date_from).getTime())
                    / (1000 * 60 * 60 * 24)
                  ) + 1;
                  return (
                    <tr key={h.id} className="bg-white hover:bg-gray-50/60">
                      <td className="px-5 py-3 font-medium text-gray-900">{h.holiday_name}</td>
                      <td className="px-5 py-3 text-gray-600">{h.date_from}</td>
                      <td className="px-5 py-3 text-gray-600">{h.date_to}</td>
                      <td className="px-5 py-3 text-gray-600">{days} day{days !== 1 ? "s" : ""}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => deleteHoliday(h.id, h.holiday_name)}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 3: Rep Absences ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Rep Absences</h2>
            <p className="text-gray-500 text-sm mt-1">
              Approved absences excuse a rep from daily submissions. Can be added retroactively.
            </p>
          </div>
          <button
            onClick={() => { setShowAbsenceForm(true); setAbsenceError(""); }}
            className="btn-primary flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Absence
          </button>
        </div>

        {absences.length === 0 ? (
          <div className="card p-8 text-center text-gray-400">
            No absence records yet. Add sick leave, annual leave, or Eid vacation per rep above.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-5 py-3">Rep</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">From</th>
                  <th className="px-5 py-3">To</th>
                  <th className="px-5 py-3">Notes</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {absences.map(a => {
                  const repName = reps.find(r => r.id === a.rep_id)?.name ?? '—';
                  return (
                    <tr key={a.id} className="bg-white hover:bg-gray-50/60">
                      <td className="px-5 py-3 font-medium text-gray-900">{repName ?? "—"}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {ABSENCE_TYPES[a.absence_type] ?? a.absence_type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{a.date_from}</td>
                      <td className="px-5 py-3 text-gray-600">{a.date_to}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{a.notes ?? "—"}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => deleteAbsence(a.id)}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Holiday Modal ── */}
      {showHolidayForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Add Company Holiday</h2>
              <button onClick={() => setShowHolidayForm(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {holidayError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {holidayError}
                </div>
              )}
              <div>
                <label className="label">Holiday Name *</label>
                <input
                  className="input"
                  value={holidayForm.holiday_name}
                  onChange={e => setHolidayForm({...holidayForm, holiday_name: e.target.value})}
                  placeholder="Eid Al Fitr, National Day…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">From *</label>
                  <input
                    type="date"
                    className="input"
                    value={holidayForm.date_from}
                    onChange={e => setHolidayForm({...holidayForm, date_from: e.target.value})}
                  />
                </div>
                <div>
                  <label className="label">To *</label>
                  <input
                    type="date"
                    className="input"
                    value={holidayForm.date_to}
                    onChange={e => setHolidayForm({...holidayForm, date_to: e.target.value})}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400">
                This holiday applies to all team members. Submissions during this period will be marked as excused.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setShowHolidayForm(false)} className="btn-secondary">Cancel</button>
              <button
                onClick={addHoliday}
                disabled={savingHoliday || !holidayForm.holiday_name.trim() || !holidayForm.date_from || !holidayForm.date_to}
                className="btn-primary"
              >
                {savingHoliday ? "Saving…" : "Add Holiday"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Absence Modal ── */}
      {showAbsenceForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Add Rep Absence</h2>
              <button onClick={() => setShowAbsenceForm(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {absenceError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  {absenceError}
                </div>
              )}
              <div>
                <label className="label">Rep *</label>
                <select
                  className="input"
                  value={absenceForm.rep_id}
                  onChange={e => setAbsenceForm({...absenceForm, rep_id: e.target.value})}
                >
                  <option value="">Select rep…</option>
                  {activeReps.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Absence Type *</label>
                <select
                  className="input"
                  value={absenceForm.absence_type}
                  onChange={e => setAbsenceForm({...absenceForm, absence_type: e.target.value})}
                >
                  <option value="sick">Sick Leave</option>
                  <option value="annual_leave">Annual Leave</option>
                  <option value="eid_vacation">Eid Vacation</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">From *</label>
                  <input
                    type="date"
                    className="input"
                    value={absenceForm.date_from}
                    onChange={e => setAbsenceForm({...absenceForm, date_from: e.target.value})}
                  />
                </div>
                <div>
                  <label className="label">To *</label>
                  <input
                    type="date"
                    className="input"
                    value={absenceForm.date_to}
                    onChange={e => setAbsenceForm({...absenceForm, date_to: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <input
                  className="input"
                  value={absenceForm.notes}
                  onChange={e => setAbsenceForm({...absenceForm, notes: e.target.value})}
                  placeholder="Optional reason or context"
                />
              </div>
              <p className="text-xs text-gray-400">
                Can be added retroactively. Submissions during this period will be excused.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setShowAbsenceForm(false)} className="btn-secondary">Cancel</button>
              <button
                onClick={addAbsence}
                disabled={savingAbsence || !absenceForm.rep_id || !absenceForm.date_from || !absenceForm.date_to}
                className="btn-primary"
              >
                {savingAbsence ? "Saving…" : "Add Absence"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
