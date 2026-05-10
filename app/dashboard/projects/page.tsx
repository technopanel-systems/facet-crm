"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const STAGES = ['New Lead','Catalog Sent','Quotation Sent','Under Review','Won','In Production','Delivered','Lost'];

const STAGE_COLOR: Record<string, string> = {
  'New Lead': 'bg-gray-100 text-gray-700', 'Catalog Sent': 'bg-blue-50 text-blue-700',
  'Quotation Sent': 'bg-indigo-100 text-indigo-700', 'Under Review': 'bg-amber-100 text-amber-700',
  'Won': 'bg-green-100 text-green-800', 'In Production': 'bg-teal-100 text-teal-700',
  'Delivered': 'bg-emerald-100 text-emerald-700', 'Lost': 'bg-red-100 text-red-700',
};

type Project = {
  id: string; project_code: string; project_name: string | null; city: string | null;
  stage: string; quoted_sqm: number; won_sqm: number; next_follow_up: string | null;
  companies: { company_name: string } | null;
  project_reps: { role: string; reps: { name: string } }[];
};

type Company = { id: string; company_name: string };
type Contact = { id: string; full_name: string };

const emptyForm = () => ({
  customer_id: '', project_name: '', city: '', stage: 'New Lead',
  quoted_sqm: '', won_sqm: '', next_follow_up: '', notes: '', contact_id: '',
});

export default function DashboardProjectsPage() {
  const supabase = createClient();
  const [projects, setProjects]   = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts]   = useState<Contact[]>([]);
  
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterStage, setFilterStage] = useState('');
  
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState(emptyForm());
  const [error, setError]     = useState('');

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!form.customer_id) { setContacts([]); return; }
    supabase.from('contacts').select('id, full_name').eq('company_id', form.customer_id)
      .then(({ data }) => setContacts(data ?? []));
  }, [form.customer_id]);

  async function load() {
    setLoading(true);
    const [projRes, compRes] = await Promise.all([
      supabase.from('projects').select(`
        id, project_code, project_name, city, stage, quoted_sqm, won_sqm, next_follow_up,
        companies(company_name),
        project_reps(role, reps(name))
      `).order('created_at', { ascending: false }),
      supabase.from('companies').select('id, company_name').order('company_name'),
    ]);

    setProjects((projRes.data ?? []) as unknown as Project[]);
    setCompanies(compRes.data ?? []);
    setLoading(false);
  }

  async function handleAdd() {
    setError('');
    if (!form.customer_id) { setError('Please select a company.'); return; }
    setSaving(true);

    const selectedCompany = companies.find(c => c.id === form.customer_id);

    const { data: project, error: err } = await supabase.from('projects').insert({
      customer_id:    form.customer_id,
      company_name:   selectedCompany?.company_name || 'Unknown',
      project_name:   form.project_name   || null,
      city:           form.city           || null,
      stage:          form.stage,
      quoted_sqm:     parseFloat(form.quoted_sqm)  || 0,
      won_sqm:        parseFloat(form.won_sqm)      || 0,
      next_follow_up: form.next_follow_up || null,
      notes:          form.notes          || null,
      contact_id:     form.contact_id     || null,
    }).select().single();

    if (err) { setError(err.message); setSaving(false); return; }

    setForm(emptyForm());
    setShowAdd(false);
    setSaving(false);
    load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete project "${name}"?`)) return;
    await supabase.from('projects').delete().eq('id', id);
    load();
  }

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || (p.project_name ?? '').toLowerCase().includes(q) || p.project_code.toLowerCase().includes(q);
    const matchStage  = !filterStage || p.stage === filterStage;
    return matchSearch && matchStage;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects Pipeline</h1>
          <p className="text-gray-500 text-sm mt-1">{loading ? '—' : `${projects.length} total projects`}</p>
        </div>
        <button onClick={() => { setShowAdd(true); setError(''); }} className="btn-primary flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Project
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search project name or code…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-48" value={filterStage} onChange={e => setFilterStage(e.target.value)}>
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
        {(search || filterStage) && (
          <button onClick={() => { setSearch(''); setFilterStage(''); }} className="btn-secondary text-sm px-3">Clear</button>
        )}
      </div>

      {loading ? (
        <div className="card p-10 text-center text-gray-400">Loading projects…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">No projects match your criteria.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Rep(s)</th>
                <th className="px-5 py-3">Stage</th>
                <th className="px-5 py-3 text-right">SQM</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => {
                const reps = p.project_reps?.map(pr => Array.isArray(pr.reps) ? pr.reps[0]?.name : pr.reps?.name).filter(Boolean).join(', ') || '—';
                return (
                  <tr key={p.id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-gray-900">{p.project_name || '(No name)'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{p.project_code} {p.city ? `· ${p.city}` : ''}</div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 font-medium">
                      {p.companies ? (Array.isArray(p.companies) ? p.companies[0].company_name : p.companies.company_name) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 text-xs">{reps}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLOR[p.stage] ?? 'bg-gray-100 text-gray-700'}`}>
                        {p.stage}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="text-gray-900 font-medium">{(p.quoted_sqm ?? 0).toLocaleString()}</div>
                      {p.won_sqm > 0 && <div className="text-xs text-green-600 mt-0.5">{(p.won_sqm).toLocaleString()} won</div>}
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => handleDelete(p.id, p.project_name || p.project_code)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-lg">Add Project</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
              <div>
                <label className="label">Company *</label>
                <select className="input" value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value, contact_id: ''})}>
                  <option value="">Select company…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              {contacts.length > 0 && (
                <div>
                  <label className="label">Contact</label>
                  <select className="input" value={form.contact_id} onChange={e => setForm({...form, contact_id: e.target.value})}>
                    <option value="">Select contact…</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Project Name</label>
                  <input className="input" value={form.project_name} onChange={e => setForm({...form, project_name: e.target.value})} placeholder="Tower, Villa…" />
                </div>
                <div>
                  <label className="label">City</label>
                  <input className="input" value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="Riyadh…" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Stage</label>
                  <select className="input" value={form.stage} onChange={e => setForm({...form, stage: e.target.value})}>
                    {STAGES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Next Follow Up</label>
                  <input type="date" className="input" value={form.next_follow_up} onChange={e => setForm({...form, next_follow_up: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Quoted SQM</label>
                  <input type="number" className="input" value={form.quoted_sqm} onChange={e => setForm({...form, quoted_sqm: e.target.value})} placeholder="0" />
                </div>
                <div>
                  <label className="label">Won SQM</label>
                  <input type="number" className="input" value={form.won_sqm} onChange={e => setForm({...form, won_sqm: e.target.value})} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleAdd} disabled={saving || !form.customer_id} className="btn-primary">
                {saving ? 'Saving…' : 'Add Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
