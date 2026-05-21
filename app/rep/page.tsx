"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";

type Company = {
  id: string;
  company_name: string;
  company_type: string;
  region: string;
};

type Contact = {
  id: string;
  full_name: string;
  title: string | null;
  phone: string | null;
  whatsapp: string | null;
};

type Project = {
  id: string;
  project_name: string | null;
  project_code: string;
  stage: string;
};

type Row = {
  date: string;
  company_id: string;
  company_name: string;
  company_type: string;
  region: string;
  contact_id: string;
  contact_person: string;
  phone: string;
  interaction_type: string;
  project_id: string;
  project_name: string;
  notes: string;
  sqm_done: string;
  sqm_expected: string;
};

const emptyRow = (): Row => ({
  date: format(new Date(), "yyyy-MM-dd"),
  company_id: "",
  company_name: "",
  company_type: "",
  region: "",
  contact_id: "",
  contact_person: "",
  phone: "",
  interaction_type: "",
  project_id: "",
  project_name: "",
  notes: "",
  sqm_done: "",
  sqm_expected: "",
});

const INTERACTIONS = ["Visit", "Call", "WhatsApp", "Email", "Meeting", "Site Visit"];
const REGIONS      = ["Central", "West", "East", "North", "South", "Foreign"];

function normalizeAr(s: string) {
  return s.toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/^ال/, "");
}

