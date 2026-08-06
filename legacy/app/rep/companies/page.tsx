"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const COMPANY_TYPES = ['Factory','Advertising','Real Estate','Owner','Consultant','Contractor','Station Management','Workshop','Other'];
const REGIONS       = ['Central','West','East','North','South','Foreign'];

type Company = {
  id: string; customer_code: string; company_name: string;
  company_type: string | null; region: string | null; status: string;
  _contactCount?: number;
};

const emptyForm = () => ({
  company_name: '', company_type: '', region: '',
  source: '', source_detail: '', notes: '',
});

export default function RepCompaniesPage() {
  const supabase = createClient();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [repId, setRepId]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [showAdd, setShowAdd]     = useState(false);
  const [form, setForm]           = useState(emptyForm());
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: rep } = await supabase
      .from('reps').select('id').eq('auth_user_id', user.id).single();
    if (!rep) return;
    setRepId(rep.id);

    const { data: compData } = await supabase
      .from('companies')
      .select('id, customer_code, company_name, company_type, region, status')
      .order('company_name');

    setCompanies(compData ?? []);
    setLoading(false);
  }

async function handleAdd() {
    setError('');
    if (!form.company_name.trim()) { setError('Company name is required.'); return; }
    if (!repId) return;
    setSaving(true);

    const { data: companyId, error: rpcError } = await supabase.rpc('create_company_with_rep', {
      p_company_name:  form.company_name.trim(),
      p_company_type:  form.company_type  || '',
      p_region:        form.region        || '',
      p_source:        form.source        || '',
      p_source_detail: form.source_detail || '',
      p_notes:         form.notes         || '',
      p_rep_id:        repId,
    });

    if (rpcError) { setError(rpcError.message); setSaving(false); return; }

    setForm(emptyForm());
    setShowAdd(false);
    setSaving(false);
    load();
  }

  const filtered = companies.filter(c =>
    !search ||
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.customer_code ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Companies</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? '—' : `${companies.length} companies assigned to you`}
          </p>
        </div>
        <button onClick={() => { setShowAdd(true); setError(''); }} className="btn-primary flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Register Company
        </button>
      </div>

      <input className="input max-w-sm" placeholder="Search companies…"
        value={search} onChange={e => setSearch(e.target.value)} />

      {loading ? (
        <div className="card p-10 text-center text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          {search ? 'No companies match your search.' : 'No companies assigned yet. Register your first one above.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <Link key={c.id} href={`/rep/companies/${c.id}`}
              className="card px-5 py-4 flex items-center justify-between hover:border-brand-blue/30 transition-colors group block">
              <div>
                <div className="font-medium text-gray-900 group-hover:text-brand-blue transition-colors">{c.company_name}</div>
                <div className="flex gap-4 mt-1 text-xs text-gray-500">
  {c.company_type && <span>{c.company_type}</span>}
  {c.region       && <span>📍 {c.region}</span>}
</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {c.status}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 group-hover:text-brand-blue transition-colors">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Add Company Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-lg">Register Company</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
              <div>
                <label className="label">Company Name *</label>
                <input className="input" value={form.company_name}
                  onChange={e => setForm({...form, company_name: e.target.value})}
                  placeholder="Arabic or English name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={form.company_type} onChange={e => setForm({...form, company_type: e.target.value})}>
                    <option value="">Select…</option>
                    {COMPANY_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Region</label>
                  <select className="input" value={form.region} onChange={e => setForm({...form, region: e.target.value})}>
                    <option value="">Select…</option>
                    {REGIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
             <div>
  <label className="label">Source</label>
  <select className="input" value={form.source}
    onChange={e => setForm({...form, source: e.target.value, source_detail: ''})}>
    <option value="">Select…</option>
    <option value="Field Visit">Field Visit</option>
    <option value="Direct Contact">Direct Contact</option>
    <option value="Referral">Referral</option>
    <option value="Exhibition">Exhibition</option>
    <option value="Other">Other</option>
  </select>
</div>

{form.source === 'Direct Contact' && (
  <div>
    <label className="label">Contact Method</label>
    <select className="input" value={form.source_detail}
      onChange={e => setForm({...form, source_detail: e.target.value})}>
      <option value="">Select…</option>
      <option value="Call">Call</option>
      <option value="Email">Email</option>
      <option value="WhatsApp">WhatsApp</option>
      <option value="Other">Other</option>
    </select>
  </div>
)}

{form.source === 'Direct Contact' && form.source_detail === 'Other' && (
  <div>
    <label className="label">Specify Contact Method</label>
    <input className="input" value={form.source_detail === 'Other' ? '' : form.source_detail}
      onChange={e => setForm({...form, source_detail: e.target.value})}
      placeholder="Describe the contact method…" />
  </div>
)}

{form.source === 'Other' && (
  <div>
    <label className="label">Please Specify</label>
    <input className="input" value={form.source_detail}
      onChange={e => setForm({...form, source_detail: e.target.value})}
      placeholder="Describe how this lead was sourced…" />
  </div>
)}
              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} value={form.notes}
                  onChange={e => setForm({...form, notes: e.target.value})} />
              </div>
              <p className="text-xs text-gray-400">This company will be automatically assigned to you as primary rep.</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleAdd} disabled={saving || !form.company_name.trim()} className="btn-primary">
                {saving ? 'Saving…' : 'Register Company'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
