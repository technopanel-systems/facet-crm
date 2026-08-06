"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, addDays } from "date-fns";

const CLASSES      = ["Class A", "Class B", "Class A2G2", "Class A2G1"];
const FR_RATINGS   = ["A2", "B1", "Normal"];
const SUPPLIERS    = ["N", "K", "D", "C", "G", "G1", "Y"];
const WIDTHS       = ["1.24", "1.5", "2"];
const THICKNESSES  = [4, 5, 6];
const SERVICES     = ["Cutting", "Grooving", "Bending", "CNC"];
const STATUSES     = ["pending", "submitted", "won", "lost", "expired", "cancelled"];

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-800",
  submitted: "bg-blue-100 text-blue-700",
  won:       "bg-green-100 text-green-800",
  lost:      "bg-red-100 text-red-700",
  expired:   "bg-gray-100 text-gray-500",
  cancelled: "bg-gray-100 text-gray-500",
};

type Company   = { id: string; company_name: string };
type Project   = { id: string; project_code: string; project_name: string | null; customer_id: string };
type Rep       = { id: string; name: string };

type QuotationItem = {
  id?: string;
  class: string;
  fr_rating: string;
  color_code: string;
  supplier_code: string;
  width_m: string;
  width_is_custom: boolean;
  length_m: string;
  num_sheets: string;
  thickness_mm: string;
  price_per_sqm: string;
};

type QuotationService = {
  id?: string;
  service_type: string;
  price_per_sqm: string;
};

type Quotation = {
  id: string; quotation_code: string; quote_date: string;
  valid_until: string | null; status: string;
  sqm_quoted: number; price_per_sqm: number | null;
  sqm_invoiced: number; sqm_delivered: number;
  revision_number: number; notes: string | null;
  erp_quotation_id: string | null;
  cancellation_reason: string | null;
  project_id: string; company_id: string;
  rep_id: string | null; assigned_to_id: string | null;
  companies: any; projects: any; reps: any;
};

const emptyItem = (): QuotationItem => ({
  class: '', fr_rating: '', color_code: '', supplier_code: '',
  width_m: '', width_is_custom: false, length_m: '',
  num_sheets: '1', thickness_mm: '4', price_per_sqm: '',
});

const emptyForm = () => ({
  company_id: "", project_id: "", assigned_to_id: "",
  erp_quotation_id: "",
  quote_date: format(new Date(), "yyyy-MM-dd"),
  valid_until: format(addDays(new Date(), 30), "yyyy-MM-dd"),
  notes: "",
});

