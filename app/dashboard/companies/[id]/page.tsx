"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";

const COMPANY_TYPES = ['Factory','Advertising','Real Estate','Owner','Consultant','Contractor','Station Management','Workshop','Other'];
const REGIONS       = ['Central','West','East','North','South','Foreign'];
const SOURCES       = ['Form','Marketing','Management','Referral','Direct','Exhibition'];

type Rep     = { id: string; name: string };
type Contact = { id: string; contact_code: string; full_name: string; full_name_ar: string | null; title: string | null; phone: string | null; whatsapp: string | null; email: string | null; is_primary: boolean; notes: string | null };
type Project = { id: string; project_code: string; project_name: string | null; stage: string; quoted_sqm: number; won_sqm: number; created_at: string };
type Company = { id: string; customer_code: string; company_name: string; company_type: string | null; region: string | null; source: string | null; status: string; notes: string | null; primary_rep_id: string | null; created_at: string };
type CompanyRep = { rep_id: string; role: string; reps: { name: string }[] | null };

const STAGE_COLOR: Record<string, string> = {
  'New Lead': 'bg-gray-100 text-gray-700',
  'Catalog Sent': 'bg-blue-50 text-blue-700',
  'Quotation Sent': 'bg-indigo-100 text-indigo-700',
  'Under Review': 'bg-amber-100 text-amber-700',
  'Won': 'bg-green-100 text-green-800',
  'In Production': 'bg-teal-100 text-teal-700',
  'Delivered': 'bg-emerald-100 text-emerald-700',
  'Lost': 'bg-red-100 text-red-700',
};

