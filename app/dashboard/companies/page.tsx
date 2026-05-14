"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const COMPANY_TYPES = ['Factory','Advertising','Real Estate','Owner','Consultant','Contractor','Station Management','Workshop','Other'];
const REGIONS      = ['Central','West','East','North','South','Foreign'];
const SOURCES      = ['Form','Marketing','Management','Referral','Direct','Exhibition'];

const STATUS_STYLE: Record<string, string> = {
  active:   'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-600',
  blocked:  'bg-red-100 text-red-700',
};

type Rep     = { id: string; name: string };
type Company = {
  id: string; customer_code: string; company_name: string;
  company_type: string | null; region: string | null;
  status: string; source: string | null; notes: string | null;
  created_at: string;
};

const emptyForm = () => ({
  company_name: '', company_type: '', region: '',
  source: '', notes: '', status: 'active', assign_rep_id: '',
});

export default function ManagerCompaniesPage() {
  const supabase = createClient();
  const [companies, setCompanies]     = useState<Company[]>([]);
  const [reps, setReps]               = useState<Rep[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterType, setFilterType]   = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showAdd, setShowAdd]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [form, setForm]               = useState(emptyForm());
  const [error, setError]             = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [compRes, repRes] = await Promise.all([
      supabase.from('companies')
  .select('id, customer_code, company_name, company_type, region, status, source, notes, created_at')
  .order('company_name'),
      supabase.from('reps')
        .select('id, name')
        .in('role', ['rep', 'marketing'])
        .eq('status', 'active')
        .order('name'),
    ]);
    setCompanies((compRes.data ?? []) as unknown as Company[]);
    setReps(repRes.data ?? []);
    setLoading(false);
  }

  async function handleAdd() {
    setError('');
    if (!form.company_name.trim()) { setError('Company name is required.'); return; }
    setSaving(true);

    const { data: company, error: insertError } = await supabase
      .from('companies')
      .insert({
        company_name:  form.company_name.trim(),
        company_type:  form.company_type  || null,
        region:        form.region        || null,
        source:        form.source        || null,
        notes:         form.notes         || null,
        status:        form.status,
        primary_rep_id: form.assign_rep_id || null,
      })
      .select()
      .single();

    if (insertError) { setError(insertError.message); setSaving(false); return; }

    if (form.assign_rep_id && company) {
      await supabase.from('company_reps').insert({
        company_id:  company.id,
        rep_id:      form.assign_rep_id,
        role:        'primary',
      });
    }

    setForm(emptyForm());
    setShowAdd(false);
    setSaving(false);
    load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This will also delete all contacts and linked records. This cannot be undone.`)) return;
    await supabase.from('companies').delete().eq('id', id);
    load();
  }

  const filtered = companies.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (c.company_name || "").toLowerCase().includes(q) ||
      (c.customer_code ?? '').toLowerCase().includes(q);
    return matchSearch &&
      (!filterType   || c.company_type === filterType) &&
      (!filterRegion || c.region       === filterRegion) &&
      (!filterStatus || c.status       === filterStatus);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? '—' : `${companies.length} total · ${filtered.length} shown`}
          </p>
        </div>
        <button onClick={() => { setShowAdd(true); setError(''); }} className="btn-primary flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Company
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search by name or code…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-44" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {COMPANY_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="input w-40" value={filterRegion} onChange={e => setFilterRegion(e.target.value)}>
          <option value="">All Regions</option>
          {REGIONS.map(r => <option key={r}>{r}</option>)}
        </select>
        <select className="input w-36" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="blocked">Blocked</option>
        </select>
        {(search || filterType || filterRegion || filterStatus) && (
          <button onClick={() => { setSearch(''); setFilterType(''); setFilterRegion(''); setFilterStatus(''); }}
            className="btn-secondary text-sm px-3">Clear</button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="card p-10 text-center text-gray-400">Loading companies…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          {search || filterType || filterRegion || filterStatus
            ? 'No companies match your filters.'
            : 'No companies yet. Add your first one above.'}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Region</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(c => {
                return (
                  <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5">
  <div className="font-medium text-gray-900">{c.company_name}</div>
</td>
                    <td className="px-5 py-3.5 text-gray-600">{c.company_type || '—'}</td>
                    <td className="px-5 py-3.5 text-gray-600">{c.region || '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-4">
                        <Link href={`/dashboard/companies/${c.id}`}
                          className="text-brand-blue hover:underline text-xs font-medium">View</Link>
                        <button onClick={() => handleDelete(c.id, c.company_name)}
                          className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-lg">Add Company</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
              <div>
                <label className="label">Company Name *</label>
                <input className="input" value={form.company_name}
                  onChange={e => setForm({...form, company_name: e.target.value})}
                  placeholder="Name in Arabic or English" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={form.company_type}
                    onChange={e => setForm({...form, company_type: e.target.value})}>
                    <option value="">Select…</option>
                    {COMPANY_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Region</label>
                  <select className="input" value={form.region}
                    onChange={e => setForm({...form, region: e.target.value})}>
                    <option value="">Select…</option>
                    {REGIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Source</label>
                  <select className="input" value={form.source}
                    onChange={e => setForm({...form, source: e.target.value})}>
                    <option value="">Select…</option>
                    {SOURCES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={form.status}
                    onChange={e => setForm({...form, status: e.target.value})}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Assign Rep</label>
                <select className="input" value={form.assign_rep_id}
                  onChange={e => setForm({...form, assign_rep_id: e.target.value})}>
                  <option value="">Unassigned for now</option>
                  {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={3} value={form.notes}
                  onChange={e => setForm({...form, notes: e.target.value})}
                  placeholder="Any notes about this company…" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleAdd} disabled={saving || !form.company_name.trim()} className="btn-primary">
                {saving ? 'Saving…' : 'Add Company'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
