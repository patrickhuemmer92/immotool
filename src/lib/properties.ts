export const PROPERTY_TEXT_FIELDS = [
  "street",
  "postal_code",
  "city",
  "location_detail",
  "description",
  "unit_number",
  "notes",
] as const;

export const PROPERTY_DATE_FIELDS = [
  "notary_appointment",
  "transfer_date",
  "registration_date",
] as const;

export const PROPERTY_NUMERIC_FIELDS = [
  "sqm",
  "purchase_price",
  "transfer_tax",
  "broker_fee",
  "notary_fee",
  "registration_cost",
  "land_value",
  "building_value_share_pct",
  "depreciation_rate",
] as const;

export type PropertyTextField = (typeof PROPERTY_TEXT_FIELDS)[number];
export type PropertyDateField = (typeof PROPERTY_DATE_FIELDS)[number];
export type PropertyNumericField = (typeof PROPERTY_NUMERIC_FIELDS)[number];

export type PropertyDefaults = {
  street: string;
  postal_code: string;
  city: string;
  location_detail: string;
  description: string;
  unit_number: string;
  sqm: string;
  notary_appointment: string;
  transfer_date: string;
  registration_date: string;
  purchase_price: string;
  transfer_tax: string;
  broker_fee: string;
  notary_fee: string;
  registration_cost: string;
  land_value: string;
  /** Percent input (1..100 string). */
  building_value_share_pct: string;
  /** Percent input (1..100 string). */
  depreciation_rate: string;
  notes: string;
};

export const EMPTY_PROPERTY_DEFAULTS: PropertyDefaults = {
  street: "",
  postal_code: "",
  city: "",
  location_detail: "",
  description: "",
  unit_number: "",
  sqm: "",
  notary_appointment: "",
  transfer_date: "",
  registration_date: "",
  purchase_price: "",
  transfer_tax: "",
  broker_fee: "",
  notary_fee: "",
  registration_cost: "",
  land_value: "",
  building_value_share_pct: "",
  depreciation_rate: "",
  notes: "",
};

export type PropertyRow = {
  id: string;
  street: string;
  postal_code: string;
  city: string;
  location_detail: string | null;
  description: string | null;
  unit_number: string | null;
  sqm: string | number | null;
  notary_appointment: string | null;
  transfer_date: string | null;
  registration_date: string | null;
  purchase_price: string | number | null;
  transfer_tax: string | number | null;
  broker_fee: string | number | null;
  notary_fee: string | number | null;
  registration_cost: string | number | null;
  funding_cost: string | number | null;
  land_value: string | number | null;
  building_value_share_pct: string | number | null;
  depreciation_rate: string | number | null;
  notes: string | null;
};

export function rowToDefaults(p: PropertyRow): PropertyDefaults {
  const numStr = (v: string | number | null): string => {
    if (v === null || v === undefined || v === "") return "";
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString("de-DE", {
      useGrouping: false,
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    });
  };
  const pctStr = (v: string | number | null): string => {
    if (v === null || v === undefined || v === "") return "";
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return "";
    return (n * 100).toLocaleString("de-DE", {
      useGrouping: false,
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });
  };
  const str = (v: string | null): string => v ?? "";
  return {
    street: p.street,
    postal_code: p.postal_code,
    city: p.city,
    location_detail: str(p.location_detail),
    description: str(p.description),
    unit_number: str(p.unit_number),
    sqm: numStr(p.sqm),
    notary_appointment: str(p.notary_appointment),
    transfer_date: str(p.transfer_date),
    registration_date: str(p.registration_date),
    purchase_price: numStr(p.purchase_price),
    transfer_tax: numStr(p.transfer_tax),
    broker_fee: numStr(p.broker_fee),
    notary_fee: numStr(p.notary_fee),
    registration_cost: numStr(p.registration_cost),
    land_value: numStr(p.land_value),
    building_value_share_pct: pctStr(p.building_value_share_pct),
    depreciation_rate: pctStr(p.depreciation_rate),
    notes: str(p.notes),
  };
}

export function formatPropertyAddress(p: {
  street: string;
  postal_code: string;
  city: string;
  location_detail?: string | null;
  description?: string | null;
}): string {
  return [
    p.street,
    `${p.postal_code} ${p.city}`,
    p.location_detail || null,
    p.description || null,
  ]
    .filter(Boolean)
    .join(", ");
}
