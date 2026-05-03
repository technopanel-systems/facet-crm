"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";

type Customer = { company_name: string; company_type: string; contact1_name: string; contact1_phone: string; region: string };
type Row = {
  date: string; company_name: string; company_type: string;
  contact_person: string; phone: string; interaction_type: string;
  project_name: string; notes: string; region: string;
  sqm_done: string; sqm_expected: string;
};

const emptyRow = (): Row => ({
  date: format(new Date(), "yyyy-MM-dd"),
  company_name: "", company_type: "", contact_person: "",
  phone: "", interaction_type: "", project_name: "",
  notes: "", region: "", sqm_done: "", sqm_expected: "",
});

const INTERACTIONS = ["Visit", "Call", "WhatsApp", "Email", "Meeting", "Site Visit"];
const REGIONS      = ["Central", "West", "East", "North", "South", "Foreign"];
const TYPES        = ["Factory", "Contractor", "Developer", "Consultant", "Trading", "Government", "Other"];

export default function RepPage() {
  const supabase = createClient();
  const [rep, setRep]             = useState<{ id: string; name: string; monthly_target_sqm: number } | null>(null);
  const [rows, setRows]           = useState<Row[]>([emptyRow()]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [activeInput, setActiveInput] = useState<number | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [error, setError]             = useState("");
  const [monthSqm, setMonthSqm]       = useState(0);
  const suggestRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: repData } = await supabase.from("reps").select("id, name, monthly_target_sqm").eq("auth_user_id", user.id).single();
      setRep(repData);
      if (repData) {
        const { data: custData } = await supabase.from("customers").select("company_name, company_type, contact1_name, contact1_phone, region").eq("primary_rep_id", repData.id);
        setCustomers(custData ?? []);
        // fetch this month's sqm
        const monthStart = format(new Date(), "yyyy-MM-01");
        const { data: actData } = await supabase.from("activities").select("sqm_done").eq("rep_id", repData.id).gte("activity_date", monthStart);
        setMonthSqm((actData ?? []).reduce((s, a) => s + (a.sqm_done ?? 0), 0));
      }
    }
    load();
  }, []);

  // Arabic-normalize for fuzzy match
  function normalizeAr(s: string) {
    return s.toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/^ال/, "");
  }

  function handleCompanyInput(idx: number, value: string) {
    updateRow(idx, "company_name", value);
    if (value.length < 2) { setSuggestions([]); setActiveInput(null); return; }
    const norm = normalizeAr(value);
    const matches = customers.filter(c =>
      normalizeAr(c.company_name).includes(norm) || c.company_name.toLowerCase().includes(value.toLowerCase())
    ).slice(0, 6);
    setSuggestions(matches);
    setActiveInput(matches.length > 0 ? idx : null);
  }

  function pickSuggestion(idx: number, c: Customer) {
    const updated = [...rows];
    updated[idx] = {
      ...updated[idx],
      company_name:   c.company_name,
      company_type:   c.company_type ?? "",
      contact_person: c.contact1_name ?? "",
      phone:          c.contact1_phone ?? "",
      region:         c.region ?? "",
    };
    setRows(updated);
    setSuggestions([]);
    setActiveInput(null);
  }

  function updateRow(idx: number, field: keyof Row, value: string) {
    const updated = [...rows];
    updated[idx] = { ...updated[idx], [field]: value };
    setRows(updated);
  }

  function addRow() { setRows([...rows, emptyRow()]); }
  function removeRow(idx: number) { if (rows.length === 1) return; setRows(rows.filter((_, i) => i !== idx)); }

  async function handleSubmit() {
    const validRows = rows.filter(r => r.company_name.trim() && r.interaction_type);
    if (validRows.length === 0) { setError("Add at least one activity with a company name and interaction type."); return; }
    if (!rep) return;
    setSubmitting(true);
    setError("");

    const inserts = validRows.map(r => ({
      activity_date:    r.date,
      rep_id:           rep.id,
      rep_name:         rep.name,
      company_name:     r.company_name.trim(),
      company_type:     r.company_type || null,
      contact_person:   r.contact_person || null,
      phone:            r.phone || null,
      interaction_type: r.interaction_type,
      project_name:     r.project_name || null,
      notes:            r.notes || null,
      region:           r.region || null,
      sqm_done:         parseFloat(r.sqm_done) || 0,
      sqm_expected:     parseFloat(r.sqm_expected) || 0,
    }));

    const { error: err } = await supabase.from("activities").insert(inserts);
    if (err) { setError("Failed to submit: " + err.message); setSubmitting(false); return; }

    setSubmitted(true);
    setRows([emptyRow()]);
    setSubmitting(false);
    setTimeout(() => setSubmitted(false), 4000);
  }

  const target = rep?.monthly_target_sqm ?? 0;
  const pct    = target > 0 ? Math.min(100, Math.round((monthSqm / target) * 100)) : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Report</h1>
          <p className="text-gray-500 text-sm mt-1">{format(new Date(), "EEEE, dd MMMM yyyy")}</p>
        </div>
        {/* Quick SQM progress */}
        {rep && target > 0 && (
          <div className="card px-5 py-3 min-w-48">
            <div className="text-xs text-gray-500 mb-1">My SQM this month</div>
            <div className="flex items-end gap-1 mb-2">
              <span className="text-xl font-bold text-gray-900">{monthSqm.toLocaleString()}</span>
              <span className="text-sm text-gray-400 mb-0.5">/ {target.toLocaleString()} m²</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full ${pct >= 100 ? "bg-green-500" : "bg-brand-blue"}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="text-right text-xs text-gray-400 mt-0.5">{pct}%</div>
          </div>
        )}
      </div>

      {/* Success banner */}
      {submitted && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3 text-green-800">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span className="font-medium">Report submitted successfully!</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Activity rows */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Today's Activities</h2>
            <p className="text-xs text-gray-500 mt-0.5">Add one row per customer interaction. You can change the date if reporting for a previous day.</p>
          </div>
          <button onClick={addRow} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add row
          </button>
        </div>

        <div className="divide-y divide-gray-50">
          {rows.map((row, idx) => (
            <div key={idx} className="p-5 space-y-4 relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Activity #{idx + 1}</span>
                {rows.length > 1 && (
                  <button onClick={() => removeRow(idx)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>

              {/* Row 1: date + company + type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative">
                <div>
                  <label className="label">Date *</label>
                  <input type="date" className="input" value={row.date} onChange={e => updateRow(idx, "date", e.target.value)} />
                </div>
                <div className="relative">
                  <label className="label">Company Name * (Arabic or English)</label>
                  <input
                    className="input"
                    placeholder="Start typing..."
                    value={row.company_name}
                    onChange={e => handleCompanyInput(idx, e.target.value)}
                    onBlur={() => setTimeout(() => { setSuggestions([]); setActiveInput(null); }, 150)}
                    autoComplete="off"
                  />
                  {activeInput === idx && suggestions.length > 0 && (
                    <div ref={suggestRef} className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl z-50 mt-1 overflow-hidden">
                      {suggestions.map((c, si) => (
                        <button key={si} className="w-full text-left px-4 py-3 hover:bg-brand-light text-sm border-b border-gray-50 last:border-0" onMouseDown={() => pickSuggestion(idx, c)}>
                          <div className="font-medium text-gray-900">{c.company_name}</div>
                          {c.contact1_name && <div className="text-xs text-gray-500 mt-0.5">{c.contact1_name} · {c.contact1_phone}</div>}
                        </button>
                      ))}
                      <div className="px-4 py-2 bg-gray-50 text-xs text-gray-400">Not listed? Keep typing to add as new</div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">Company Type</label>
                  <select className="input" value={row.company_type} onChange={e => updateRow(idx, "company_type", e.target.value)}>
                    <option value="">Select...</option>
                    {TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2: contact + phone + interaction */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Contact Person</label>
                  <input className="input" placeholder="Name" value={row.contact_person} onChange={e => updateRow(idx, "contact_person", e.target.value)} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" placeholder="05xxxxxxxx" value={row.phone} onChange={e => updateRow(idx, "phone", e.target.value)} />
                </div>
                <div>
                  <label className="label">Interaction *</label>
                  <select className="input" value={row.interaction_type} onChange={e => updateRow(idx, "interaction_type", e.target.value)}>
                    <option value="">Select...</option>
                    {INTERACTIONS.map(i => <option key={i}>{i}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 3: project + region + SQM */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="label">Project Name</label>
                  <input className="input" placeholder="Optional" value={row.project_name} onChange={e => updateRow(idx, "project_name", e.target.value)} />
                </div>
                <div>
                  <label className="label">Region</label>
                  <select className="input" value={row.region} onChange={e => updateRow(idx, "region", e.target.value)}>
                    <option value="">Select...</option>
                    {REGIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">SQM Confirmed</label>
                  <input type="number" className="input" placeholder="0" min="0" value={row.sqm_done} onChange={e => updateRow(idx, "sqm_done", e.target.value)} />
                </div>
                <div>
                  <label className="label">SQM Expected</label>
                  <input type="number" className="input" placeholder="0" min="0" value={row.sqm_expected} onChange={e => updateRow(idx, "sqm_expected", e.target.value)} />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">Notes / Outcome</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  placeholder="What happened? Next steps?"
                  value={row.notes}
                  onChange={e => updateRow(idx, "notes", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Submit */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <p className="text-xs text-gray-500">{rows.length} row{rows.length !== 1 ? "s" : ""} · Required fields marked with *</p>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex items-center gap-2 px-6">
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Submitting...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Submit Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
