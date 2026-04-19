// Deploy: supabase functions deploy invite-user --no-verify-jwt
// (JWT is verified in code below via auth.getUser.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured (missing Supabase env)" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("roles(name)")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profErr || !prof || (prof as { roles?: { name?: string } }).roles?.name !== "Admin") {
      return new Response(JSON.stringify({ error: "Forbidden — Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: { email?: string; fullName?: string; roleId?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = (body.email ?? "").trim().toLowerCase();
    const fullName = (body.fullName ?? "").trim();
    const roleId = (body.roleId ?? "").trim();

    if (!email || !fullName || !roleId) {
      return new Response(JSON.stringify({ error: "email, fullName, and roleId are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parts = fullName.split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ") || "";

    const siteUrl = (Deno.env.get("SITE_URL") ?? "http://localhost:5173").replace(/\/$/, "");

    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/login`,
      data: { full_name: fullName },
    });

    if (inviteErr) {
      return new Response(JSON.stringify({ error: inviteErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newId = invited.user?.id;
    if (!newId) {
      return new Response(JSON.stringify({ error: "Invite failed (no user id)" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: upErr } = await admin
      .from("profiles")
      .update({
        email,
        first_name: firstName,
        last_name: lastName,
        role_id: roleId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", newId);

    if (upErr) {
      return new Response(
        JSON.stringify({
          ok: true,
          userId: newId,
          warning: `User invited but profile update failed: ${upErr.message}. Set role manually in Table Editor.`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ ok: true, userId: newId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
