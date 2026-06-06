"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/workspace";
import { parseDecimal } from "@/lib/format";
import { buildAutoDescription } from "@/lib/properties";
import { getPremiumStatus, FREE_TIER_LIMIT } from "@/lib/billing/premium";

export type PropertyFormState = { error?: string } | undefined;

const optString = z
  .string()
  .optional()
  .transform((v) => (v && v.length ? v : null));

const optDate = z
  .string()
  .optional()
  .transform((v) => (v && v.length ? v : null));

/** Optional decimal stored as-is (e.g. 1234.56). German "1.234,56" supported. */
const optNumber = z
  .string()
  .optional()
  .superRefine((v, ctx) => {
    if (!v || !v.length) return;
    if (parseDecimal(v) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `invalid_number:${v}`,
      });
    }
  })
  .transform((v) => (v && v.length ? parseDecimal(v) : null));

/**
 * Optional percent input — user enters "2,5" for 2.5 %, stored as 0.025.
 * Range guard: 0–100 inclusive.
 */
const optPercentInput = z
  .string()
  .optional()
  .superRefine((v, ctx) => {
    if (!v || !v.length) return;
    const n = parseDecimal(v);
    if (n === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `invalid_percent:${v}`,
      });
      return;
    }
    if (n < 0 || n > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `invalid_percent:${v}`,
      });
    }
  })
  .transform((v) => {
    if (!v || !v.length) return null;
    const n = parseDecimal(v);
    return n === null ? null : n / 100;
  });

const propertySchema = z.object({
  kind: z.enum(["apartment", "house", "parking", "commercial", "other"]),
  parent_property_id: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  street: z.string().min(1, "street_required"),
  postal_code: z.string().min(1, "postal_code_required"),
  city: z.string().min(1, "city_required"),
  location_detail: optString,
  description: optString,
  description_auto: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "on"),
  unit_number: optString,
  sqm: optNumber,
  notary_appointment: optDate,
  transfer_date: optDate,
  registration_date: optDate,
  purchase_price: optNumber,
  transfer_tax: optNumber,
  broker_fee: optNumber,
  notary_fee: optNumber,
  registration_cost: optNumber,
  funding_cost: optNumber,
  equity_amount: optNumber,
  land_value: optNumber,
  building_value_share_pct: optPercentInput,
  depreciation_rate: optPercentInput,
  notes: optString,
});

function getStr(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return v === null ? undefined : (v as string);
}

function readForm(formData: FormData) {
  return {
    kind: getStr(formData, "kind"),
    parent_property_id: getStr(formData, "parent_property_id"),
    street: getStr(formData, "street"),
    postal_code: getStr(formData, "postal_code"),
    city: getStr(formData, "city"),
    location_detail: getStr(formData, "location_detail"),
    description: getStr(formData, "description"),
    description_auto: getStr(formData, "description_auto"),
    unit_number: getStr(formData, "unit_number"),
    sqm: getStr(formData, "sqm"),
    notary_appointment: getStr(formData, "notary_appointment"),
    transfer_date: getStr(formData, "transfer_date"),
    registration_date: getStr(formData, "registration_date"),
    purchase_price: getStr(formData, "purchase_price"),
    transfer_tax: getStr(formData, "transfer_tax"),
    broker_fee: getStr(formData, "broker_fee"),
    notary_fee: getStr(formData, "notary_fee"),
    registration_cost: getStr(formData, "registration_cost"),
    funding_cost: getStr(formData, "funding_cost"),
    equity_amount: getStr(formData, "equity_amount"),
    land_value: getStr(formData, "land_value"),
    building_value_share_pct: getStr(formData, "building_value_share_pct"),
    depreciation_rate: getStr(formData, "depreciation_rate"),
    notes: getStr(formData, "notes"),
  };
}

/** Apply auto-description if the toggle says so. */
function applyAutoDescription<
  T extends {
    description: string | null;
    description_auto: boolean;
    street: string;
    location_detail: string | null;
  },
>(data: T): T {
  if (data.description_auto) {
    const auto = buildAutoDescription({
      street: data.street,
      location_detail: data.location_detail,
    });
    return { ...data, description: auto.length ? auto : null };
  }
  return data;
}

const ownerShareSchema = z.object({
  owner_id: z.string().uuid("invalid_owner_id"),
  ownership_share: z.number().gt(0, "share_range").lte(1, "share_range"),
});

