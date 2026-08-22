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
    const {
      schoolId,
      recipientName,
      recipientEmail,
      recipientPhone,
      role,
      channel,
      appOrigin,
      metadata,
    } = await req.json();

    if (!schoolId || !recipientName || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields (schoolId, recipientName, role)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (channel === "email" && !recipientEmail) {
      return new Response(JSON.stringify({ error: "Email is required for email channel" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (channel === "sms" && !recipientPhone) {
      return new Response(JSON.stringify({ error: "Phone is required for SMS channel" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Generate a secure token
    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");

    // Create invitation record
    const { data: invData, error: invErr } = await admin
      .from("invitations")
      .insert({
        school_id: schoolId,
        token,
        role,
        email: recipientEmail ?? null,
        phone: recipientPhone ?? null,
        full_name: recipientName,
        status: "pending",
        channel: channel ?? "email",
        metadata: metadata ?? {},
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (invErr) {
      return new Response(JSON.stringify({ error: invErr.message ?? "Failed to create invitation" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invitationId = invData?.id;

    // Build the invitation link from the app origin passed by the frontend
    const origin = appOrigin ?? "https://edubridge.app";
    const inviteLink = `${origin}/invite/${token}`;

    return new Response(JSON.stringify({
      success: true,
      invitationId,
      token,
      inviteLink,
      message: "Invitation created successfully",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
