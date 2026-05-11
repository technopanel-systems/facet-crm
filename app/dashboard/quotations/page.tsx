"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, addDays } from "date-fns";

const PRODUCTS  = ["Normal ACP","FR B1 ACP","FR A2 ACP","A2G2 ACP","Other"];
const FINISHES  = ["Solid Color","Wood Finish","Custom"];
const STATUSES  = ["pending","submitted","won","lost","expired","cancelled"];

const STATUS_STYLE: Record<string,string> = {
  pending:   "bg-amber-100 text-amber-800",
  submitted: "bg-blue-100 text-blue-700",
  won:       "bg-green-100 text-green-800",
  lost:      "bg-red-100 text-red-700",
  expired:   "bg-gray-100 text-gray-500",
  cancelled: "bg-gray-100 text-gray-500",
};

type Company = { id: string; company_name: string };
type Project = { id: string; project_code: string; project_name: string | null; customer_id: string };
type Rep     = { id: string; name: string };
type Quotation = {
  id: string; quotation_code: string; quote_date: string;
  valid_until: string | null; status: string;
  product_type: string | null; finish: string | null;
  sqm_quoted: number; price_per_sqm: number | null;
  sqm_invoiced: number; sqm_delivered: number;
  revision_number: number; notes: string | null;
  project_id: string; company_id: string;
  rep_id: string | null; coordinator_id: string | null;
  companies: any; projects: any; reps: any;
};

const emptyForm = () => ({
  company_id: "", project_id: "", rep_id: "",
  product_type: "", finish: "", sqm_quoted: "",
  price_per_sqm: "", quote_date: format(new Date(),"yyyy-MM-dd"),
  valid_until: format(addDays(new Date(),30),"yyyy-MM-dd"),
  revision_number: "1", notes: "",
});

