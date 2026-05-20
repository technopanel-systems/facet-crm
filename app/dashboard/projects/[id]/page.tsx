"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";

type HistoryEntry = {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  reps: any;
};

type Project = {
  id: string; project_code: string; project_name: string | null;
  stage: string; quoted_sqm: number; won_sqm: number;
  city: string | null; project_date: string | null;
  loss_reason: string | null; loss_notes: string | null;
  notes: string | null;
  companies: any;
  project_reps: { role: string; reps: any }[];
};

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

const FIELD_LABEL: Record<string, string> = {
  stage:        'Stage changed',
  quoted_sqm:   'Quoted SQM updated',
  loss_reason:  'Loss reason recorded',
  assigned_rep: 'Rep assignment changed',
};

export default function ProjectDetailPage() {
  const supabase = createClient();
  const params   = useParams();
  const router   = useRouter();
  const id       = params.id as string;

  const [project, setProject]   = useState<Project | null>(null);
  const [history, setHistory]   = useState<HistoryEntry[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    const [projRes, histRes] = await Promise.all([
      supabase.from('projects')
        .select('id, project_code, project_name, stage, quoted_sqm, won_sqm, city, project_date, loss_reason, loss_notes, notes, companies(company_name), project_reps(role, reps(name))')
        .eq('id', id)
        .single(),
      supabase.from('project_history')
        .select('id, field_name, old_value, new_value, changed_at, reps(name)')
        .eq('project_id', id)
        .order('changed_at', { ascending: false }),
    ]);
    setProject(projRes.data as unknown as Project);
    setHistory((histRes.data ?? []) as unknown as HistoryEntry[]);
    setLoading(false);
  }

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>;
  if (!project) return <div className="p-8 text-gray-400">Project not found.</div>;

  const companyName = Array.isArray(project.companies)
    ? project.companies[0]?.company_name
    : project.companies?.company_name;

  const repNames = project.project_reps
    ?.map(pr => Array.isArray(pr.reps) ? pr.reps[0]?.name : pr.reps?.name)
    .filter(Boolean).join(', ') || '—';

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => router.push('/dashboard/projects')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back to Projects
      </button>

      {/* Project Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">
                {project.project_name || '(No name)'}
              </h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLOR[project.stage] ?? 'bg-gray-100 text-gray-700'}`}>
                {project.stage}
              </span>
            </div>
            <div className="text-xs text-gray-400 mb-3">Ref: {project.project_code}</div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              {companyName && <span>🏢 {companyName}</span>}
              {project.city && <span>📍 {project.city}</span>}
              {project.project_date && <span>📅 {project.project_date}</span>}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Quoted SQM</div>
            <div className="font-semibold text-gray-900">{(project.quoted_sqm ?? 0).toLocaleString()} m²</div>
          </div>
          {project.won_sqm > 0 && (
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Won SQM</div>
              <div className="font-semibold text-green-700">{project.won_sqm.toLocaleString()} m²</div>
            </div>
          )}
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Assigned Rep(s)</div>
            <div className="font-semibold text-gray-900">{repNames}</div>
          </div>
        </div>

        {project.stage === 'Lost' && project.loss_reason && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-400 mb-1">Loss Reason</div>
            <div className="text-sm font-medium text-red-700">{project.loss_reason}</div>
            {project.loss_notes && (
              <div className="text-sm text-gray-500 mt-1 italic">"{project.loss_notes}"</div>
            )}
          </div>
        )}

        {project.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-400 mb-1">Notes</div>
            <div className="text-sm text-gray-600">{project.notes}</div>
          </div>
        )}
      </div>

      {/* History Timeline */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-5">Project History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">No changes recorded yet. History is tracked from now on.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-100" />
            <div className="space-y-5">
              {history.map(h => {
                const repName = Array.isArray(h.reps) ? h.reps[0]?.name : h.reps?.name;
                return (
                  <div key={h.id} className="flex gap-4 relative">
                    <div className="w-6 h-6 rounded-full bg-brand-blue/10 border-2 border-brand-blue/20 flex-shrink-0 flex items-center justify-center relative z-10">
                      <div className="w-2 h-2 rounded-full bg-brand-blue" />
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="text-sm font-medium text-gray-900">
                        {FIELD_LABEL[h.field_name] ?? h.field_name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {h.old_value && (
                          <span className="line-through text-gray-400 mr-2">{h.old_value}</span>
                        )}
                        {h.new_value && (
                          <span className="text-gray-700 font-medium">{h.new_value}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {repName && <span>{repName} · </span>}
                        {new Date(h.changed_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
