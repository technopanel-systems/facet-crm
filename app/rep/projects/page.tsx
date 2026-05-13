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

type Company = { id: string; company_name: string };
type Contact = { id: string; full_name: string };
type Project = {
  id: string; project_code: string; project_name: string | null;
  stage: string; quoted_sqm: number; next_follow_up: string | null;
  customer_id: string | null;
  companies: any;
};

const emptyForm = () => ({
  customer_id: '', project_name: '', city: '', stage: 'New Lead',
  quoted_sqm: '', next_follow_up: '', notes: '', contact_id: '',
});

export default function RepProjectsPage() {
  const supabase = createClient();
  const [projects, setProjects]   = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts]   = useState<Contact[]>([]);
  const [repId, setRepId]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [filterStage, setFilterStage] = useState('');
  const [showAdd, setShowAdd]     = useState(false);
  const [form, setForm]           = useState(emptyForm());
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [lossModal, setLossModal]   = useState<{ pid: string; name: string } | null>(null);
  const [lossReason, setLossReason] = useState('');

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!form.customer_id) { setContacts([]); return; }
    supabase.from('contacts').select('id, full_name').eq('company_id', form.customer_id)
      .then(({ data }) => setContacts(data ?? []));
  }, [form.customer_id]);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: rep } = await supabase.from('reps').select('id').eq('auth_user_id', user.id).single();
    if (!rep) return;
    setRepId(rep.id);

    const [projRes, compRes] = await Promise.all([
      supabase.from('projects')
        .select('id, project_code, project_name, stage, quoted_sqm, next_follow_up, customer_id, companies(company_name)')
        .order('created_at', { ascending: false }),
      supabase.from('companies').select('id, company_name').order('company_name'),
    ]);
    setProjects((projRes.data ?? []) as unknown as Project[]);
    setCompanies(compRes.data ?? []);
    setLoading(false);
  }

  async function handleAdd() {
    setError('');
    if (!form.customer_id) { setError('Please select a company.'); return; }
    if (!repId) return;
    setSaving(true);

    const { error: err } = await supabase.rpc('create_project_with_rep', {
      p_customer_id:    form.customer_id,
      p_project_name:   form.project_name   || null,
      p_city:           form.city           || null,
      p_stage:          form.stage,
      p_quoted_sqm:     parseFloat(form.quoted_sqm) || 0,
      p_next_follow_up: form.next_follow_up  || null,
      p_notes:          form.notes           || null,
      p_contact_id:     form.contact_id      || null,
      p_rep_id:         repId,
    });

    if (err) { setError(err.message); setSaving(false); return; }

    setForm(emptyForm());
    setShowAdd(false);
    setSaving(false);
    load();
  }

  async function updateStage(pid: string, stage: string) {
  if (stage === 'Lost') {
    const project = projects.find(p => p.id === pid);
    setLossReason('');
    setLossModal({ pid, name: project?.project_name ?? project?.project_code ?? pid });
    return;
  }
  await supabase.from('projects').update({ stage, stage_changed_at: new Date().toISOString() }).eq('id', pid);
  setProjects(projects.map(p => p.id === pid ? {...p, stage} : p));
}

