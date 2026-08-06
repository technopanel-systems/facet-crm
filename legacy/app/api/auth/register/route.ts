import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { email, password, name, role, monthly_target_sqm } = await request.json();

    if (!email.endsWith("@technopanel.com.sa")) {
      return NextResponse.json(
        { error: "Only @technopanel.com.sa email addresses are allowed." },
        { status: 403 }
      );
    }

    const adminClient = createAdminClient();

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) throw authError;

    const { error: dbError } = await adminClient.from("reps").insert({
      auth_user_id:       authData.user.id,
      name,
      email,
      role:               role ?? "rep",
      status:             "active",
      monthly_target_sqm: monthly_target_sqm ?? 0,
    });

    if (dbError) throw dbError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