const ownersPayloadSchema = z.object({
  shares: z.array(ownerShareSchema),
});

function parseOwnersPayload(
  raw: FormDataEntryValue | null
): { shares: { owner_id: string; ownership_share: number }[] } | null {
  if (typeof raw !== "string" || raw.length === 0) return { shares: [] };
  try {
    const json = JSON.parse(raw);
    const r = ownersPayloadSchema.safeParse(json);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export async function createProperty(
  _prev: PropertyFormState,
  formData: FormData
): Promise<PropertyFormState> {
  const active = await getActiveWorkspace();
  if (!active) return { error: "no_workspace" };

  // ----- Modell D: Premium-Check vor dem Anlegen ---------------------
  // - 1. Objekt:           durchlassen, alles free
  // - 2.+ Objekt:
  //     • Bezahltes Abo mit ausreichender Quantity → durchlassen
  //     • Bezahltes Abo, aber Quantity reicht nicht → quantity_upgrade_needed
  //     • Kein Abo:
  //         - acknowledge_no_premium=true im Form → durchlassen (Free-Continue)
  //         - sonst → premium_choice_needed (Client zeigt Dialog)
  const premium = await getPremiumStatus(active.id);
  const newCount = premium.propertyCount + 1;
  const acknowledgeNoPremium =
    formData.get("acknowledge_no_premium") === "true";

  if (newCount > FREE_TIER_LIMIT) {
    if (premium.hasPaidSubscription) {
      // Bestehendes Abo, aber Quantity reicht nicht → Upgrade nötig.
      if (premium.subscribedQuantity < newCount) {
        return {
          error: `quantity_upgrade_needed:${premium.subscribedQuantity}:${newCount}`,
        };
      }
      // Abo + Quantity ausreichend → durchlassen.
    } else {
      // Kein Abo → User muss wählen (Premium oder Free-Continue).
      if (!acknowledgeNoPremium) {
        return { error: `premium_choice_needed:${newCount}` };
      }
      // User hat explizit "ohne Premium weiter" gewählt → durchlassen,
      // Premium-Features bleiben gelockt (siehe getPremiumStatus → false).
    }
  }

  const parsed = propertySchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const ownersPayload = parseOwnersPayload(formData.get("owners_payload"));
  if (ownersPayload === null) return { error: "invalid_owners_payload" };

  if (ownersPayload.shares.length > 0) {
    const ids = new Set<string>();
    for (const s of ownersPayload.shares) {
      if (ids.has(s.owner_id)) return { error: "duplicate_owner" };
      ids.add(s.owner_id);
    }
    const sum = ownersPayload.shares.reduce(
      (acc, s) => acc + s.ownership_share,
      0
    );
    if (Math.abs(sum - 1) > 0.0001) return { error: "sum_not_one" };
  }

  const payload = applyAutoDescription(parsed.data);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .insert({ ...payload, workspace_id: active.id })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (ownersPayload.shares.length > 0) {
    const { error: rpcError } = await supabase.rpc("set_property_owners", {
      p_property_id: data.id,
      p_shares: ownersPayload.shares,
    });
    if (rpcError) return { error: rpcError.message };
  }

  revalidatePath("/objekte");
  redirect(`/objekte/${data.id}`);
}

export async function updateProperty(
  id: string,
  _prev: PropertyFormState,
  formData: FormData
): Promise<PropertyFormState> {
  const parsed = propertySchema.safeParse(readForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const payload = applyAutoDescription(parsed.data);

  const supabase = await createClient();
  const { error } = await supabase
    .from("properties")
    .update(payload)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/objekte");
  revalidatePath(`/objekte/${id}`);
  revalidatePath(`/objekte/${id}/bearbeiten`);
  return undefined;
}

export async function deleteProperty(id: string) {
  const supabase = await createClient();
  await supabase.from("properties").delete().eq("id", id);
  revalidatePath("/objekte");
  redirect("/objekte");
}

/**
 * Manueller Demo-Seed für bestehende User.
 *
 * Der `handle_new_user`-Trigger seeded automatisch eine Beispiel-Wohnung
 * für NEUE Signups (Migration 0023). Bestehende User, die vor der
 * Migration registriert wurden, sehen diese aber nie — diese Action
 * füllt die Lücke. Owner-only, idempotent über is_demo-Check.
 *
 * Setzt:
 *   - eine Beispiel-Wohnung in München (350k Kaufpreis, 65 m², ~1y alt)
 *   - ein Annuitätendarlehen (320k @ 3,5 % Zins, 2 % Tilgung)
 *   - einen Bestandsmieter (1.150 € Kalt + 220 € NK, unbefristet)
 *   - eine Portfolio-Bewertung (60 % Ertragswert / 40 % Sachwert)
 */
export async function seedDemoProperty(_formData?: FormData): Promise<void> {
  const active = await getActiveWorkspace();
  if (!active) {
    console.error("[seedDemoProperty] no active workspace");
    return;
  }
  if (active.role !== "owner") {
    console.error("[seedDemoProperty] not owner");
    return;
  }

  const supabase = await createClient();

  // Idempotenz: wenn schon ein Demo-Objekt existiert → no-op.
  const { count } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", active.id)
    .eq("is_demo", true);
  if ((count ?? 0) > 0) {
    revalidatePath("/objekte");
    return;
  }

  // transfer_dt = vor ~12 Monaten.
  const today = new Date();
  const transferDt = new Date(
    Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth(), today.getUTCDate())
  );
  const isoDay = (d: Date) => d.toISOString().slice(0, 10);
  const transferIso = isoDay(transferDt);
  const notaryIso = isoDay(
    new Date(transferDt.getTime() - 60 * 24 * 60 * 60 * 1000)
  );
  const registrationIso = isoDay(
    new Date(transferDt.getTime() + 90 * 24 * 60 * 60 * 1000)
  );
  const firstPaymentIso = isoDay(
    new Date(transferDt.getTime() + 30 * 24 * 60 * 60 * 1000)
  );
  const rateLockIso = isoDay(
    new Date(
      Date.UTC(
        transferDt.getUTCFullYear() + 10,
        transferDt.getUTCMonth(),
        transferDt.getUTCDate()
      )
    )
  );

  const { data: prop, error: propErr } = await supabase
    .from("properties")
    .insert({
      workspace_id: active.id,
      kind: "apartment",
      is_demo: true,
      street: "Beispielstraße 12",
      postal_code: "80331",
      city: "München",
      location_detail: "2. OG links",
      description: "2 Z. ETW",
      sqm: 65,
      notary_appointment: notaryIso,
      transfer_date: transferIso,
      registration_date: registrationIso,
      purchase_price: 350000,
      transfer_tax: 12250,
      broker_fee: 0,
      notary_fee: 5250,
      registration_cost: 1750,
      equity_amount: 50000,
      land_value: 70000,
      building_value_share_pct: 0.8,
      depreciation_rate: 0.02,
      notes:
        "Beispiel-Datensatz — du kannst diese Wohnung jederzeit löschen oder durch dein echtes Objekt ersetzen.",
    })
    .select("id")
    .single();

  if (propErr || !prop) {
    console.error("[seedDemoProperty] property insert failed:", propErr);
    return;
  }

  // Loan + Tenant + Valuation parallel. Fehler an dieser Stelle blockieren
  // den Seed nicht — die Property steht dann ohne Begleitdaten da und der
  // User sieht trotzdem etwas.
  await Promise.all([
    supabase.from("loans").insert({
      property_id: prop.id,
      designation: "Beispiel-Annuitätendarlehen",
      bank: "Beispielbank",
      disbursement_date: transferIso,
      loan_amount: 320000,
      interest_rate_pa: 0.035,
      amortization_pa: 0.02,
      first_payment_date: firstPaymentIso,
      rate_lock_until: rateLockIso,
    }),
    supabase.from("tenants").insert({
      property_id: prop.id,
      name: "Familie Beispiel",
      contract_start: transferIso,
      is_fixed_term: false,
      contract_end: null,
      cold_rent_per_month: 1150,
      ancillary_costs_per_month: 220,
      notes: "Demo-Mietvertrag",
    }),
    supabase.from("portfolio_valuations").insert({
      property_id: prop.id,
      valuation_date: isoDay(today),
      condition_score: 8,
      market_rent_per_sqm: 18,
      multiple: 25,
      building_value: 300000,
      income_weight: 0.6,
    }),
  ]);

  revalidatePath("/objekte");
  revalidatePath("/");
  redirect(`/objekte/${prop.id}`);
}
