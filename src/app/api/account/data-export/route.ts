/**
 * GET /api/account/data-export
 *
 * Liefert ein JSON-Bundle mit allen Daten, die der eingeloggte User
 * in der Plattform besitzt — als File-Download mit Content-Disposition.
 *
 * DSGVO Art. 15 (Auskunftsrecht) + Art. 20 (Datenübertragbarkeit).
 *
 * Wir laufen über alle Workspaces, in denen der User Mitglied ist,
 * und sammeln pro Workspace die kompletten Geschäftsdaten. Sensible
 * Felder (Stripe-Customer-IDs, Tokens etc.) sind enthalten — der
 * Export ist nur für den User selbst.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // 1) Memberships finden (alle Workspaces, denen der User angehört).
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, status, invited_at, accepted_at")
    .eq("user_id", user.id);

  const workspaceIds = (memberships ?? []).map((m) => m.workspace_id);

  // Pro Workspace die kompletten Daten holen. RLS sorgt dafür, dass
  // wir nur Sachen sehen, die der User auch wirklich sehen darf —
  // wenn er nur Viewer ist, kriegt er alles read-only, das passt.
  const workspaceBundles = await Promise.all(
    workspaceIds.map(async (wsId) => {
      const [
        { data: workspace },
        { data: settings },
        { data: members },
        { data: properties },
        { data: tenants },
        { data: loans },
        { data: pnlSnapshots },
        { data: valuations },
        { data: investments },
        { data: owners },
        { data: ownerMembers },
        { data: propertyOwners },
        { data: portfolios },
        { data: portfolioProperties },
        { data: simulations },
        { data: simulationInvestments },
        { data: subscription },
        { data: connectAccount },
      ] = await Promise.all([
        supabase.from("workspaces").select("*").eq("id", wsId).maybeSingle(),
        supabase.from("settings").select("*").eq("workspace_id", wsId).maybeSingle(),
        supabase.from("workspace_members").select("*").eq("workspace_id", wsId),
        supabase.from("properties").select("*").eq("workspace_id", wsId),
        supabase
          .from("tenants")
          .select("*, property:properties!inner(workspace_id)")
          .eq("property.workspace_id", wsId),
        supabase
          .from("loans")
          .select("*, property:properties!inner(workspace_id)")
          .eq("property.workspace_id", wsId),
        supabase
          .from("pnl_snapshots")
          .select("*, property:properties!inner(workspace_id)")
          .eq("property.workspace_id", wsId),
        supabase
          .from("portfolio_valuations")
          .select("*, property:properties!inner(workspace_id)")
          .eq("property.workspace_id", wsId),
        supabase
          .from("investment_plans")
          .select("*, property:properties!inner(workspace_id)")
          .eq("property.workspace_id", wsId),
        supabase.from("owners").select("*").eq("workspace_id", wsId),
        supabase
          .from("owner_members")
          .select("*, owner:owners!inner(workspace_id)")
          .eq("owner.workspace_id", wsId),
        supabase
          .from("property_owners")
          .select("*, property:properties!inner(workspace_id)")
          .eq("property.workspace_id", wsId),
        supabase.from("portfolios").select("*").eq("workspace_id", wsId),
        supabase
          .from("portfolio_properties")
          .select("*, portfolio:portfolios!inner(workspace_id)")
          .eq("portfolio.workspace_id", wsId),
        supabase.from("simulations").select("*").eq("workspace_id", wsId),
        supabase
          .from("simulation_investments")
          .select("*, simulation:simulations!inner(workspace_id)")
          .eq("simulation.workspace_id", wsId),
        supabase.from("subscriptions").select("*").eq("workspace_id", wsId).maybeSingle(),
        supabase
          .from("connect_accounts")
          .select("*")
          .eq("workspace_id", wsId)
          .maybeSingle(),
      ]);

      return {
        workspace,
        settings,
        members,
        properties,
        tenants,
        loans,
        pnl_snapshots: pnlSnapshots,
        valuations,
        investments,
        owners,
        owner_members: ownerMembers,
        property_owners: propertyOwners,
        portfolios,
        portfolio_properties: portfolioProperties,
        simulations,
        simulation_investments: simulationInvestments,
        subscription,
        connect_account: connectAccount,
      };
    })
  );

  const bundle = {
    meta: {
      generated_at: new Date().toISOString(),
      schema_version: "2026-06-04",
      user_id: user.id,
      user_email: user.email ?? null,
      note:
        "DSGVO Art. 15 / Art. 20 Export. Enthält alle personenbezogenen " +
        "und business-relevanten Daten, die der angemeldete User in dieser " +
        "Plattform hat.",
    },
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
    },
    memberships,
    workspaces: workspaceBundles,
  };

  const filename = `estateably-export-${user.id.slice(0, 8)}-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