export default function RepPage() {
  const supabase = createClient();
  const [rep, setRep]             = useState<{ id: string; name: string; monthly_target_sqm: number } | null>(null);
  const [rows, setRows]           = useState<Row[]>([emptyRow()]);
  const [companies, setCompanies] = useState<Company[]>([]);

  // Per-company loaded data
  const [projectsMap, setProjectsMap] = useState<Record<string, Project[]>>({});
  const [contactsMap, setContactsMap] = useState<Record<string, Contact[]>>({});

  // Dropdown state
  const [companySearch, setCompanySearch] = useState<string[]>([""]);
  const [dropdownOpen, setDropdownOpen]   = useState<number | null>(null);
  const dropdownRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState("");
  const [monthSqm, setMonthSqm]     = useState(0);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: repData } = await supabase
        .from("reps")
        .select("id, name, monthly_target_sqm")
        .eq("auth_user_id", user.id)
        .single();
      setRep(repData);

      if (repData) {
        const { data: crData } = await supabase
          .from("company_reps")
          .select("companies(id, company_name, company_type, region)")
          .eq("rep_id", repData.id);

        const compList = (crData ?? [])
          .map((row: any) => {
            const c = Array.isArray(row.companies) ? row.companies[0] : row.companies;
            return c ? {
              id:           c.id,
              company_name: c.company_name,
              company_type: c.company_type ?? "",
              region:       c.region ?? "",
            } : null;
          })
          .filter(Boolean) as Company[];

        setCompanies(compList);

        const monthStart = format(new Date(), "yyyy-MM-01");
        const { data: actData } = await supabase
          .from("activities")
          .select("sqm_done")
          .eq("rep_id", repData.id)
          .gte("activity_date", monthStart);
        setMonthSqm((actData ?? []).reduce((s, a) => s + (a.sqm_done ?? 0), 0));
      }
    }
    load();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownOpen === null) return;
      const ref = dropdownRefs.current[dropdownOpen];
      if (ref && !ref.contains(e.target as Node)) {
        setDropdownOpen(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  function getFilteredCompanies(search: string) {
    if (!search.trim()) return companies;
    const norm = normalizeAr(search);
    return companies.filter(c =>
      normalizeAr(c.company_name).includes(norm) ||
      c.company_name.toLowerCase().includes(search.toLowerCase())
    );
  }

  async function pickCompany(idx: number, c: Company) {
    const updatedRows = [...rows];
    updatedRows[idx] = {
      ...updatedRows[idx],
      company_id:   c.id,
      company_name: c.company_name,
      company_type: c.company_type ?? "",
      region:       c.region ?? "",
      contact_id:   "",
      contact_person: "",
      phone:        "",
      project_id:   "",
      project_name: "",
    };
    setRows(updatedRows);

    const updatedSearch = [...companySearch];
    updatedSearch[idx] = "";
    setCompanySearch(updatedSearch);
    setDropdownOpen(null);

    // Load projects and contacts in parallel if not already loaded
    const loaders: Promise<void>[] = [];

    if (projectsMap[c.id] === undefined) {
      loaders.push(
        supabase
          .from("projects")
          .select("id, project_name, project_code, stage")
          .eq("customer_id", c.id)
          .order("created_at", { ascending: false })
          .then(({ data }) => {
            const active = (data ?? []).filter(
              p => !["Won", "Delivered", "Lost"].includes(p.stage)
            );
            setProjectsMap(m => ({ ...m, [c.id]: active }));
          })
      );
    }

    if (contactsMap[c.id] === undefined) {
      loaders.push(
        supabase
          .from("contacts")
          .select("id, full_name, title, phone, whatsapp")
          .eq("company_id", c.id)
          .order("is_primary", { ascending: false })
          .then(({ data }) => {
            setContactsMap(m => ({ ...m, [c.id]: data ?? [] }));
          })
      );
    }

    await Promise.all(loaders);
  }

  function clearCompany(idx: number) {
    const updatedRows = [...rows];
    updatedRows[idx] = {
      ...updatedRows[idx],
      company_id:   "",
      company_name: "",
      company_type: "",
      region:       "",
      contact_id:   "",
      contact_person: "",
      phone:        "",
      project_id:   "",
      project_name: "",
    };
    setRows(updatedRows);
    const updatedSearch = [...companySearch];
    updatedSearch[idx] = "";
    setCompanySearch(updatedSearch);
  }

  function updateRow(idx: number, field: keyof Row, value: string) {
    const updated = [...rows];
    updated[idx] = { ...updated[idx], [field]: value };
    setRows(updated);
  }

  function pickContact(idx: number, contact: Contact) {
    const updated = [...rows];
    updated[idx] = {
      ...updated[idx],
      contact_id:     contact.id,
      contact_person: contact.full_name,
      phone:          contact.phone ?? contact.whatsapp ?? "",
    };
    setRows(updated);
  }

  function addRow() {
    setRows([...rows, emptyRow()]);
    setCompanySearch([...companySearch, ""]);
  }

  function removeRow(idx: number) {
    if (rows.length === 1) return;
    setRows(rows.filter((_, i) => i !== idx));
    setCompanySearch(companySearch.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    const unselected = rows.filter(r => r.company_name && !r.company_id);
    if (unselected.length > 0) {
      setError("Please select a company from the dropdown for each row.");
      return;
    }
    const validRows = rows.filter(r => r.company_id && r.interaction_type);
    if (validRows.length === 0) {
      setError("Add at least one activity with a company and interaction type selected.");
      return;
    }
    if (!rep) return;
    setSubmitting(true);
    setError("");

    const inserts = validRows.map(r => ({
      activity_date:    r.date,
      rep_id:           rep.id,
      rep_name:         rep.name,
      company_id:       r.company_id,
      company_name:     r.company_name,
      company_type:     r.company_type || null,
      contact_id:       r.contact_id   || null,
      contact_person:   r.contact_person || null,
      phone:            r.phone         || null,
      interaction_type: r.interaction_type,
      project_id:       r.project_id    || null,
      project_name:     r.project_name  || null,
      notes:            r.notes         || null,
      region:           r.region        || null,
      sqm_done:         parseFloat(r.sqm_done)     || 0,
      sqm_expected:     parseFloat(r.sqm_expected) || 0,
    }));

    const { error: err } = await supabase.from("activities").insert(inserts);
    if (err) { setError("Failed to submit: " + err.message); setSubmitting(false); return; }

    setSubmitted(true);
    setRows([emptyRow()]);
    setCompanySearch([""]);
    setSubmitting(false);
    setTimeout(() => setSubmitted(false), 4000);
  }

  const target = rep?.monthly_target_sqm ?? 0;
  const pct    = target > 0 ? Math.min(100, Math.round((monthSqm / target) * 100)) : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Report</h1>
          <p className="text-gray-500 text-sm mt-1">{format(new Date(), "EEEE, dd MMMM yyyy")}</p>
        </div>
        {rep && target > 0 && (
          <div className="card px-5 py-3 min-w-48">
            <div className="text-xs text-gray-500 mb-1">My SQM this month</div>
            <div className="flex items-end gap-1 mb-2">
              <span className="text-xl font-bold text-gray-900">{monthSqm.toLocaleString()}</span>
              <span className="text-sm text-gray-400 mb-0.5">/ {target.toLocaleString()} m²</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className={`h-1.5 rounded-full ${pct >= 100 ? "bg-green-500" : "bg-brand-blue"}`}
                style={{ width: `${pct}%` }} />
            </div>
            <div className="text-right text-xs text-gray-400 mt-0.5">{pct}%</div>
          </div>
        )}
      </div>

      {submitted && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3 text-green-800">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <span className="font-medium">Report submitted successfully!</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-700 text-sm">{error}</div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Today's Activities</h2>
            <p className="text-xs text-gray-500 mt-0.5">One row per interaction. Select company, contact, and project from your registered data.</p>
          </div>
          <button onClick={addRow} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add row
          </button>
        </div>

        <div className="divide-y divide-gray-50">
          {rows.map((row, idx) => {
            const search          = companySearch[idx] ?? "";
            const filteredComp    = getFilteredCompanies(search);
            const isOpen          = dropdownOpen === idx;
            const companyProjects = row.company_id ? (projectsMap[row.company_id] ?? null) : null;
            const companyContacts = row.company_id ? (contactsMap[row.company_id] ?? null) : null;

            return (
              <div key={idx} className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Activity #{idx + 1}</span>
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(idx)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>

                {/* Row 1: date + company + interaction */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Date *</label>
                    <input type="date" className="input" value={row.date}
                      onChange={e => updateRow(idx, "date", e.target.value)} />
                  </div>

                  {/* Searchable company dropdown */}
                  <div className="relative" ref={el => { dropdownRefs.current[idx] = el; }}>
                    <label className="label">Company * (must select)</label>
                    {row.company_id ? (
                      <div className="input flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{row.company_name}</span>
                        <button type="button" onClick={() => clearCompany(idx)}
                          className="text-gray-400 hover:text-red-500 flex-shrink-0 transition-colors" title="Change">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <input className="input"
                        placeholder={companies.length === 0 ? "No companies assigned yet" : "Search your companies…"}
                        value={search}
                        disabled={companies.length === 0}
                        onChange={e => {
                          const updated = [...companySearch];
                          updated[idx] = e.target.value;
                          setCompanySearch(updated);
                          setDropdownOpen(idx);
                        }}
                        onFocus={() => setDropdownOpen(idx)}
                        autoComplete="off"
                      />
                    )}
                    {!row.company_id && isOpen && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl z-50 mt-1 overflow-hidden max-h-60 overflow-y-auto">
                        {filteredComp.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-400">No matches found.</div>
                        ) : (
                          filteredComp.map(c => (
                            <button key={c.id} type="button"
                              className="w-full text-left px-4 py-3 hover:bg-brand-light text-sm border-b border-gray-50 last:border-0 transition-colors"
                              onMouseDown={e => { e.preventDefault(); pickCompany(idx, c); }}>
                              <div className="font-medium text-gray-900">{c.company_name}</div>
                              {(c.company_type || c.region) && (
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {[c.company_type, c.region].filter(Boolean).join(" · ")}
                                </div>
                              )}
                            </button>
                          ))
                        )}
                        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                          {companies.length} companies assigned to you
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="label">Interaction *</label>
                    <select className="input" value={row.interaction_type}
                      onChange={e => updateRow(idx, "interaction_type", e.target.value)}>
                      <option value="">Select…</option>
                      {INTERACTIONS.map(i => <option key={i}>{i}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 2: contact + project + region */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                  {/* Contact dropdown */}
                  <div>
                    <label className="label">Contact Person</label>
                    {!row.company_id ? (
                      <select className="input" disabled><option>Select company first</option></select>
                    ) : companyContacts === null ? (
                      <select className="input" disabled><option>Loading…</option></select>
                    ) : companyContacts.length === 0 ? (
                      <div>
                        <select className="input" disabled><option>No contacts registered</option></select>
                        <p className="text-xs text-gray-400 mt-1">Add contacts under My Companies → {row.company_name}</p>
                      </div>
                    ) : (
                      <select className="input" value={row.contact_id}
                        onChange={e => {
                          const cid = e.target.value;
                          if (!cid) {
                            updateRow(idx, "contact_id", "");
                            updateRow(idx, "contact_person", "");
                            updateRow(idx, "phone", "");
                            return;
                          }
                          const contact = companyContacts.find(c => c.id === cid);
                          if (contact) pickContact(idx, contact);
                        }}>
                        <option value="">Select contact…</option>
                        {companyContacts.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.full_name}{c.title ? ` — ${c.title}` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    {/* Show phone read-only when contact selected */}
                    {row.phone && (
                      <p className="text-xs text-gray-500 mt-1">📞 {row.phone}</p>
                    )}
                  </div>

                  {/* Project dropdown */}
                  <div>
                    <label className="label">Project</label>
                    {!row.company_id ? (
                      <select className="input" disabled><option>Select company first</option></select>
                    ) : companyProjects === null ? (
                      <select className="input" disabled><option>Loading…</option></select>
                    ) : companyProjects.length === 0 ? (
                      <select className="input" disabled><option>No active projects</option></select>
                    ) : (
                      <select className="input" value={row.project_id}
                        onChange={e => {
                          const pid = e.target.value;
                          const proj = companyProjects.find(p => p.id === pid);
                          updateRow(idx, "project_id", pid);
                          updateRow(idx, "project_name", proj ? (proj.project_name || proj.project_code) : "");
                        }}>
                        <option value="">No specific project</option>
                        {companyProjects.map(p => (
                          <option key={p.id} value={p.id}>{p.project_name || p.project_code}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Region — pre-filled from company, editable */}
                  <div>
                    <label className="label">Region</label>
                    <select className="input" value={row.region}
                      onChange={e => updateRow(idx, "region", e.target.value)}>
                      <option value="">Select…</option>
                      {REGIONS.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 3: SQM */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">SQM Confirmed</label>
                    <input type="number" className="input" placeholder="0" min="0"
                      value={row.sqm_done}
                      onChange={e => updateRow(idx, "sqm_done", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">SQM Expected</label>
                    <input type="number" className="input" placeholder="0" min="0"
                      value={row.sqm_expected}
                      onChange={e => updateRow(idx, "sqm_expected", e.target.value)} />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="label">Notes / Outcome</label>
                  <textarea className="input resize-none" rows={2}
                    placeholder="What happened? Next steps?"
                    value={row.notes}
                    onChange={e => updateRow(idx, "notes", e.target.value)} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <p className="text-xs text-gray-500">
            {rows.length} row{rows.length !== 1 ? "s" : ""} · All data must be selected from your registered records
          </p>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex items-center gap-2 px-6">
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Submitting…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Submit Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
