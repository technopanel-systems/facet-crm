"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-800",
  submitted: "bg-blue-100 text-blue-700",
  won:       "bg-green-100 text-green-800",
  lost:      "bg-red-100 text-red-700",
  expired:   "bg-gray-100 text-gray-500",
  cancelled: "bg-gray-100 text-gray-500",
};

type QuotationItem = {
  id: string;
  class: string;
  fr_rating: string;
  color_code: string | null;
  supplier_code: string | null;
  width_m: number;
  width_is_custom: boolean;
  length_m: number;
  num_sheets: number;
  thickness_mm: number;
  price_per_sqm: number | null;
  total_sqm: number;
};

type QuotationService = {
  id: string;
  service_type: string;
  price_per_sqm: number | null;
};

type Quotation = {
  id: string;
  quotation_code: string;
  quote_date: string;
  valid_until: string | null;
  status: string;
  sqm_quoted: number;
  sqm_invoiced: number;
  sqm_delivered: number;
  revision_number: number;
  notes: string | null;
  erp_quotation_id: string | null;
  cancellation_reason: string | null;
  companies: any;
  projects: any;
  items?: QuotationItem[];
  services?: QuotationService[];
};

export default function RepQuotationsPage() {
  const supabase = createClient();
  const [quotations, setQuotations]     = useState<Quotation[]>([]);
  const [loading, setLoading]           = useState(true);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [itemsMap, setItemsMap]         = useState<Record<string, QuotationItem[]>>({});
  const [servicesMap, setServicesMap]   = useState<Record<string, QuotationService[]>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch]             = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: rep } = await supabase.from("reps").select("id").eq("auth_user_id", user.id).single();
    if (!rep) { setLoading(false); return; }

    const { data } = await supabase
      .from("quotations")
      .select("*,companies(company_name),projects(project_code,project_name)")
      .or(`rep_id.eq.${rep.id},assigned_to_id.eq.${rep.id}`)
      .order("created_at", { ascending: false });

    setQuotations((data ?? []) as unknown as Quotation[]);
    setLoading(false);
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (itemsMap[id]) return; // already loaded

    setLoadingDetail(true);
    const [{ data: items }, { data: services }] = await Promise.all([
      supabase.from("quotation_items").select("*").eq("quotation_id", id).order("created_at"),
      supabase.from("quotation_services").select("*").eq("quotation_id", id),
    ]);
    setItemsMap(m => ({ ...m, [id]: items ?? [] }));
    setServicesMap(m => ({ ...m, [id]: services ?? [] }));
    setLoadingDetail(false);
  }

  const filtered = quotations.filter(q => {
    const compName = Array.isArray(q.companies) ? q.companies[0]?.company_name : q.companies?.company_name;
    const projName = Array.isArray(q.projects)  ? q.projects[0]?.project_name  : q.projects?.project_name;
    const s = search.toLowerCase();
    return (
      (!search        || (q.quotation_code||"").toLowerCase().includes(s) || (compName||"").toLowerCase().includes(s) || (projName||"").toLowerCase().includes(s)) &&
      (!filterStatus  || q.status === filterStatus)
    );
  });

  const totalSqmQuoted = filtered.reduce((s, q) => s + (q.sqm_quoted ?? 0), 0);
  const wonCount       = filtered.filter(q => q.status === "won").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Quotations</h1>
        <p className="text-gray-500 text-sm mt-1">
          {loading ? "—" : `${filtered.length} quotations · ${totalSqmQuoted.toLocaleString()} m² quoted · ${wonCount} won`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search by code, company, project…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-40" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          {["pending","submitted","won","lost","expired","cancelled"].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(search || filterStatus) && (
          <button onClick={() => { setSearch(""); setFilterStatus(""); }}
            className="btn-secondary text-sm px-3">Clear</button>
        )}
      </div>

      {loading ? (
        <div className="card p-10 text-center text-gray-400">Loading quotations…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">No quotations found.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(q => {
            const compName = Array.isArray(q.companies) ? q.companies[0]?.company_name : q.companies?.company_name;
            const projName = Array.isArray(q.projects)  ? q.projects[0]?.project_name  : q.projects?.project_name;
            const projCode = Array.isArray(q.projects)  ? q.projects[0]?.project_code  : q.projects?.project_code;
            const isOpen   = expandedId === q.id;
            const items    = itemsMap[q.id] ?? [];
            const services = servicesMap[q.id] ?? [];

            return (
              <div key={q.id} className="card overflow-hidden">
                {/* Card header — always visible */}
                <button
                  onClick={() => toggleExpand(q.id)}
                  className="w-full text-left px-5 py-4 hover:bg-gray-50/60 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-semibold text-gray-900">{q.quotation_code}</span>
                        {q.erp_quotation_id && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                            ERP: {q.erp_quotation_id}
                          </span>
                        )}
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[q.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {q.status}
                        </span>
                        {q.revision_number > 0 && (
                          <span className="text-xs text-gray-400">Rev. {q.revision_number}</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {compName || "—"} · {projName || projCode || "—"}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {q.quote_date}{q.valid_until ? ` → ${q.valid_until}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-brand-blue">
                        {(q.sqm_quoted || 0).toLocaleString()} m²
                      </div>
                      {q.sqm_invoiced > 0 && (
                        <div className="text-xs text-green-700 font-medium">{q.sqm_invoiced.toLocaleString()} invoiced</div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        {isOpen ? "▲ Hide" : "▼ Details"}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-4 bg-gray-50/30">
                    {loadingDetail && items.length === 0 ? (
                      <div className="text-sm text-gray-400 py-2">Loading items…</div>
                    ) : items.length === 0 ? (
                      <div className="text-sm text-gray-400 py-2">No product lines recorded.</div>
                    ) : (
                      <>
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Product Lines</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="text-gray-400 uppercase tracking-wide">
                              <tr>
                                <th className="pb-2 pr-4">Class</th>
                                <th className="pb-2 pr-4">FR</th>
                                <th className="pb-2 pr-4">Supplier</th>
                                <th className="pb-2 pr-4">Color</th>
                                <th className="pb-2 pr-4">Thickness</th>
                                <th className="pb-2 pr-4">W × L × Sheets</th>
                                <th className="pb-2 pr-4 text-right">SQM</th>
                                <th className="pb-2 text-right">Price/m²</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {items.map(item => (
                                <tr key={item.id} className="text-gray-700">
                                  <td className="py-2 pr-4 font-medium">{item.class}</td>
                                  <td className="py-2 pr-4">{item.fr_rating}</td>
                                  <td className="py-2 pr-4">{item.supplier_code || "—"}</td>
                                  <td className="py-2 pr-4">{item.color_code || "—"}</td>
                                  <td className="py-2 pr-4">{item.thickness_mm}mm</td>
                                  <td className="py-2 pr-4">
                                    {item.width_m}m × {item.length_m}m × {item.num_sheets}
                                    {item.width_is_custom && <span className="text-gray-400 ml-1">(custom)</span>}
                                  </td>
                                  <td className="py-2 pr-4 text-right font-semibold text-brand-blue">
                                    {(item.total_sqm || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} m²
                                  </td>
                                  <td className="py-2 text-right">
                                    {item.price_per_sqm ? `SAR ${item.price_per_sqm}` : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="font-bold text-gray-900 border-t border-gray-200">
                                <td colSpan={6} className="pt-2 text-xs text-gray-500">Total</td>
                                <td className="pt-2 text-right text-brand-blue">
                                  {(q.sqm_quoted || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} m²
                                </td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </>
                    )}

                    {/* Services */}
                    {services.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Services</div>
                        <div className="flex flex-wrap gap-2">
                          {services.map(svc => (
                            <span key={svc.id} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700">
                              {svc.service_type}
                              {svc.price_per_sqm ? <span className="text-gray-400 ml-1">· SAR {svc.price_per_sqm}/m²</span> : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes & cancellation */}
                    {q.notes && (
                      <div className="text-xs text-gray-500">
                        <span className="font-semibold text-gray-400 uppercase tracking-wide mr-2">Notes</span>
                        {q.notes}
                      </div>
                    )}
                    {q.status === 'cancelled' && q.cancellation_reason && (
                      <div className="text-xs text-red-600">
                        <span className="font-semibold uppercase tracking-wide mr-2">Cancellation Reason</span>
                        {q.cancellation_reason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
