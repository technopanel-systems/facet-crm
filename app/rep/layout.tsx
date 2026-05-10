import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default async function RepLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rep } = await supabase
    .from("reps")
    .select("name, role, status")
    .eq("auth_user_id", user.id)
    .single();

  // Manager should never be in rep layout
  if (rep?.role === "manager") redirect("/dashboard");

  // Pending reps see a waiting screen, not the app
  if (rep?.status === "pending") redirect("/pending");

  return (
    <div className="flex">
      <Sidebar role="rep" repName={rep?.name ?? "Rep"} />
      <main className="ml-60 flex-1 min-h-screen p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
