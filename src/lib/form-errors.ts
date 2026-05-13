/**
 * Map raw error codes returned by server actions to translation keys.
 * Server-action error strings are either plain codes ("duplicate_period",
 * "no_workspace", "forbidden") or formatted as "<code>:<value>" — we split
 * on the first colon and look up the code.
 */
export function errorToTranslationKey(raw: string): {
  key: string;
  params?: Record<string, string>;
} {
  const idx = raw.indexOf(":");
  const code = idx === -1 ? raw : raw.slice(0, idx);
  const value = idx === -1 ? undefined : raw.slice(idx + 1);

  switch (code) {
    case "no_workspace":
      return { key: "errors.no_workspace" };
    case "forbidden":
      return { key: "errors.forbidden" };
    case "unauthorized":
      return { key: "errors.unauthorized" };
    case "invalid_number":
      return { key: "errors.invalid_number", params: { value: value ?? "" } };
    case "invalid_percent":
      return { key: "errors.invalid_percent", params: { value: value ?? "" } };
    case "invalid_year":
      return { key: "errors.invalid_year" };
    case "duplicate_period":
      return { key: "pnl.duplicate_period" };
    case "hausgeld_sum_invalid":
      return { key: "pnl.hausgeld_sum_invalid" };
    case "password_too_short":
      return { key: "auth.password_too_short" };
    case "email_required":
      return { key: "auth.email_required" };
    case "weights_all_zero":
      return { key: "settings.weights_all_zero" };
    default:
      return { key: "errors.generic" };
  }
}
