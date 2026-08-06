"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Company = {
  id: string; customer_code: string; company_name: string;
  company_type: string | null; region: string | null;
  status: string; primary_rep_id: string | null;
  created_at: string;
};

type Flag = {
  id: string; company_id_1: string; company_id_2: string;
  match_type: string; match_key: string; classification: string;
  created_at: string;
  c1?: Company; c2?: Company;
};

const CLASS_STYLE: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-800",
  shared:   "bg-blue-100 text-blue-700",
  conflict: "bg-red-100 text-red-700",
  resolved: "bg-green-100 text-green-800",
};

export default function DuplicatesPage() {
  const supabase = createClient();
  const [flags, setFlags]       = useState<Flag[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("pending");
  const [working, setWorking]   = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: flagData } = await supabase
      .from("duplicate_flags")
      .select("id,company_id_1,company_id_2,match_type,match_key,classification,created_at")
      .order("created_at", { ascending: false });

    if (!flagData || flagData.length === 0) { setFlags([]); setLoading(false); return; }

    // Fetch all unique company IDs
    const allIds = [...new Set(flagData.flatMap(f => [f.company_id_1, f.company_id_2]).filter(Boolean))];
    const { data: compData } = await supabase
      .from("companies")
      .select("id,customer_code,company_name,company_type,region,status,primary_rep_id,created_at")
      .in("id", allIds);

    const compMap: Record<string, Company> = {};
    (compData ?? []).forEach(c => { compMap[c.id] = c; });

    setFlags(flagData.map(f => ({
      ...f,
      c1: compMap[f.company_id_1],
      c2: compMap[f.company_id_2],
    })));
    setLoading(false);
  }

  async function classify(flagId: string, classification: string) {
    setWorking(flagId);
    await supabase.from("duplicate_flags")
      .update({ classification, resolved_at: new Date().toISOString() })
      .eq("id", flagId);
    setWorking(null);
    load();
  }

  async function deleteCompany(flagId: string, companyId: string) {
    if (!confirm("Delete this company record? This cannot be undone.")) return;
    setWorking(flagId);
    await supabase.from("companies").delete().eq("id", companyId);
    await supabase.from("duplicate_flags").update({ classification: "resolved", resolved_at: new Date().toISOString() }).eq("id", flagId);
    setWorking(null);
    load();
  }

  async function createFlag() {
  const { data, error } = await supabase.rpc('detect_duplicate_companies');
  if (error) {
    console.error('Duplicate scan error:', error.message);
    return;
  }
  const newFlags = data as number;
  if (newFlags === 0) {
    alert('Scan complete. No new duplicates found.');
  } else {
    alert(`Scan complete. ${newFlags} new duplicate flag${newFlags !== 1 ? 's' : ''} added.`);
  }
  load();
}

  const filtered = flags.filter(f => filter === "all" || f.classification === filter);
  const pendingCount = flags.filter(f => f.classification === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Duplicates</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? "—" : `${flags.length} flags · ${pendingCount} pending review`}
          </p>
        </div>
        <button onClick={createFlag} className="btn-secondary text-sm flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Scan for Duplicates
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[["pending","Pending"],["shared","Shared"],["conflict","Conflict"],["resolved","Resolved"],["all","All"]].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${filter === val ? "border-brand-blue text-brand-blue" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {label}
            {val === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-100 text-amber-800 text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-10 text-center text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          {filter === "pending"
            ? "No pending duplicates. Click \"Scan for Duplicates\" to check."
            : "No records in this category."}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(flag => (
            <div key={flag.id} className="card overflow-hidden">
              {/* Flag header */}
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CLASS_STYLE[flag.classification] ?? "bg-gray-100 text-gray-600"}`}>
                    {flag.classification}
                  </span>
                  <span className="text-xs text-gray-500">Match: <span className="font-medium text-gray-700">{flag.match_key}</span> ({flag.match_type})</span>
                </div>
                <span className="text-xs text-gray-400">{flag.created_at.split("T")[0]}</span>
              </div>

              {/* Side by side */}
              <div className="grid grid-cols-2 divide-x divide-gray-100">
                {[flag.c1, flag.c2].map((c, i) => (
                  <div key={i} className="p-5">
                    {!c ? (
                      <p className="text-gray-400 text-sm">(Record not found — may have been deleted)</p>
                    ) : (
                      <>
                        <div className="font-semibold text-gray-900 mb-1">{c.company_name}</div>
                        <div className="text-xs text-gray-400 mb-3">{c.customer_code}</div>
                        <div className="space-y-1 text-sm text-gray-600">
                          {c.company_type && <div>📁 {c.company_type}</div>}
                          {c.region       && <div>📍 {c.region}</div>}
                          <div>Status: <span className={`font-medium ${c.status === "active" ? "text-green-700" : "text-gray-500"}`}>{c.status}</span></div>
                          <div className="text-xs text-gray-400">Added {c.created_at.split("T")[0]}</div>
                        </div>
                        {flag.classification === "pending" && (
                          <button
                            onClick={() => deleteCompany(flag.id, c.id)}
                            disabled={working === flag.id}
                            className="mt-3 text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Delete this record
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              {flag.classification === "pending" && (
                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center gap-3">
                  <span className="text-xs text-gray-500 mr-2">Classify as:</span>
                  <button onClick={() => classify(flag.id, "shared")} disabled={working === flag.id}
                    className="btn-secondary text-xs px-3 py-1.5">Shared Accounts</button>
                  <button onClick={() => classify(flag.id, "conflict")} disabled={working === flag.id}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">Conflict</button>
                  <button onClick={() => classify(flag.id, "resolved")} disabled={working === flag.id}
                    className="text-xs px-3 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors">Not a Duplicate</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
