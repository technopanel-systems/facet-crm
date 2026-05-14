"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";

type Contact = { id: string; contact_code: string; full_name: string; full_name_ar: string | null; title: string | null; phone: string | null; whatsapp: string | null; email: string | null; is_primary: boolean };
type Project = { id: string; project_code: string; project_name: string | null; stage: string; quoted_sqm: number; next_follow_up: string | null };
type Company = { id: string; customer_code: string; company_name: string; company_type: string | null; region: string | null; status: string; notes: string | null };

const STAGE_COLOR: Record<string, string> = {
  'New Lead': 'bg-gray-100 text-gray-700', 'Catalog Sent': 'bg-blue-50 text-blue-700',
  'Quotation Sent': 'bg-indigo-100 text-indigo-700', 'Under Review': 'bg-amber-100 text-amber-700',
  'Won': 'bg-green-100 text-green-800', 'In Production': 'bg-teal-100 text-teal-700',
  'Delivered': 'bg-emerald-100 text-emerald-700', 'Lost': 'bg-red-100 text-red-700',
};

export default function RepCompanyDetailPage() {
  const supabase = createClient();
  const params   = useParams();
  const router   = useRouter();
  const id       = params.id as string;

  const [company, setCompany]   = useState<Company | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tab, setTab]           = useState<'contacts'|'projects'>('contacts');
  const [loading, setLoading]   = useState(true);
  const [repId, setRepId]       = useState<string | null>(null);

  // Add contact state
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ full_name: '', full_name_ar: '', title: '', phone: '', whatsapp: '', email: '', is_primary: false });
  const [savingContact, setSavingContact] = useState(false);

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: rep } = await supabase.from('reps').select('id').eq('auth_user_id', user.id).single();
    if (rep) setRepId(rep.id);

    const [compRes, contactRes, projRes] = await Promise.all([
      supabase.from('companies').select('id, customer_code, company_name, company_type, region, status, notes').eq('id', id).single(),
      supabase.from('contacts').select('*').eq('company_id', id).order('is_primary', { ascending: false }),
      supabase.from('projects').select('id, project_code, project_name, stage, quoted_sqm, next_follow_up').eq('customer_id', id).order('created_at', { ascending: false }),
    ]);
    setCompany(compRes.data);
    setContacts(contactRes.data ?? []);
    setProjects(projRes.data ?? []);
    setLoading(false);
  }

  async function addContact() {
    if (!repId) return;
    setSavingContact(true);
    await supabase.from('contacts').insert({
      company_id:  id, created_by: repId,
      full_name:   contactForm.full_name.trim(),
      full_name_ar: contactForm.full_name_ar || null,
      title:       contactForm.title    || null,
      phone:       contactForm.phone    || null,
      whatsapp:    contactForm.whatsapp || null,
      email:       contactForm.email    || null,
      is_primary:  contactForm.is_primary,
    });
    setContactForm({ full_name: '', full_name_ar: '', title: '', phone: '', whatsapp: '', email: '', is_primary: false });
    setShowAddContact(false);
    setSavingContact(false);
    load();
  }

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>;
  if (!company) return <div className="p-8 text-gray-400">Company not found.</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <button onClick={() => router.push('/rep/companies')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back to My Companies
      </button>

      <div className="card p-6">
        <div className="flex items-start gap-3 mb-1">
          <h1 className="text-xl font-bold text-gray-900">{company.company_name}</h1>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${company.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{company.status}</span>
        </div>
        <div className="text-xs text-gray-400 mb-3">Ref: {company.customer_code}</div>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          {company.company_type && <span>📁 {company.company_type}</span>}
          {company.region       && <span>📍 {company.region}</span>}
        </div>
        {company.notes && <p className="mt-3 text-sm text-gray-500 border-t border-gray-100 pt-3">{company.notes}</p>}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['contacts','projects'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${tab === t ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {t} ({t === 'contacts' ? contacts.length : projects.length})
          </button>
        ))}
      </div>

      {tab === 'contacts' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowAddContact(true)} className="btn-primary text-sm flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Contact
            </button>
          </div>
          {contacts.length === 0
            ? <div className="card p-8 text-center text-gray-400">No contacts yet.</div>
            : contacts.map(c => (
              <div key={c.id} className="card px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">{c.full_name}</span>
                  {c.full_name_ar && <span className="text-gray-500 text-sm">{c.full_name_ar}</span>}
                  {c.is_primary && <span className="bg-brand-blue/10 text-brand-blue text-xs px-2 py-0.5 rounded-full">Primary</span>}
                </div>
                {c.title && <div className="text-sm text-gray-500">{c.title}</div>}
                <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                  {c.phone    && <span>📞 {c.phone}</span>}
                  {c.whatsapp && <span>💬 {c.whatsapp}</span>}
                  {c.email    && <span>✉️ {c.email}</span>}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {tab === 'projects' && (
        <div className="space-y-3">
          {projects.length === 0
            ? <div className="card p-8 text-center text-gray-400">No projects linked to this company.</div>
            : projects.map(p => (
              <div key={p.id} className="card px-5 py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{p.project_name || '(No name)'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLOR[p.stage] ?? 'bg-gray-100 text-gray-700'}`}>{p.stage}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{p.project_code}</div>
                  {p.next_follow_up && (
                    <div className="text-xs text-amber-600 mt-1">📅 Follow up: {p.next_follow_up}</div>
                  )}
                </div>
                <div className="text-sm text-gray-600">{(p.quoted_sqm ?? 0).toLocaleString()} SQM</div>
              </div>
            ))
          }
        </div>
      )}

      {/* Add Contact Modal */}
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
                  <input className="input" value={contactForm.full_name} onChange={e => setContactForm({...contactForm, full_name: e.target.value})} />
                </div>
                <div>
                  <label className="label">Full Name (AR)</label>
                  <input className="input" value={contactForm.full_name_ar} onChange={e => setContactForm({...contactForm, full_name_ar: e.target.value})} dir="rtl" />
                </div>
              </div>
              <div>
                <label className="label">Title</label>
                <input className="input" value={contactForm.title} onChange={e => setContactForm({...contactForm, title: e.target.value})} placeholder="PM, Procurement, Owner…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Phone</label><input className="input" value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} placeholder="05xxxxxxxx" /></div>
                <div><label className="label">WhatsApp</label><input className="input" value={contactForm.whatsapp} onChange={e => setContactForm({...contactForm, whatsapp: e.target.value})} placeholder="05xxxxxxxx" /></div>
              </div>
              <div><label className="label">Email</label><input className="input" type="email" value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="primary" checked={contactForm.is_primary} onChange={e => setContactForm({...contactForm, is_primary: e.target.checked})} className="w-4 h-4 accent-brand-blue" />
                <label htmlFor="primary" className="text-sm text-gray-700">Set as primary contact</label>
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
