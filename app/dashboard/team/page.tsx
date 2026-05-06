"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Rep = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  monthly_target_sqm: number;
};

export default function TeamPage() {
  const supabase = createClient();
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeam();
  }, []);

  async function fetchTeam() {
    const { data } = await supabase.from("reps").select("*").order("status", { ascending: false }).order("name");
    if (data) setReps(data);
    setLoading(false);
  }

  async function updateRep(id: string, field: string, value: string | number) {
    // Optimistic UI update
    setReps(reps.map(r => r.id === id ? { ...r, [field]: value } : r));
    await supabase.from("reps").update({ [field]: value }).eq("id", id);
  }

  if (loading) return <div className="p-8 text-gray-500">Loading team...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
        <p className="text-gray-500 text-sm mt-1">Approve accounts, set roles, and assign monthly SQM targets.</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold uppercase tracking-wider text-xs">
            <tr>
              <th className="px-5 py-4">Name / Email</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Role</th>
              <th className="px-5 py-4">Target (SQM)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {reps.map((rep) => (
              <tr key={rep.id} className={rep.status === "pending" ? "bg-amber-50/30" : "bg-white"}>
                <td className="px-5 py-4">
                  <div className="font-medium text-gray-900">{rep.name}</div>
                  <div className="text-gray-500 text-xs">{rep.email}</div>
                </td>
                <td className="px-5 py-4">
                  <select 
                    value={rep.status} 
                    onChange={(e) => updateRep(rep.id, "status", e.target.value)}
                    className={`text-xs font-semibold rounded-full px-2 py-1 outline-none border cursor-pointer ${
                      rep.status === 'active' ? 'bg-green-100 text-green-800 border-green-200' : 
                      rep.status === 'pending' ? 'bg-amber-100 text-amber-800 border-amber-200' : 
                      'bg-gray-100 text-gray-800 border-gray-200'
                    }`}
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </td>
                <td className="px-5 py-4">
                  <select 
                    value={rep.role} 
                    onChange={(e) => updateRep(rep.id, "role", e.target.value)}
                    className="input py-1.5 px-2 text-xs w-32"
                  >
                    <option value="rep">Sales Rep</option>
                    <option value="manager">Manager</option>
                  </select>
                </td>
                <td className="px-5 py-4">
                  <input 
                    type="number" 
                    value={rep.monthly_target_sqm}
                    onChange={(e) => updateRep(rep.id, "monthly_target_sqm", Number(e.target.value))}
                    className="input py-1.5 px-3 w-32"
                    min="0"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
