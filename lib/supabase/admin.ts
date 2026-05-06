import { createClient } from "@supabase/supabase-js";

// This client uses the Service Role Key. 
// IT MUST NEVER BE USED IN CLIENT COMPONENTS OR PUBLIC ROUTES.
export const createAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
};
