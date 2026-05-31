"use client";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const COMPANY_TYPES = ['Factory','Advertising','Real Estate','Owner','Consultant','Contractor','Station Management','Workshop','Other'];
const REGIONS       = ['Central','West','East','North','South','Foreign'];
const SOURCES       = ['Field Visit','Direct Contact','Referral','Exhibition','Marketing','Other'];

type Rep = { id: string; name: string };

type ParsedRow = {
  company_name: string;
  company_type: string;
  region: string;
  source: string;
  notes: string;
  valid: boolean;
  error: string;
};

type ImportResult = {
  company_name: string;
  success: boolean;
  error?: string;
};

export default function ImportPage() {
  const supabase  = createClient();
  const fileRef   = useRef<HTMLInputElement>(null);

  const [reps, setReps]           = useState<Rep[]>([]);
  const [repsLoaded, setRepsLoaded] = useState(false);
  const [assignRepId, setAssignRepId] = useState("");
  const [rows, setRows]           = useState<ParsedRow[]>([]);
  const [fileName, setFileName]   = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults]     = useState<ImportResult[]>([]);
  const [done, setDone]           = useState(false);

  async function loadReps() {
    if (repsLoaded) return;
    const { data } = await supabase.from("reps")
      .select("id,name").in("role",["rep","marketing"]).eq("status","active").order("name");
    setReps(data ?? []);
    setRepsLoaded(true);
  }

  function parseCSV(text: string): ParsedRow[] {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    // Detect delimiter
    const delim = lines[0].includes("\t") ? "\t" : ",";

    const headers = lines[0].split(delim).map(h => h.trim().toLowerCase()
      .replace(/[^a-z0-9_]/g, "_").replace(/__+/g, "_"));

    function col(row: string[], name: string): string {
      const idx = headers.indexOf(name);
      return idx >= 0 ? (row[idx] ?? "").trim().replace(/^["']|["']$/g, "") : "";
    }

    return lines.slice(1).map(line => {
      const cells = line.split(delim);
      const name  = col(cells, "company_name") || col(cells, "name") || col(cells, "company");
      const type  = col(cells, "company_type") || col(cells, "type") || "";
      const region = col(cells, "region") || "";
      const source = col(cells, "source") || "";
      const notes  = col(cells, "notes") || col(cells, "note") || "";

      let error = "";
      if (!name) error = "Missing company name";
      else if (type && !COMPANY_TYPES.includes(type)) error = `Invalid type: "${type}"`;
      else if (region && !REGIONS.includes(region)) error = `Invalid region: "${region}"`;
      else if (source && !SOURCES.includes(source)) error = `Invalid source: "${source}"`;

      return {
        company_name: name,
        company_type: type,
        region,
        source,
        notes,
        valid: !error,
        error,
      };
    }).filter(r => r.company_name || r.error);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setDone(false);
    setResults([]);

    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
    };
    reader.readAsText(file, "utf-8");

    loadReps();
  }

  async function handleImport() {
    const validRows = rows.filter(r => r.valid);
    if (validRows.length === 0) return;
    setImporting(true);
    setResults([]);

    const out: ImportResult[] = [];

    for (const row of validRows) {
      const { error } = await supabase.rpc("create_company_with_rep", {
        p_company_name:  row.company_name,
        p_company_type:  row.company_type  || "",
        p_region:        row.region        || "",
        p_source:        row.source        || "",
        p_source_detail: "",
        p_notes:         row.notes         || "",
        p_rep_id:        assignRepId       || null,
      });

      out.push({
        company_name: row.company_name,
        success: !error,
        error: error?.message,
      });
    }

    setResults(out);
    setImporting(false);
    setDone(true);
  }

  function downloadTemplate() {
    const csv = [
      "company_name,company_type,region,source,notes",
      "Al Noor Factory,Factory,Central,Referral,Main contact is Ahmed",
      "Riyadh Contractors,Contractor,Central,Field Visit,",
      "Eastern Consultants,Consultant,East,Exhibition,",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "company_import_template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const validCount   = rows.filter(r => r.valid).length;
  const invalidCount = rows.filter(r => !r.valid).length;
  const successCount = results.filter(r => r.success).length;
  const failCount    = results.filter(r => !r.success).length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bulk Import Companies</h1>
        <p className="text-gray-500 text-sm mt-1">
          Upload a CSV file to import multiple companies at once.
        </p>
      </div>

      {/* Instructions */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">CSV Format</h2>
          <button onClick={downloadTemplate} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download Template
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="text-xs text-left w-full">
            <thead className="text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="pr-6 pb-2">Column</th>
                <th className="pr-6 pb-2">Required</th>
                <th className="pb-2">Allowed Values</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 divide-y divide-gray-50">
              {[
                { col:"company_name", req:"Yes", vals:"Any text" },
                { col:"company_type", req:"No",  vals:COMPANY_TYPES.join(", ") },
                { col:"region",       req:"No",  vals:REGIONS.join(", ") },
                { col:"source",       req:"No",  vals:SOURCES.join(", ") },
                { col:"notes",        req:"No",  vals:"Any text" },
              ].map(r => (
                <tr key={r.col}>
                  <td className="pr-6 py-1.5 font-mono text-brand-blue">{r.col}</td>
                  <td className="pr-6 py-1.5">{r.req}</td>
                  <td className="py-1.5 text-gray-500">{r.vals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400">
          First row must be column headers. Values are case-sensitive. Extra columns are ignored.
        </p>
      </div>

      {/* Upload */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">Upload File</h2>
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-brand-blue hover:bg-brand-light/30 transition-colors"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-gray-400">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {fileName ? (
            <div>
              <p className="text-sm font-medium text-gray-900">{fileName}</p>
              <p className="text-xs text-gray-500 mt-1">Click to change file</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-700">Click to upload CSV</p>
              <p className="text-xs text-gray-400 mt-1">or drag and drop</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden"
            onChange={handleFile} />
        </div>

        {/* Assign rep */}
        {rows.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700 whitespace-nowrap font-medium">Assign all to:</label>
            <select className="input w-56" value={assignRepId} onChange={e => setAssignRepId(e.target.value)}>
              <option value="">No rep (unassigned)</option>
              {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Preview */}
      {rows.length > 0 && !done && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Preview</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {validCount} valid · {invalidCount > 0 && (
                  <span className="text-red-600">{invalidCount} with errors (will be skipped)</span>
                )}
              </p>
            </div>
            <button
              onClick={handleImport}
              disabled={importing || validCount === 0}
              className="btn-primary flex items-center gap-2"
            >
              {importing ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Importing…
                </>
              ) : `Import ${validCount} Companies`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Company Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Region</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row, i) => (
                  <tr key={i} className={row.valid ? "hover:bg-gray-50/60" : "bg-red-50/40"}>
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.company_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{row.company_type || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{row.region || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{row.source || "—"}</td>
                    <td className="px-4 py-3">
                      {row.valid ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Ready</span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{row.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Results */}
      {done && results.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Import Complete</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="text-green-600 font-medium">{successCount} imported</span>
              {failCount > 0 && <span className="text-red-600 font-medium ml-3">{failCount} failed</span>}
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {results.map((r, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-900">{r.company_name}</span>
                {r.success ? (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">✓ Imported</span>
                ) : (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{r.error ?? "Failed"}</span>
                )}
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50">
            <button onClick={() => { setRows([]); setResults([]); setFileName(""); setDone(false); if (fileRef.current) fileRef.current.value = ""; }}
              className="btn-secondary text-sm">
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