export default function QuotationsPage() {
  const supabase = createClient();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [companies, setCompanies]   = useState<Company[]>([]);
  const [projects, setProjects]     = useState<Project[]>([]);
  const [allReps, setAllReps]       = useState<Rep[]>([]);
  const [currentRepId, setCurrentRepId] = useState<string>("");
  const [loading, setLoading]       = useState(true);
  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState(emptyForm());
  const [items, setItems]           = useState<QuotationItem[]>([emptyItem()]);
  const [services, setServices]     = useState<QuotationService[]>([]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRep, setFilterRep]   = useState("");
  const [search, setSearch]         = useState("");
  const [editId, setEditId]         = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editSqmInvoiced, setEditSqmInvoiced]   = useState("");
  const [editSqmDelivered, setEditSqmDelivered] = useState("");
  const [editCancelReason, setEditCancelReason] = useState("");

  const companyProjects = projects.filter(p =>
    !form.company_id || p.customer_id === form.company_id
  );

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
  .select("*,companies(company_name),projects(project_code,project_name)")
  .order("created_at", { ascending: false }),
      supabase.from("companies").select("id,company_name").order("company_name"),
      supabase.from("projects").select("id,project_code,project_name,customer_id").order("created_at", { ascending: false }),
      supabase.from("reps").select("id,name").eq("status", "active").order("name"),
    ]);

    setQuotations((qRes.data ?? []) as unknown as Quotation[]);
    setCompanies(cRes.data ?? []);
    setProjects(pRes.data ?? []);
    setAllReps(rRes.data ?? []);
    setLoading(false);
  }

  // Item helpers
  function updateItem(idx: number, field: keyof QuotationItem, value: any) {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'width_m' && value === 'custom') {
      updated[idx].width_is_custom = true;
      updated[idx].width_m = '';
    } else if (field === 'width_m') {
      updated[idx].width_is_custom = false;
    }
    setItems(updated);
  }

  function addItem() { setItems([...items, emptyItem()]); }
  function removeItem(idx: number) {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  }

  function addService() {
    setServices([...services, { service_type: '', price_per_sqm: '' }]);
  }
  function removeService(idx: number) {
    setServices(services.filter((_, i) => i !== idx));
  }
  function updateService(idx: number, field: keyof QuotationService, value: string) {
    const updated = [...services];
    updated[idx] = { ...updated[idx], [field]: value };
    setServices(updated);
  }

  // Compute totals for display
  function itemTotalSqm(item: QuotationItem) {
    const w = parseFloat(item.width_m) || 0;
    const l = parseFloat(item.length_m) || 0;
    const n = parseInt(item.num_sheets) || 0;
    return w * l * n;
  }

  function itemTotalPrice(item: QuotationItem) {
    return itemTotalSqm(item) * (parseFloat(item.price_per_sqm) || 0);
  }

  const grandTotalSqm   = items.reduce((s, i) => s + itemTotalSqm(i), 0);
  const grandTotalPrice = items.reduce((s, i) => s + itemTotalPrice(i), 0);

  async function handleAdd() {
    setError("");
    if (!form.company_id)  { setError("Select a company."); return; }
    if (!form.project_id)  { setError("Select a project."); return; }
    if (items.some(i => !i.class || !i.fr_rating || !i.width_m || !i.length_m)) {
      setError("Fill in Class, FR Rating, Width, and Length for all product lines."); return;
    }
    setSaving(true);

    const { data: quot, error: qErr } = await supabase.from("quotations").insert({
      company_id:       form.company_id,
      project_id:       form.project_id,
      rep_id:           form.assigned_to_id || null,
      assigned_to_id:   form.assigned_to_id || null,
      coordinator_id:   currentRepId || null,
      erp_quotation_id: form.erp_quotation_id || null,
      quote_date:       form.quote_date,
      valid_until:      form.valid_until || null,
      notes:            form.notes || null,
      status:           "pending",
      sqm_quoted:       0,
    }).select().single();

    if (qErr || !quot) { setError(qErr?.message ?? "Failed to create quotation."); setSaving(false); return; }

    // Insert items
    const itemInserts = items.map(i => ({
      quotation_id:   quot.id,
      class:          i.class,
      fr_rating:      i.fr_rating,
      color_code:     i.color_code || null,
      supplier_code:  i.supplier_code || null,
      width_m:        parseFloat(i.width_m) || 0,
      width_is_custom: i.width_is_custom,
      length_m:       parseFloat(i.length_m) || 0,
      num_sheets:     parseInt(i.num_sheets) || 1,
      thickness_mm:   parseInt(i.thickness_mm) || 4,
      price_per_sqm:  parseFloat(i.price_per_sqm) || null,
    }));

    await supabase.from("quotation_items").insert(itemInserts);

    // Insert services if any
    if (services.length > 0 && services.some(s => s.service_type)) {
      const svcInserts = services
        .filter(s => s.service_type)
        .map(s => ({
          quotation_id:  quot.id,
          service_type:  s.service_type,
          price_per_sqm: parseFloat(s.price_per_sqm) || null,
        }));
      await supabase.from("quotation_services").insert(svcInserts);
    }

    setForm(emptyForm());
    setItems([emptyItem()]);
    setServices([]);
    setShowAdd(false);
    setSaving(false);
    load();
  }

  async function saveEdit(id: string) {
    const updateData: any = {
      status:          editStatus,
      sqm_invoiced:    parseFloat(editSqmInvoiced)  || 0,
      sqm_delivered:   parseFloat(editSqmDelivered) || 0,
      last_revised_at: new Date().toISOString(),
    };
    if (editStatus === 'cancelled' && editCancelReason) {
      updateData.cancellation_reason = editCancelReason;
    }
    await supabase.from("quotations").update(updateData).eq("id", id);
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
    const projName = Array.isArray(q.projects)  ? q.projects[0]?.project_name  : q.projects?.project_name;
    const s = search.toLowerCase();
    return (
      (!search       || (q.quotation_code||"").toLowerCase().includes(s) || (compName||"").toLowerCase().includes(s) || (projName||"").toLowerCase().includes(s)) &&
      (!filterStatus || q.status === filterStatus) &&
      (!filterRep    || q.rep_id === filterRep || q.assigned_to_id === filterRep)
    );
  });

  const totalSqmQuoted   = filtered.reduce((s, q) => s + (q.sqm_quoted   ?? 0), 0);
  const totalSqmInvoiced = filtered.reduce((s, q) => s + (q.sqm_invoiced ?? 0), 0);
  const wonCount         = filtered.filter(q => q.status === "won").length;

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
        <button onClick={() => { setShowAdd(true); setError(""); setItems([emptyItem()]); setServices([]); setForm(emptyForm()); }}
          className="btn-primary flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Quotation
        </button>
      </div>

      {/* Summary */}
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
          <option value="">All Assigned</option>
          {allReps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {(search || filterStatus || filterRep) && (
          <button onClick={() => { setSearch(""); setFilterStatus(""); setFilterRep(""); }}
            className="btn-secondary text-sm px-3">Clear</button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="card p-10 text-center text-gray-400">Loading quotations…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          {search || filterStatus || filterRep ? "No quotations match your filters." : "No quotations yet."}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Code / ERP</th>
                <th className="px-4 py-3">Company / Project</th>
                <th className="px-4 py-3">Assigned To</th>
                <th className="px-4 py-3">SQM</th>
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
                const repName = allReps.find(r => r.id === q.rep_id || r.id === q.assigned_to_id)?.name || "—";
                const isExpiring = q.valid_until && new Date(q.valid_until) <= in7days && new Date(q.valid_until) >= today && q.status === "submitted";

                return (
                  <>
                    <tr key={q.id} className={`hover:bg-gray-50/60 transition-colors ${isExpiring ? "bg-amber-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{q.quotation_code}</div>
                        {q.erp_quotation_id && <div className="text-xs text-gray-400">ERP: {q.erp_quotation_id}</div>}
                        <div className="text-xs text-gray-400">Rev. {q.revision_number}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{compName || "—"}</div>
                        <div className="text-xs text-gray-400">{projName || projCode || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{repName || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{(q.sqm_quoted||0).toLocaleString()} m²</div>
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
                        {q.status === 'cancelled' && q.cancellation_reason && (
                          <div className="text-xs text-gray-400 mt-0.5">{q.cancellation_reason}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <button onClick={() => {
                            setEditId(q.id);
                            setEditStatus(q.status);
                            setEditSqmInvoiced(String(q.sqm_invoiced||0));
                            setEditSqmDelivered(String(q.sqm_delivered||0));
                            setEditCancelReason(q.cancellation_reason || '');
                          }} className="text-brand-blue hover:underline text-xs">Update</button>
                          <button onClick={() => handleDelete(q.id, q.quotation_code)}
                            className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                        </div>
                      </td>
                    </tr>
                    {/* Inline edit row */}
                    {editId === q.id && (
                      <tr key={`${q.id}-edit`} className="bg-blue-50/40">
                        <td colSpan={7} className="px-4 py-4">
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
                            {editStatus === 'cancelled' && (
                              <div>
                                <label className="label">Cancellation Reason *</label>
                                <input className="input w-56" value={editCancelReason} onChange={e => setEditCancelReason(e.target.value)} placeholder="Why was this cancelled?" />
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button onClick={() => saveEdit(q.id)}
                                disabled={editStatus === 'cancelled' && !editCancelReason}
                                className="btn-primary text-sm">Save</button>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-lg">New Quotation</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="px-6 py-5 space-y-6">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

              {/* Header info */}
              <div className="space-y-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Quotation Info</div>
                <div className="grid grid-cols-2 gap-3">
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
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Assigned To</label>
                    <select className="input" value={form.assigned_to_id}
                      onChange={e => setForm({...form, assigned_to_id: e.target.value})}>
                      <option value="">Select person…</option>
                      {allReps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">ERP Quotation ID</label>
                    <input className="input" value={form.erp_quotation_id}
                      onChange={e => setForm({...form, erp_quotation_id: e.target.value})}
                      placeholder="From your ERP system" />
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
                  <label className="label">Notes</label>
                  <textarea className="input resize-none" rows={2} value={form.notes}
                    onChange={e => setForm({...form, notes: e.target.value})} />
                </div>
              </div>

              {/* Product Lines */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Product Lines</div>
                  <button onClick={addItem} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Product
                  </button>
                </div>

                {items.map((item, idx) => {
                  const sqm   = itemTotalSqm(item);
                  const price = itemTotalPrice(item);
                  return (
                    <div key={idx} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500">Product {idx + 1}</span>
                        {items.length > 1 && (
                          <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Class *</label>
                          <select className="input" value={item.class}
                            onChange={e => updateItem(idx, 'class', e.target.value)}>
                            <option value="">Select…</option>
                            {CLASSES.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label">FR Rating *</label>
                          <select className="input" value={item.fr_rating}
                            onChange={e => updateItem(idx, 'fr_rating', e.target.value)}>
                            <option value="">Select…</option>
                            {FR_RATINGS.map(f => <option key={f}>{f}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="label">Supplier Code</label>
                          <select className="input" value={item.supplier_code}
                            onChange={e => updateItem(idx, 'supplier_code', e.target.value)}>
                            <option value="">Select…</option>
                            {SUPPLIERS.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label">Color Code</label>
                          <input className="input" value={item.color_code}
                            onChange={e => updateItem(idx, 'color_code', e.target.value)}
                            placeholder="e.g. RAL 9016" />
                        </div>
                        <div>
                          <label className="label">Thickness (mm)</label>
                          <select className="input" value={item.thickness_mm}
                            onChange={e => updateItem(idx, 'thickness_mm', e.target.value)}>
                            {THICKNESSES.map(t => <option key={t} value={t}>{t}mm</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="label">Width (m) *</label>
                          <select className="input" value={item.width_is_custom ? 'custom' : item.width_m}
                            onChange={e => {
                              if (e.target.value === 'custom') {
                                updateItem(idx, 'width_is_custom', true);
                                updateItem(idx, 'width_m', '');
                              } else {
                                updateItem(idx, 'width_is_custom', false);
                                updateItem(idx, 'width_m', e.target.value);
                              }
                            }}>
                            <option value="">Select…</option>
                            {WIDTHS.map(w => <option key={w} value={w}>{w}m</option>)}
                            <option value="custom">Other…</option>
                          </select>
                          {item.width_is_custom && (
                            <input type="number" className="input mt-1" placeholder="Width in m"
                              value={item.width_m}
                              onChange={e => updateItem(idx, 'width_m', e.target.value)} />
                          )}
                        </div>
                        <div>
                          <label className="label">Length (m) *</label>
                          <input type="number" className="input" value={item.length_m}
                            onChange={e => updateItem(idx, 'length_m', e.target.value)}
                            placeholder="0.00" min="0" step="0.01" />
                        </div>
                        <div>
                          <label className="label">Sheets</label>
                          <input type="number" className="input" value={item.num_sheets}
                            onChange={e => updateItem(idx, 'num_sheets', e.target.value)}
                            placeholder="1" min="1" />
                        </div>
                        <div>
                          <label className="label">Price/m²</label>
                          <input type="number" className="input" value={item.price_per_sqm}
                            onChange={e => updateItem(idx, 'price_per_sqm', e.target.value)}
                            placeholder="SAR" min="0" />
                        </div>
                      </div>

                      {sqm > 0 && (
                        <div className="bg-brand-light rounded-lg px-4 py-2 text-xs flex gap-6">
                          <span className="text-gray-600">Total SQM: <span className="font-bold text-brand-blue">{sqm.toLocaleString(undefined, {maximumFractionDigits: 2})} m²</span></span>
                          {price > 0 && <span className="text-gray-600">Total Price: <span className="font-bold text-brand-blue">SAR {price.toLocaleString(undefined, {maximumFractionDigits: 0})}</span></span>}
                          {price > 0 && <span className="text-gray-600">+15% VAT: <span className="font-bold text-gray-700">SAR {(price * 1.15).toLocaleString(undefined, {maximumFractionDigits: 0})}</span></span>}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Grand total */}
                {grandTotalSqm > 0 && (
                  <div className="bg-gray-900 text-white rounded-xl px-5 py-3 flex gap-6 text-sm">
                    <span>Grand Total SQM: <span className="font-bold">{grandTotalSqm.toLocaleString(undefined, {maximumFractionDigits: 2})} m²</span></span>
                    {grandTotalPrice > 0 && <span>Grand Total: <span className="font-bold">SAR {grandTotalPrice.toLocaleString(undefined, {maximumFractionDigits: 0})}</span></span>}
                    {grandTotalPrice > 0 && <span>+VAT: <span className="font-bold">SAR {(grandTotalPrice * 1.15).toLocaleString(undefined, {maximumFractionDigits: 0})}</span></span>}
                  </div>
                )}
              </div>

              {/* Services */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Services (Optional)</div>
                  <button onClick={addService} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Service
                  </button>
                </div>
                {services.map((svc, idx) => (
                  <div key={idx} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="label">Service Type</label>
                      <select className="input" value={svc.service_type}
                        onChange={e => updateService(idx, 'service_type', e.target.value)}>
                        <option value="">Select…</option>
                        {SERVICES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="w-32">
                      <label className="label">Price/m²</label>
                      <input type="number" className="input" value={svc.price_per_sqm}
                        onChange={e => updateService(idx, 'price_per_sqm', e.target.value)}
                        placeholder="SAR" min="0" />
                    </div>
                    <button onClick={() => removeService(idx)}
                      className="text-red-400 hover:text-red-600 text-xs mb-2">Remove</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleAdd}
                disabled={saving || !form.company_id || !form.project_id}
                className="btn-primary">
                {saving ? "Saving…" : "Create Quotation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
