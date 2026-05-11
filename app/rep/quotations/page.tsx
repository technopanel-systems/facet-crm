"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const STATUS_STYLE: Record<string,string> = {
  pending:   "bg-amber-100 text-amber-800",
  submitted: "bg-blue-100 text-blue-700",
  won:       "bg-green-100 text-green-800",
  lost:      "bg-red-100 text-red-700",
  expired:   "bg-gray-100 text-gray-500",
  cancelled: "bg-gray-100 text-gray-500",
};

type Quotation = {
  id: string; quotation_code: string; quote_date: string;
  valid_until: string | null; status: string;
  product_type: string | null; finish: string | null;
  sqm_quoted: number; price_per_sqm: number | null;
  sqm_invoiced: number; sqm_delivered: number;
  revision_number: number; notes: string | null;
  companies: any; projects: any;
};

export default function RepQuotationsPage() {
  const supabase = createClient();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: rep } = await supabase.from("reps").select("id").eq("auth_user_id", user.id).single();
    if (!rep) return;

    const { data } = await supabase.from("quotations")
      .select("*,companies(company_name),projects(project_code,project_name)")
      .eq("rep_id", rep.id)
      .order("created_at", { ascending: false });

    setQuotations((data ?? []) as unknown as Quotation[]);
    setLoading(false);
  }

  const filtered = quotations.filter(q => !filterStatus || q.status === filterStatus);

  const totalQuoted   = filtered.reduce((s,q) => s + (q.sqm_quoted   ?? 0), 0);
  const totalInvoiced = filtered.reduce((s,q) => s + (q.sqm_invoiced ?? 0), 0);
  const wonCount      = filtered.filter(q => q.status === "won").length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Quotations</h1>
          <p className="text-gray-500 text-sm mt-1">Quotations linked to your projects</p>
        </div>
        <select className="input w-40" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          {["pending","submitted","won","lost","expired","cancelled"].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      {!loading && quotations.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "SQM Quoted",   value: totalQuoted.toLocaleString()   + " m²", color: "text-brand-blue" },
            { label: "SQM Invoiced", value: totalInvoiced.toLocaleString() + " m²", color: "text-green-600" },
            { label: "Won",          value: wonCount,                                 color: "text-green-700" },
          ].map(c => (
            <div key={c.label} className="card px-4 py-3 text-center">
              <div className="text-xs text-gray-500 mb-1">{c.label}</div>
              <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="card p-10 text-center text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          {filterStatus ? "No quotations in this status." : "No quotations linked to your projects yet."}
          <p className="text-xs mt-2 text-gray-300">Quotations are created by the Sales Coordinator team.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(q => {
            const compName = Array.isArray(q.companies) ? q.companies[0]?.company_name : q.companies?.company_name;
            const projName = Array.isArray(q.projects)  ? q.projects[0]?.project_name  : q.projects?.project_name;
            const projCode = Array.isArray(q.projects)  ? q.projects[0]?.project_code  : q.projects?.project_code;
            const totalRef = q.sqm_quoted && q.price_per_sqm
              ? (q.sqm_quoted * q.price_per_sqm).toLocaleString() : null;

            return (
              <div key={q.id} className="card px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900">{q.quotation_code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[q.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {q.status}
                      </span>
                      <span className="text-xs text-gray-400">Rev. {q.revision_number}</span>
                    </div>
                    <div className="text-sm text-gray-700">{compName}</div>
                    <div className="text-xs text-gray-400">{projName || projCode}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-gray-900">{(q.sqm_quoted||0).toLocaleString()} m²</div>
                    {q.price_per_sqm && <div className="text-xs text-gray-500">SAR {q.price_per_sqm}/m²</div>}
                    {totalRef && <div className="text-xs text-gray-400">≈ SAR {totalRef}</div>}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500 border-t border-gray-100 pt-3">
                  {q.product_type  && <span>📦 {q.product_type}</span>}
                  {q.finish        && <span>🎨 {q.finish}</span>}
                  <span>📅 {q.quote_date}</span>
                  {q.valid_until   && <span>Until {q.valid_until}</span>}
                  {q.sqm_invoiced > 0 && (
                    <span className="text-green-700 font-medium">{q.sqm_invoiced.toLocaleString()} m² invoiced</span>
                  )}
                  {q.sqm_delivered > 0 && (
                    <span className="text-teal-700 font-medium">{q.sqm_delivered.toLocaleString()} m² delivered</span>
                  )}
                </div>
                {q.notes && <p className="mt-2 text-xs text-gray-500 italic">"{q.notes}"</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
