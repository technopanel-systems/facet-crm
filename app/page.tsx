"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";

type Company = { id: string; company_name: string; company_type: string; region: string };
type Project = { id: string; project_name: string; project_code: string; customer_id: string };
type Contact = { id: string; full_name: string; company_id: string };

type Row = {
  date: string; 
  company_id: string; 
  contact_id: string; 
  project_id: string;
  interaction_type: string; 
  notes: string; 
  sqm_done: string; 
  sqm_expected: string;
};

const emptyRow = (): Row => ({
  date: format(new Date(), "yyyy-MM-dd"),
  company_id: "", contact_id: "", project_id: "",
  interaction_type: "", notes: "", sqm_done: "", sqm_expected: "",
});

const INTERACTIONS = ["Visit", "Call", "WhatsApp", "Email", "Meeting", "Site Visit"];

export default function RepPage() {
  const supabase = createClient();
  const [rep, setRep]             = useState<{ id: string; name: string; monthly_target_sqm: number } | null>(null);
  const [rows, setRows]           = useState<Row[]>([emptyRow()]);
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects]   = useState<Project[]>([]);
  const [contacts, setContacts]   = useState<Contact[]>([]);
  
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [error, setError]             = useState("");
  const [monthSqm, setMonthSqm]       = useState(0);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: repData } = await supabase.from("reps").select("id, name, monthly_target_sqm").eq("auth_user_id", user.id).single();
      setRep(repData);
      
      if (repData) {
        // Fetch assigned companies via junction table
        const { data: compReps } = await supabase.from("company_reps").select("company_id, companies(id, company_name, company_type, region)").eq("rep_id", repData.id);
        const myCompanies = compReps?.map(cr => Array.isArray(cr.companies) ? cr.companies[0] : cr.companies).filter(Boolean) as Company[];
        setCompanies(myCompanies || []);

        if (myCompanies && myCompanies.length > 0) {
            const compIds = myCompanies.map(c => c.id);
            const { data: contactData } = await supabase.from("contacts").select("id, full_name, company_id").in("company_id", compIds);
            setContacts(contactData || []);
        }

        const { data: projReps } = await supabase.from("project_reps").select("project_id, projects(id, project_name, project_code, customer_id)").eq("rep_id", repData.id);
        const myProjects = projReps?.map(pr => Array.isArray(pr.projects) ? pr.projects[0] : pr.projects).filter(Boolean) as Project[];
        setProjects(myProjects || []);

        const monthStart = format(new Date(), "yyyy-MM-01");
        const { data: actData } = await supabase.from("activities").select("sqm_done").eq("rep_id", repData.id).gte("activity_date", monthStart);
        setMonthSqm((actData ?? []).reduce((s, a) => s + (Number(a.sqm_done) || 0), 0));
      }
    }
    load();
  }, []);

  function updateRow(idx: number, field: keyof Row, value: string) {
    const updated = [...rows];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "company_id") {
        updated[idx].project_id = "";
        updated[idx].contact_id = "";
    }
    setRows(updated);
  }

  function addRow() { setRows([...rows, emptyRow()]); }
  function removeRow(idx: number) { if (rows.length === 1) return; setRows(rows.filter((_, i) => i !== idx)); }

  async function handleSubmit() {
    const validRows = rows.filter(r => r.company_id && r.interaction_type);
    if (validRows.length === 0) { setError("Add at least one activity with a company and interaction type."); return; }
    if (!rep) return;
    
    setSubmitting(true);
    setError("");

    const inserts = validRows.map(r => {
      const selectedCompany = companies.find(c => c.id === r.company_id);
      const selectedContact = contacts.find(c => c.id === r.contact_id);
      const selectedProject = projects.find(p => p.id === r.project_id);

      return {
        activity_date:    r.date,
        rep_id:           rep.id,
        rep_name:         rep.name,
        company_id:       r.company_id,
        company_name:     selectedCompany?.company_name || "Unknown",
        company_type:     selectedCompany?.company_type || null,
        region:           selectedCompany?.region || null,
        contact_id:       r.contact_id || null,
        contact_person:   selectedContact?.full_name || null,
        project_id:       r.project_id || null,
        project_name:     selectedProject?.project_name || null,
        interaction_type: r.interaction_type,
        notes:            r.notes || null,
        sqm_done:         parseFloat(r.sqm_done) || 0,
        sqm_expected:     parseFloat(r.sqm_expected) || 0,
      };
    });

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
              <div className={`h-1.5 rounded-full ${pct >= 100 ? "bg-green-500" : "bg-brand-blue"}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="text-right text-xs text-gray-400 mt-0.5">{pct}%</div>
          </div>
        )}
      </div>

      {submitted && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3 text-green-800">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span className="font-medium">Report submitted successfully!</span>
        </div>
      )}
      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-red-700 text-sm">{error}</div>}

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Today's Activities</h2>
            <p className="text-xs text-gray-500 mt-0.5">Select a company to link projects and contacts.</p>
          </div>
          <button onClick={addRow} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add row
          </button>
        </div>

        <div className="divide-y divide-gray-50">
          {rows.map((row, idx) => {
            const availableProjects = projects.filter(p => p.customer_id === row.company_id);
            const availableContacts = contacts.filter(c => c.company_id === row.company_id);

            return (
              <div key={idx} className="p-5 space-y-4 relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Activity #{idx + 1}</span>
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(idx)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 relative">
                  <div>
                    <label className="label">Date *</label>
                    <input type="date" className="input" value={row.date} onChange={e => updateRow(idx, "date", e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Company *</label>
                    <select className="input" value={row.company_id} onChange={e => updateRow(idx, "company_id", e.target.value)}>
                      <option value="">Select Company...</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Interaction *</label>
                    <select className="input" value={row.interaction_type} onChange={e => updateRow(idx, "interaction_type", e.target.value)}>
                      <option value="">Select...</option>
                      {INTERACTIONS.map(i => <option key={i}>{i}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Contact Person</label>
                    <select className="input" value={row.contact_id} onChange={e => updateRow(idx, "contact_id", e.target.value)} disabled={!row.company_id}>
                      <option value="">{availableContacts.length ? "Select Contact..." : "No contacts available"}</option>
                      {availableContacts.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Project</label>
                    <select className="input" value={row.project_id} onChange={e => updateRow(idx, "project_id", e.target.value)} disabled={!row.company_id}>
                      <option value="">{availableProjects.length ? "Select Project..." : "No projects available"}</option>
                      {availableProjects.map(p => <option key={p.id} value={p.id}>{p.project_name || p.project_code}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">SQM Confirmed</label>
                    <input type="number" className="input" placeholder="0" min="0" value={row.sqm_done} onChange={e => updateRow(idx, "sqm_done", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">SQM Expected</label>
                    <input type="number" className="input" placeholder="0" min="0" value={row.sqm_expected} onChange={e => updateRow(idx, "sqm_expected", e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Notes / Outcome</label>
                    <textarea className="input resize-none" rows={1} placeholder="Next steps?" value={row.notes} onChange={e => updateRow(idx, "notes", e.target.value)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <p className="text-xs text-gray-500">{rows.length} row{rows.length !== 1 ? "s" : ""} · Required fields marked with *</p>
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex items-center gap-2 px-6">
            {submitting ? "Submitting..." : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
