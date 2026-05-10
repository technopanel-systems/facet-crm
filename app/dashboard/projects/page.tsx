"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const STAGES  = ['New Lead','Catalog Sent','Quotation Sent','Under Review','Won','In Production','Delivered','Lost'];
const REGIONS = ['Central','West','East','North','South','Foreign'];

const STAGE_COLOR: Record<string, string> = {
  'New Lead': 'bg-gray-100 text-gray-700', 'Catalog Sent': 'bg-blue-50 text-blue-700',
  'Quotation Sent': 'bg-indigo-100 text-indigo-700', 'Under Review': 'bg-amber-100 text-amber-700',
  'Won': 'bg-green-100 text-green-800', 'In Production': 'bg-teal-100 text-teal-700',
  'Delivered': 'bg-emerald-100 text-emerald-700', 'Lost': 'bg-red-100 text-red-700',
};

type Company = { id: string; company_name: string };
type Contact = { id: string; full_name: string };
type Rep     = { id: string; name: string };
type Project = {
  id: string; project_code: string; project_name: string | null;
  stage: string; quoted_sqm: number; won_sqm: number;
  city: string | null; next_follow_up: string | null;
  customer_id: string | null;
 companies: any;
  project_reps: { role: string; reps: any }[];
};

const emptyForm = () => ({
  customer_id: '', project_name: '', city: '', stage: 'New Lead',
  quoted_sqm: '', won_sqm: '', next_follow_up: '', notes: '',
  contact_id: '', assign_rep_id: '',
});

export default function ManagerProjectsPage() {
  const supabase = createClient();
  const [projects, setProjects]     = useState<Project[]>([]);
  const [companies, setCompanies]   = useState<Company[]>([]);
  const [reps, setReps]             = useState<Rep[]>([]);
  const [contacts, setContacts]     = useState<Contact[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState(emptyForm());
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => { load(); }, []);

  // Load contacts when company selected in form
  useEffect(() => {
    if (!form.customer_id) { setContacts([]); return; }
    supabase.from('contacts').select('id, full_name').eq('company_id', form.customer_id)
      .then(({ data }) => setContacts(data ?? []));
  }, [form.customer_id]);

  async function load() {
    setLoading(true);
    const [projRes, compRes, repRes] = await Promise.all([
      supabase.from('projects')
        .select('id, project_code, project_name, stage, quoted_sqm, won_sqm, city, next_follow_up, customer_id, companies(company_name), project_reps(role, reps(name))')
        .order('created_at', { ascending: false }),
      supabase.from('companies').select('id, company_name').order('company_name'),
      supabase.from('reps').select('id, name').in('role',['rep','marketing']).eq('status','active').order('name'),
    ]);
    setProjects((projRes.data ?? []) as unknown as Project[]);
    setCompanies(compRes.data ?? []);
    setReps(repRes.data ?? []);
    setLoading(false);
  }

  async function handleAdd() {
    setError('');
    if (!form.customer_id) { setError('Please select a company.'); return; }
    setSaving(true);

    const { data: project, error: err } = await supabase.from('projects').insert({
      customer_id:    form.customer_id,
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

    if (project && form.assign_rep_id) {
      await supabase.from('project_reps').insert({
        project_id: project.id, rep_id: form.assign_rep_id, role: 'primary',
      });
    }

    setForm(emptyForm());
    setShowAdd(false);
    setSaving(false);
    load();
  }

  async function handleDelete(pid: string, name: string) {
    if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    await supabase.from('projects').delete().eq('id', pid);
    load();
  }

  async function updateStage(pid: string, stage: string) {
    await supabase.from('projects').update({ stage, stage_changed_at: new Date().toISOString() }).eq('id', pid);
    setProjects(projects.map(p => p.id === pid ? {...p, stage} : p));
  }

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    return (!search || (p.project_name ?? '').toLowerCase().includes(q) || (p.project_code || '').toLowerCase().includes(q) || (p.companies?.company_name ?? '').toLowerCase().includes(q))
      && (!filterStage || p.stage === filterStage);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-500 text-sm mt-1">{loading ? '—' : `${projects.length} total · ${filtered.length} shown`}</p>
        </div>
        <button onClick={() => { setShowAdd(true); setError(''); }} className="btn-primary flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Project
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-48" value={filterStage} onChange={e => setFilterStage(e.target.value)}>
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
        {(search || filterStage) && <button onClick={() => { setSearch(''); setFilterStage(''); }} className="btn-secondary text-sm px-3">Clear</button>}
      </div>

      {loading ? (
        <div className="card p-10 text-center text-gray-400">Loading projects…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          {search || filterStage ? 'No projects match your filters.' : 'No projects yet. Add your first one above.'}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Stage</th>
                <th className="px-5 py-3">SQM</th>
                <th className="px-5 py-3">Rep(s)</th>
                <th className="px-5 py-3">Follow Up</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => {
                const repNames = p.project_reps?.map(pr => Array.isArray(pr.reps) ? pr.reps[0]?.name : pr.reps?.name).filter(Boolean).join(', ') || '—';
                const followUp = p.next_follow_up;
                const isOverdue = followUp && new Date(followUp) < new Date();
                return (
                  <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-gray-900">{p.project_name || '(No name)'}</div>
                      <div className="text-xs text-gray-400">{p.project_code}{p.city ? ` · ${p.city}` : ''}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      {p.companies ? (
                        <Link href={`/dashboard/companies/${p.customer_id}`} className="text-brand-blue hover:underline text-sm">
                          {p.companies.company_name}
                        </Link>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={p.stage}
                        onChange={e => updateStage(p.id, e.target.value)}
                        className={`text-xs font-medium rounded-full px-2 py-1 outline-none border-0 cursor-pointer ${STAGE_COLOR[p.stage] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {STAGES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-sm">
                      <div className="text-gray-600">{(p.quoted_sqm ?? 0).toLocaleString()}</div>
                      {p.won_sqm > 0 && <div className="text-green-700 font-medium text-xs">{p.won_sqm.toLocaleString()} won</div>}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-600">{repNames}</td>
                    <td className="px-5 py-3.5 text-xs">
                      {followUp
                        ? <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}>{followUp}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => handleDelete(p.id, p.project_name ?? p.project_code)}
                        className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Project Modal */}
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
                  <label className="label">Contact (optional)</label>
                  <select className="input" value={form.contact_id} onChange={e => setForm({...form, contact_id: e.target.value})}>
                    <option value="">Select contact…</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
              )}
              
              <div>
                <label className="label">Assign Rep</label>
                <select className="input" value={form.assign_rep_id} onChange={e => setForm({...form, assign_rep_id: e.target.value})}>
                  <option value="">Unassigned</option>
                  {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Project Name</label>
                  <input className="input" value={form.project_name} onChange={e => setForm({...form, project_name: e.target.value})} placeholder="Tower, Villa, Mall…" />
                </div>
                <div>
                  <label className="label">City</label>
                  <input className="input" value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="Riyadh, Jeddah…" />
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
                  <input type="number" className="input" value={form.quoted_sqm} onChange={e => setForm({...form, quoted_sqm: e.target.value})} placeholder="0" min="0" />
                </div>
                <div>
                  <label className="label">Won SQM</label>
                  <input type="number" className="input" value={form.won_sqm} onChange={e => setForm({...form, won_sqm: e.target.value})} placeholder="0" min="0" />
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
