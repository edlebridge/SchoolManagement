import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const BREVO_SMS_URL = "https://api.brevo.com/v3/transactionalSMS/sms";

interface InvitationRequest {
  schoolId: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  role: string;
  channel?: string;
  appOrigin?: string;
  metadata?: Record<string, unknown>;
  resend?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: InvitationRequest = await req.json();
    const {
      schoolId,
      recipientName,
      recipientEmail,
      recipientPhone,
      role,
      channel = "email",
      appOrigin,
      metadata = {},
      resend = false,
    } = body;

    if (!schoolId || !recipientName || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields (schoolId, recipientName, role)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wantsEmail = channel === "email" || (!recipientPhone && recipientEmail);
    const wantsSms = channel === "sms";

    if (wantsEmail && !recipientEmail) {
      return new Response(JSON.stringify({ error: "Email is required for email channel" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (wantsSms && !recipientPhone) {
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

    // Look up the school to get its name and email for reply-to and template params
    let schoolName = (metadata as Record<string, unknown>).school_name as string ?? "";
    let schoolEmail = "";
    {
      const { data: school } = await admin
        .from("schools")
        .select("name, email")
        .eq("id", schoolId)
        .maybeSingle();
      if (school) {
        schoolName = schoolName || school.name;
        schoolEmail = school.email ?? "";
      }
    }

    // Generate a secure, unique, single-use token
    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");

    // Create invitation record (expires in 7 days)
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
        channel: wantsSms ? "sms" : "email",
        metadata: { ...metadata, school_name: schoolName },
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
    const origin = appOrigin ?? "https://edlebridge-schoolman-cg21.bolt.host";
    const inviteLink = `${origin}/invite/${token}`;

    // Send via Brevo
    const brevoApiKey = Deno.env.get("BREVO_API_KEY") ?? "";
    const brevoSenderEmail = Deno.env.get("BREVO_SENDER_EMAIL") ?? "";
    const brevoSenderName = Deno.env.get("BREVO_SENDER_NAME") ?? "EduBridge";

    let emailSent = false;
    let smsSent = false;
    let sendError: string | null = null;

    if (!brevoApiKey) {
      sendError = "BREVO_API_KEY not configured";
    } else if (wantsEmail && recipientEmail && brevoSenderEmail) {
      try {
        // Use template 1 for school_admin, template 2 for teacher, template 3 for parent
        const templateId = role === "school_admin" ? 1 : role === "teacher" ? 2 : 3;

        const brevoBody: Record<string, unknown> = {
          templateId,
          sender: { email: brevoSenderEmail, name: brevoSenderName },
          to: [{ email: recipientEmail, name: recipientName }],
          params: {
            schoolName,
            adminName: recipientName,
            recipientName,
            invitationLink: inviteLink,
            role,
          },
        };

        // Use school email as reply-to when available
        if (schoolEmail) {
          brevoBody.replyTo = { email: schoolEmail, name: schoolName };
        }

        const brevoRes = await fetch(BREVO_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": brevoApiKey,
          },
          body: JSON.stringify(brevoBody),
        });

        if (brevoRes.ok) {
          emailSent = true;
        } else {
          const brevoErr = await brevoRes.json().catch(() => ({}));
          sendError = (brevoErr as Record<string, string>).message ?? `Brevo API returned ${brevoRes.status}`;
        }
      } catch (err) {
        sendError = (err as Error).message;
      }
    } else if (wantsSms && recipientPhone) {
      try {
        const smsText = `Hi ${recipientName}, you're invited to join ${schoolName} on EduBridge. Click to activate: ${inviteLink} — expires in 7 days.`;

        const smsRes = await fetch(BREVO_SMS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": brevoApiKey,
          },
          body: JSON.stringify({
            sender: brevoSenderName,
            recipient: recipientPhone,
            content: smsText,
          }),
        });

        if (smsRes.ok) {
          smsSent = true;
        } else {
          const smsErr = await smsRes.json().catch(() => ({}));
          sendError = (smsErr as Record<string, string>).message ?? `Brevo SMS API returned ${smsRes.status}`;
        }
      } catch (err) {
        sendError = (err as Error).message;
      }
    }

    // Update invitation status to 'sent' if delivery succeeded
    if (emailSent || smsSent) {
      await admin.from("invitations").update({ status: "sent" }).eq("id", invitationId);
    }

    return new Response(JSON.stringify({
      success: true,
      invitationId,
      token,
      inviteLink,
      emailSent,
      smsSent,
      sendError,
      message: emailSent || smsSent
        ? "Invitation created and sent successfully"
        : "Invitation created but delivery failed",
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
