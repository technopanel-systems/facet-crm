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

  // THE FAILSAFE: If the database row isn't ready, errors out, or they are explicitly pending
  if (error || !rep || rep.status === "pending") {
    redirect("/pending");
  }

  if (rep.role === "manager" || rep.role === "sales_coordinator") {
    redirect("/dashboard");
  }
  
  redirect("/rep");
}
