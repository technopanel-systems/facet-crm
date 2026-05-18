import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar, { type SidebarRole } from "@/components/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rep } = await supabase
    .from("reps")
    .select("name, role, status")
    .eq("auth_user_id", user.id)
    .single();

  if (rep?.status === "pending") redirect("/pending");

const role = rep?.role?.toLowerCase().trim();
if (role !== "manager" && role !== "sales_coordinator" && role !== "super_admin") {
  redirect("/rep");
}

  return (
    <div className="flex">
      <Sidebar role={(role ?? "manager") as SidebarRole} repName={rep?.name ?? "User"} />
      <main className="ml-60 flex-1 min-h-screen p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
