import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: rep, error } = await supabase
    .from("reps")
    .select("role, status")
    .eq("auth_user_id", user.id)
    .single();

  if (error || !rep || rep.status === "pending") {
    redirect("/pending");
  }

  // Ensure case-insensitivity and remove trailing spaces
const role = rep.role?.toLowerCase().trim();
if (role === "manager" || role === "sales_coordinator" || role === "super_admin") {
  redirect("/dashboard");
}
  
  redirect("/rep");
}