async function confirmLost() {
  if (!lossModal || !lossReason) return;
  await supabase.from('projects').update({
    stage: 'Lost',
    stage_changed_at: new Date().toISOString(),
    loss_reason: lossReason,
  }).eq('id', lossModal.pid);
  setProjects(projects.map(p => p.id === lossModal.pid ? {...p, stage: 'Lost'} : p));
  setLossModal(null);
  setLossReason('');
}

  async function updateFollowUp(pid: string, date: string) {
    await supabase.from('projects').update({ next_follow_up: date || null }).eq('id', pid);
    setProjects(projects.map(p => p.id === pid ? {...p, next_follow_up: date || null} : p));
  }

  const filtered = projects.filter(p => !filterStage || p.stage === filterStage);

  const today = new Date().toISOString().split('T')[0];
  const followUpsToday = projects.filter(p => p.next_follow_up === today);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Projects</h1>
          <p className="text-gray-500 text-sm mt-1">{loading ? '—' : `${projects.length} projects`}</p>
        </div>
        <button onClick={() => { setShowAdd(true); setError(''); }} className="btn-primary flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Project
        </button>
      </div>

      {/* Follow-ups due today */}
      {followUpsToday.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <div className="text-sm font-semibold text-amber-800 mb-2">📅 {followUpsToday.length} follow-up{followUpsToday.length > 1 ? 's' : ''} due today</div>
          <div className="space-y-1">
            {followUpsToday.map(p => (
              <div key={p.id} className="text-sm text-amber-700">
                • {p.project_name || p.project_code} — {p.companies?.company_name}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <select className="input w-48" value={filterStage} onChange={e => setFilterStage(e.target.value)}>
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
        {filterStage && <button onClick={() => setFilterStage('')} className="btn-secondary text-sm px-3">Clear</button>}
      </div>

      {loading ? (
        <div className="card p-10 text-center text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          {filterStage ? 'No projects in this stage.' : 'No projects yet. Add your first one above.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const isOverdue = p.next_follow_up && p.next_follow_up < today;
            return (
              <div key={p.id} className="card px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-gray-900">{p.project_name || '(No name)'}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {p.project_code}{p.companies ? ` · ${p.companies.company_name}` : ''}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{(p.quoted_sqm ?? 0).toLocaleString()} SQM quoted</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <select
                      value={p.stage}
                      onChange={e => updateStage(p.id, e.target.value)}
                      className={`text-xs font-medium rounded-full px-3 py-1 outline-none border-0 cursor-pointer ${STAGE_COLOR[p.stage] ?? 'bg-gray-100 text-gray-700'}`}
                    >
                      {STAGES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3">
                  <label className="text-xs text-gray-500 whitespace-nowrap">Next follow-up:</label>
                  <input type="date" className="input py-1 text-xs w-40"
                    value={p.next_follow_up ?? ''}
                    onChange={e => updateFollowUp(p.id, e.target.value)}
                  />
                  {isOverdue && <span className="text-xs text-red-600 font-medium">Overdue!</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
{/* Loss Reason Modal */}
      {lossModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Mark Project as Lost</h2>
              <p className="text-sm text-gray-500 mt-1">"{lossModal.name}"</p>
            </div>
            <div className="px-6 py-5 space-y-3">
              <label className="label">Reason for Loss *</label>
              <select
                className="input"
                value={lossReason}
                onChange={e => setLossReason(e.target.value)}
              >
                <option value="">Select a reason…</option>
                <option value="Price">Price — too expensive</option>
                <option value="Competitor">Competitor — chose another supplier</option>
                <option value="Timeline">Timeline — project delayed or cancelled</option>
                <option value="No Budget">No Budget — budget was cut</option>
                <option value="Specification Mismatch">Specification Mismatch — product didn't fit</option>
                <option value="No Response">No Response — client went silent</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setLossModal(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={confirmLost}
                disabled={!lossReason}
                className="btn-primary bg-red-600 hover:bg-red-700"
              >
                Confirm Lost
              </button>
            </div>
          </div>
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
                  <option value="">Select from your companies…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
                {companies.length === 0 && <p className="text-xs text-amber-600 mt-1">Register a company first before adding a project.</p>}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Project Name</label>
                  <input className="input" value={form.project_name} onChange={e => setForm({...form, project_name: e.target.value})} placeholder="Tower, Villa, Mall…" />
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
                  <label className="label">Quoted SQM</label>
                  <input type="number" className="input" value={form.quoted_sqm} onChange={e => setForm({...form, quoted_sqm: e.target.value})} placeholder="0" min="0" />
                </div>
              </div>
              <div>
                <label className="label">Next Follow Up Date</label>
                <input type="date" className="input" value={form.next_follow_up} onChange={e => setForm({...form, next_follow_up: e.target.value})} />
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
