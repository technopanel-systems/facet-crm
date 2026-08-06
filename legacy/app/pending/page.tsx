import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function PendingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // If they got approved since last visit, send them to the app
  const { data: rep } = await supabase
    .from("reps")
    .select("status, role")
    .eq("auth_user_id", user.id)
    .single();

  if (rep?.status === "active" && rep?.role === "manager") redirect("/dashboard");
  if (rep?.status === "active") redirect("/rep");

  return (
    <div className="min-h-screen bg-brand-navy flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">

        {/* Icon */}
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">Account Pending Approval</h1>
        <p className="text-gray-500 text-sm mb-6">
          Your account has been created successfully. A manager will review and activate your account shortly. You will be able to log in once approved.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-left text-sm text-amber-800 mb-6">
          <p className="font-semibold mb-1">What happens next?</p>
          <ul className="space-y-1 list-disc list-inside text-amber-700">
            <li>Manager reviews your registration</li>
            <li>Your role and SQM target will be assigned</li>
            <li>Your account will be activated</li>
          </ul>
        </div>

        <form action="/auth/signout" method="post">
          <Link
            href="/login"
            className="btn-secondary w-full block text-center text-sm"
          >
            Back to Login
          </Link>
        </form>
      </div>
    </div>
  );
}