export default function CompanyDetailPage() {
  const supabase = createClient();
  const params   = useParams();
  const router   = useRouter();
  const id       = params.id as string;

  const [company, setCompany]       = useState<Company | null>(null);
  const [companyReps, setCompanyReps] = useState<CompanyRep[]>([]);
  const [contacts, setContacts]     = useState<Contact[]>([]);
  const [projects, setProjects]     = useState<Project[]>([]);
  const [allReps, setAllReps]       = useState<Rep[]>([]);
  const [tab, setTab]               = useState<'contacts'|'projects'>('contacts');
  const [loading, setLoading]       = useState(true);

  // Edit company state
  const [editing, setEditing]       = useState(false);
  const [editForm, setEditForm]     = useState<Partial<Company>>({});
  const [saving, setSaving]         = useState(false);

  // Add contact state
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ full_name: '', full_name_ar: '', title: '', phone: '', whatsapp: '', email: '', is_primary: false, notes: '' });
  const [savingContact, setSavingContact] = useState(false);

  // Assign rep state
  const [assignRepId, setAssignRepId] = useState('');
  const [assignRole, setAssignRole]   = useState<'primary'|'shared'>('shared');

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    const [compRes, crRes, contactRes, projRes, repRes] = await Promise.all([
      supabase.from('companies').select('*').eq('id', id).single(),
      supabase.from('company_reps').select('rep_id, role, reps(name)').eq('company_id', id),
      supabase.from('contacts').select('*').eq('company_id', id).order('is_primary', { ascending: false }),
      supabase.from('projects').select('id, project_code, project_name, stage, quoted_sqm, won_sqm, created_at').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('reps').select('id, name').in('role', ['rep','marketing']).eq('status', 'active').order('name'),
    ]);
    setCompany(compRes.data);
    setEditForm(compRes.data ?? {});
    setCompanyReps((crRes.data ?? []) as unknown as CompanyRep[]);
    setContacts(contactRes.data ?? []);
    setProjects(projRes.data ?? []);
    setAllReps(repRes.data ?? []);
    setLoading(false);
  }

  async function saveCompany() {
    setSaving(true);
    await supabase.from('companies').update({
      company_name:  editForm.company_name,
      company_type:  editForm.company_type  || null,
      region:        editForm.region        || null,
      source:        editForm.source        || null,
      status:        editForm.status,
      notes:         editForm.notes         || null,
    }).eq('id', id);
    setEditing(false);
    setSaving(false);
    load();
  }

  async function addContact() {
    setSavingContact(true);
    await supabase.from('contacts').insert({
      company_id:  id,
      full_name:   contactForm.full_name.trim(),
      full_name_ar: contactForm.full_name_ar || null,
      title:       contactForm.title    || null,
      phone:       contactForm.phone    || null,
      whatsapp:    contactForm.whatsapp || null,
      email:       contactForm.email    || null,
      is_primary:  contactForm.is_primary,
      notes:       contactForm.notes    || null,
    });
    setContactForm({ full_name: '', full_name_ar: '', title: '', phone: '', whatsapp: '', email: '', is_primary: false, notes: '' });
    setShowAddContact(false);
    setSavingContact(false);
    load();
  }

  async function deleteContact(cid: string) {
    if (!confirm('Delete this contact?')) return;
    await supabase.from('contacts').delete().eq('id', cid);
    load();
  }

  async function assignRep() {
    if (!assignRepId) return;
    await supabase.from('company_reps').upsert({ company_id: id, rep_id: assignRepId, role: assignRole }, { onConflict: 'company_id,rep_id' });
    if (assignRole === 'primary') {
      await supabase.from('companies').update({ primary_rep_id: assignRepId }).eq('id', id);
    }
    setAssignRepId('');
    load();
  }

  async function removeRep(repId: string) {
    if (!confirm('Remove this rep from the company?')) return;
    await supabase.from('company_reps').delete().eq('company_id', id).eq('rep_id', repId);
    load();
  }

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>;
  if (!company) return <div className="p-8 text-gray-400">Company not found.</div>;

  const assignedRepIds = companyReps.map(cr => cr.rep_id);
  const availableReps  = allReps.filter(r => !assignedRepIds.includes(r.id));

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <button onClick={() => router.push('/dashboard/companies')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back to Companies
      </button>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{company.company_name}</h1>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${company.status === 'active' ? 'bg-green-100 text-green-800' : company.status === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                {company.status}
              </span>
            </div>
            <div className="text-xs text-gray-400">{company.customer_code}</div>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
              {company.company_type && <span>📁 {company.company_type}</span>}
              {company.region       && <span>📍 {company.region}</span>}
              {company.source       && <span>🔗 {company.source}</span>}
            </div>
            {company.notes && <p className="mt-3 text-sm text-gray-500 border-t border-gray-100 pt-3">{company.notes}</p>}
          </div>
          <button onClick={() => setEditing(true)} className="btn-secondary text-sm flex-shrink-0">Edit</button>
        </div>

        {/* Reps assignment */}
        <div className="mt-5 border-t border-gray-100 pt-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Assigned Reps</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {companyReps.length === 0 && <span className="text-sm text-gray-400">No reps assigned yet</span>}
            {companyReps.map(cr => (
              <div key={cr.rep_id} className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 py-1.5 text-sm">
                <span className="font-medium text-gray-800">{cr.reps?.name}</span>
                <span className="text-xs text-gray-500">({cr.role})</span>
                <button onClick={() => removeRep(cr.rep_id)} className="ml-1 text-gray-400 hover:text-red-500">×</button>
              </div>
            ))}
          </div>
          {availableReps.length > 0 && (
            <div className="flex items-center gap-2">
              <select className="input py-1.5 text-sm w-44" value={assignRepId} onChange={e => setAssignRepId(e.target.value)}>
                <option value="">Add rep…</option>
                {availableReps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <select className="input py-1.5 text-sm w-32" value={assignRole} onChange={e => setAssignRole(e.target.value as 'primary'|'shared')}>
                <option value="primary">Primary</option>
                <option value="shared">Shared</option>
              </select>
              <button onClick={assignRep} disabled={!assignRepId} className="btn-primary text-sm py-1.5 px-4">Assign</button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['contacts','projects'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${tab === t ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {t} ({t === 'contacts' ? contacts.length : projects.length})
          </button>
        ))}
      </div>

      {/* Contacts tab */}
      {tab === 'contacts' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowAddContact(true)} className="btn-primary text-sm flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Contact
            </button>
          </div>
          {contacts.length === 0
            ? <div className="card p-8 text-center text-gray-400">No contacts yet. Add the first contact above.</div>
            : contacts.map(c => (
              <div key={c.id} className="card px-5 py-4 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{c.full_name}</span>
                    {c.full_name_ar && <span className="text-gray-500 text-sm">{c.full_name_ar}</span>}
                    {c.is_primary && <span className="bg-brand-blue/10 text-brand-blue text-xs px-2 py-0.5 rounded-full font-medium">Primary</span>}
                  </div>
                  {c.title && <div className="text-sm text-gray-500 mt-0.5">{c.title}</div>}
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                    {c.phone    && <span>📞 {c.phone}</span>}
                    {c.whatsapp && <span>💬 {c.whatsapp}</span>}
                    {c.email    && <span>✉️ {c.email}</span>}
                  </div>
                  {c.notes && <p className="text-xs text-gray-400 mt-1">{c.notes}</p>}
                </div>
                <button onClick={() => deleteContact(c.id)} className="text-red-400 hover:text-red-600 text-xs flex-shrink-0">Delete</button>
              </div>
            ))
          }
        </div>
      )}

      {/* Projects tab */}
      {tab === 'projects' && (
        <div className="space-y-3">
          {projects.length === 0
            ? <div className="card p-8 text-center text-gray-400">No projects linked to this company yet.</div>
            : projects.map(p => (
              <div key={p.id} className="card px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{p.project_name || '(No name)'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLOR[p.stage] ?? 'bg-gray-100 text-gray-700'}`}>{p.stage}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{p.project_code}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-gray-600">{(p.quoted_sqm ?? 0).toLocaleString()} SQM quoted</div>
                  {p.won_sqm > 0 && <div className="text-green-700 font-medium">{p.won_sqm.toLocaleString()} won</div>}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Edit Company</h2>
              <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Company Name *</label>
                <input className="input" value={editForm.company_name ?? ''} onChange={e => setEditForm({...editForm, company_name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={editForm.company_type ?? ''} onChange={e => setEditForm({...editForm, company_type: e.target.value})}>
                    <option value="">Select…</option>
                    {COMPANY_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Region</label>
                  <select className="input" value={editForm.region ?? ''} onChange={e => setEditForm({...editForm, region: e.target.value})}>
                    <option value="">Select…</option>
                    {REGIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Source</label>
                  <select className="input" value={editForm.source ?? ''} onChange={e => setEditForm({...editForm, source: e.target.value})}>
                    <option value="">Select…</option>
                    {SOURCES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={editForm.status ?? 'active'} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={3} value={editForm.notes ?? ''} onChange={e => setEditForm({...editForm, notes: e.target.value})} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveCompany} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add contact modal */}
      {showAddContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Add Contact</h2>
              <button onClick={() => setShowAddContact(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Full Name (EN) *</label>
                  <input className="input" value={contactForm.full_name} onChange={e => setContactForm({...contactForm, full_name: e.target.value})} placeholder="John Smith" />
                </div>
                <div>
                  <label className="label">Full Name (AR)</label>
                  <input className="input" value={contactForm.full_name_ar} onChange={e => setContactForm({...contactForm, full_name_ar: e.target.value})} placeholder="اسم الموظف" dir="rtl" />
                </div>
              </div>
              <div>
                <label className="label">Title / Role</label>
                <input className="input" value={contactForm.title} onChange={e => setContactForm({...contactForm, title: e.target.value})} placeholder="Project Manager, Procurement…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} placeholder="05xxxxxxxx" />
                </div>
                <div>
                  <label className="label">WhatsApp</label>
                  <input className="input" value={contactForm.whatsapp} onChange={e => setContactForm({...contactForm, whatsapp: e.target.value})} placeholder="05xxxxxxxx" />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="primary" checked={contactForm.is_primary} onChange={e => setContactForm({...contactForm, is_primary: e.target.checked})} className="w-4 h-4 accent-brand-blue" />
                <label htmlFor="primary" className="text-sm text-gray-700">Set as primary contact</label>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} value={contactForm.notes} onChange={e => setContactForm({...contactForm, notes: e.target.value})} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setShowAddContact(false)} className="btn-secondary">Cancel</button>
              <button onClick={addContact} disabled={savingContact || !contactForm.full_name.trim()} className="btn-primary">
                {savingContact ? 'Saving…' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
