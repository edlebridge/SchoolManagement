import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { email, password, fullName, phone, schoolId, role } = await req.json();

    if (!email || !password || !fullName || !schoolId || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Try to create auth user
    let userId: string;
    const { data: userData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (authErr) {
      // If already registered, look up the existing auth user
      if (authErr.message?.toLowerCase().includes("already") || authErr.message?.toLowerCase().includes("registered")) {
        const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
        if (listErr || !listData?.users) {
          return new Response(JSON.stringify({ error: "Email already registered and could not look up existing user" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const existing = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (!existing) {
          return new Response(JSON.stringify({ error: "Email already registered but user not found" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = existing.id;
        // Update their password so they can log in with the new credentials
        await admin.auth.admin.updateUserById(userId, { password });
      } else {
        return new Response(JSON.stringify({ error: authErr.message ?? "Failed to create user" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Failed to create user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      userId = userData.user.id;
    }

    // Check if app_users profile already exists for this user+school
    const { data: existingProfile } = await admin
      .from("app_users")
      .select("id")
      .eq("user_id", userId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (existingProfile) {
      // Profile already exists — just return the IDs so the caller can link
      return new Response(JSON.stringify({ userId, profileId: existingProfile.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert app_users profile
    const { data: profile, error: profileErr } = await admin
      .from("app_users")
      .insert({
        user_id: userId,
        school_id: schoolId,
        role,
        full_name: fullName,
        phone: phone ?? null,
        active: true,
      })
      .select("id")
      .single();

    if (profileErr) {
      return new Response(JSON.stringify({ error: profileErr.message ?? "Failed to create profile" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ userId, profileId: profile?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
