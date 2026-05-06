import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    // 1. Strict Domain Validation
    if (!email.endsWith("@technopanel.com.sa")) {
      return NextResponse.json(
        { error: "Only @technopanel.com.sa email addresses are allowed." },
        { status: 403 }
      );
    }

    const adminAuthClient = createAdminClient();

    // 2. Create User in Supabase Auth (Auto-confirmed for now, waiting on Manager Approval)
    const { data: authData, error: authError } = await adminAuthClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, 
    });

    if (authError) throw authError;

    // 3. Insert into reps table as 'pending'
    const { error: dbError } = await adminAuthClient.from("reps").insert({
      auth_user_id: authData.user.id,
      name: name,
      email: email,
      role: "rep",
      status: "pending",
      monthly_target_sqm: 0,
    });

    if (dbError) throw dbError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