export default function QuotationsPage() {
  const supabase = createClient();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [companies, setCompanies]   = useState<Company[]>([]);
  const [projects, setProjects]     = useState<Project[]>([]);
  const [reps, setReps]             = useState<Rep[]>([]);
  const [currentRepId, setCurrentRepId] = useState<string>("");
  const [loading, setLoading]       = useState(true);
  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState(emptyForm());
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRep, setFilterRep]   = useState("");
  const [search, setSearch]         = useState("");
  const [editId, setEditId]         = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editSqmInvoiced, setEditSqmInvoiced]   = useState("");
  const [editSqmDelivered, setEditSqmDelivered] = useState("");

  // Projects filtered by selected company
  const companyProjects = projects.filter(p => !form.company_id || p.customer_id === form.company_id);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: rep } = await supabase.from("reps").select("id").eq("auth_user_id", user.id).single();
      if (rep) setCurrentRepId(rep.id);
    }

    const [qRes, cRes, pRes, rRes] = await Promise.all([
      supabase.from("quotations")
        .select("*,companies(company_name),projects(project_code,project_name),reps(name)")
        .order("created_at", { ascending: false }),
      supabase.from("companies").select("id,company_name").order("company_name"),
      supabase.from("projects").select("id,project_code,project_name,customer_id").order("created_at", { ascending: false }),
      supabase.from("reps").select("id,name").in("role",["rep","marketing"]).eq("status","active").order("name"),
    ]);
    setQuotations((qRes.data ?? []) as unknown as Quotation[]);
    setCompanies(cRes.data ?? []);
    setProjects(pRes.data ?? []);
    setReps(rRes.data ?? []);
    setLoading(false);
  }

  async function handleAdd() {
    setError("");
    if (!form.company_id) { setError("Select a company."); return; }
    if (!form.project_id) { setError("Select a project."); return; }
    if (!form.sqm_quoted)  { setError("Enter quoted SQM."); return; }
    setSaving(true);

    const { error: err } = await supabase.from("quotations").insert({
      company_id:      form.company_id,
      project_id:      form.project_id,
      rep_id:          form.rep_id || null,
      coordinator_id:  currentRepId || null,
      product_type:    form.product_type  || null,
      finish:          form.finish        || null,
      sqm_quoted:      parseFloat(form.sqm_quoted)     || 0,
      price_per_sqm:   form.price_per_sqm ? parseFloat(form.price_per_sqm) : null,
      quote_date:      form.quote_date,
      valid_until:     form.valid_until   || null,
      revision_number: parseInt(form.revision_number)  || 1,
      notes:           form.notes         || null,
      status:          "pending",
    });

    if (err) { setError(err.message); setSaving(false); return; }
    setForm(emptyForm());
    setShowAdd(false);
    setSaving(false);
    load();
  }

  async function saveEdit(id: string) {
    await supabase.from("quotations").update({
      status:        editStatus,
      sqm_invoiced:  parseFloat(editSqmInvoiced)  || 0,
      sqm_delivered: parseFloat(editSqmDelivered) || 0,
    }).eq("id", id);
    setEditId(null);
    load();
  }

  async function handleDelete(id: string, code: string) {
    if (!confirm(`Delete quotation ${code}?`)) return;
    await supabase.from("quotations").delete().eq("id", id);
    load();
  }

  const filtered = quotations.filter(q => {
    const compName = Array.isArray(q.companies) ? q.companies[0]?.company_name : q.companies?.company_name;
    const repName  = Array.isArray(q.reps) ? q.reps[0]?.name : q.reps?.name;
    const projName = Array.isArray(q.projects) ? q.projects[0]?.project_name : q.projects?.project_name;
    const s = search.toLowerCase();
    return (
      (!search       || (q.quotation_code||"").toLowerCase().includes(s) || (compName||"").toLowerCase().includes(s) || (projName||"").toLowerCase().includes(s)) &&
      (!filterStatus || q.status  === filterStatus) &&
      (!filterRep    || q.rep_id  === filterRep)
    );
  });

  const totalSqmQuoted   = filtered.reduce((s,q) => s + (q.sqm_quoted   ?? 0), 0);
  const totalSqmInvoiced = filtered.reduce((s,q) => s + (q.sqm_invoiced ?? 0), 0);
  const wonCount         = filtered.filter(q => q.status === "won").length;

  // Check for expiring soon (within 7 days)
  const today   = new Date();
  const in7days = new Date(); in7days.setDate(today.getDate() + 7);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? "—" : `${filtered.length} quotations · ${totalSqmQuoted.toLocaleString()} SQM quoted · ${wonCount} won`}
          </p>
        </div>
        <button onClick={() => { setShowAdd(true); setError(""); }} className="btn-primary flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Quotation
        </button>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "SQM Quoted",   value: totalSqmQuoted.toLocaleString()   + " m²", color: "text-brand-blue" },
            { label: "SQM Invoiced", value: totalSqmInvoiced.toLocaleString() + " m²", color: "text-green-600" },
            { label: "Won",          value: wonCount,                                    color: "text-green-700" },
          ].map(c => (
            <div key={c.label} className="card px-5 py-4 text-center">
              <div className="text-xs text-gray-500 mb-1">{c.label}</div>
              <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search by code, company, project…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-40" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input w-44" value={filterRep} onChange={e => setFilterRep(e.target.value)}>
          <option value="">All Reps</option>
          {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {(search || filterStatus || filterRep) && (
          <button onClick={() => { setSearch(""); setFilterStatus(""); setFilterRep(""); }} className="btn-secondary text-sm px-3">Clear</button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="card p-10 text-center text-gray-400">Loading quotations…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          {search || filterStatus || filterRep ? "No quotations match your filters." : "No quotations yet. Create the first one above."}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Company / Project</th>
                <th className="px-4 py-3">Rep</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SQM / Price</th>
                <th className="px-4 py-3">Validity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(q => {
                const compName = Array.isArray(q.companies) ? q.companies[0]?.company_name : q.companies?.company_name;
                const projCode = Array.isArray(q.projects)  ? q.projects[0]?.project_code  : q.projects?.project_code;
                const projName = Array.isArray(q.projects)  ? q.projects[0]?.project_name  : q.projects?.project_name;
                const repName  = Array.isArray(q.reps)      ? q.reps[0]?.name              : q.reps?.name;
                const isExpiring = q.valid_until && new Date(q.valid_until) <= in7days && new Date(q.valid_until) >= today && q.status === "submitted";
                const totalRef = q.sqm_quoted && q.price_per_sqm ? (q.sqm_quoted * q.price_per_sqm).toLocaleString() : null;

                return (
                  <>
                    <tr key={q.id} className={`hover:bg-gray-50/60 transition-colors ${isExpiring ? "bg-amber-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{q.quotation_code}</div>
                        <div className="text-xs text-gray-400">Rev. {q.revision_number}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{compName || "—"}</div>
                        <div className="text-xs text-gray-400">{projName || projCode || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{repName || "—"}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        <div>{q.product_type || "—"}</div>
                        {q.finish && <div className="text-gray-400">{q.finish}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{(q.sqm_quoted||0).toLocaleString()} m²</div>
                        {q.price_per_sqm && <div className="text-xs text-gray-500">SAR {q.price_per_sqm}/m²</div>}
                        {totalRef && <div className="text-xs text-gray-400">≈ SAR {totalRef}</div>}
                        {q.sqm_invoiced > 0 && <div className="text-xs text-green-700 font-medium">{q.sqm_invoiced.toLocaleString()} invoiced</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="text-gray-600">{q.quote_date}</div>
                        {q.valid_until && (
                          <div className={isExpiring ? "text-amber-600 font-medium" : "text-gray-400"}>
                            Until {q.valid_until}{isExpiring ? " ⚠️" : ""}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[q.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {q.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <button onClick={() => { setEditId(q.id); setEditStatus(q.status); setEditSqmInvoiced(String(q.sqm_invoiced||0)); setEditSqmDelivered(String(q.sqm_delivered||0)); }}
                            className="text-brand-blue hover:underline text-xs">Update</button>
                          <button onClick={() => handleDelete(q.id, q.quotation_code)}
                            className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                        </div>
                      </td>
                    </tr>
                    {/* Inline edit row */}
                    {editId === q.id && (
                      <tr key={`${q.id}-edit`} className="bg-blue-50/40">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="flex flex-wrap items-end gap-4">
                            <div>
                              <label className="label">Status</label>
                              <select className="input w-36" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="label">SQM Invoiced</label>
                              <input type="number" className="input w-32" value={editSqmInvoiced} onChange={e => setEditSqmInvoiced(e.target.value)} min="0" />
                            </div>
                            <div>
                              <label className="label">SQM Delivered</label>
                              <input type="number" className="input w-32" value={editSqmDelivered} onChange={e => setEditSqmDelivered(e.target.value)} min="0" />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => saveEdit(q.id)} className="btn-primary text-sm">Save</button>
                              <button onClick={() => setEditId(null)} className="btn-secondary text-sm">Cancel</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Quotation Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-lg">New Quotation</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

              <div>
                <label className="label">Company *</label>
                <select className="input" value={form.company_id}
                  onChange={e => setForm({...form, company_id: e.target.value, project_id: ""})}>
                  <option value="">Select company…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Project *</label>
                <select className="input" value={form.project_id}
                  onChange={e => setForm({...form, project_id: e.target.value})}
                  disabled={!form.company_id}>
                  <option value="">Select project…</option>
                  {companyProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.project_name || p.project_code}</option>
                  ))}
                </select>
                {form.company_id && companyProjects.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No projects found for this company. Add a project first.</p>
                )}
              </div>

              <div>
                <label className="label">Assign to Rep</label>
                <select className="input" value={form.rep_id}
                  onChange={e => setForm({...form, rep_id: e.target.value})}>
                  <option value="">Select rep…</option>
                  {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Product Type</label>
                  <select className="input" value={form.product_type}
                    onChange={e => setForm({...form, product_type: e.target.value})}>
                    <option value="">Select…</option>
                    {PRODUCTS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Finish</label>
                  <select className="input" value={form.finish}
                    onChange={e => setForm({...form, finish: e.target.value})}>
                    <option value="">Select…</option>
                    {FINISHES.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">SQM Quoted *</label>
                  <input type="number" className="input" value={form.sqm_quoted} min="0"
                    onChange={e => setForm({...form, sqm_quoted: e.target.value})} placeholder="0" />
                </div>
                <div>
                  <label className="label">Price / m² (SAR)</label>
                  <input type="number" className="input" value={form.price_per_sqm} min="0"
                    onChange={e => setForm({...form, price_per_sqm: e.target.value})} placeholder="Optional" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Quote Date</label>
                  <input type="date" className="input" value={form.quote_date}
                    onChange={e => setForm({...form, quote_date: e.target.value})} />
                </div>
                <div>
                  <label className="label">Valid Until</label>
                  <input type="date" className="input" value={form.valid_until}
                    onChange={e => setForm({...form, valid_until: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="label">Revision Number</label>
                <input type="number" className="input w-24" value={form.revision_number} min="1"
                  onChange={e => setForm({...form, revision_number: e.target.value})} />
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} value={form.notes}
                  onChange={e => setForm({...form, notes: e.target.value})} />
              </div>

              {form.sqm_quoted && form.price_per_sqm && (
                <div className="bg-brand-light rounded-lg px-4 py-3 text-sm">
                  <span className="text-gray-600">Reference Total: </span>
                  <span className="font-bold text-brand-blue">
                    SAR {(parseFloat(form.sqm_quoted) * parseFloat(form.price_per_sqm)).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleAdd} disabled={saving || !form.company_id || !form.project_id || !form.sqm_quoted} className="btn-primary">
                {saving ? "Saving…" : "Create Quotation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
