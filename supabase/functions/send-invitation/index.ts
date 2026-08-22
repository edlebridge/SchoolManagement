import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const { schoolId, studentName, parentName, parentEmail, parentPhone, relationship, channel, studentId, appOrigin } = await req.json();

    if (!schoolId || !parentName || !studentName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (channel === "email" && !parentEmail) {
      return new Response(JSON.stringify({ error: "Email is required for email channel" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (channel === "sms" && !parentPhone) {
      return new Response(JSON.stringify({ error: "Phone is required for SMS channel" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Generate a secure token
    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");

    // Create invitation record
    const invRes = await fetch(`${supabaseUrl}/rest/v1/invitations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        school_id: schoolId,
        token,
        role: "parent",
        email: parentEmail ?? null,
        phone: parentPhone ?? null,
        full_name: parentName,
        status: "pending",
        channel: channel ?? "email",
        metadata: { student_id: studentId, student_name: studentName, relationship },
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });

    if (!invRes.ok) {
      const err = await invRes.json();
      return new Response(JSON.stringify({ error: err.message ?? "Failed to create invitation" }), {
        status: invRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invData = await invRes.json();
    const invitationId = invData[0]?.id;

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
