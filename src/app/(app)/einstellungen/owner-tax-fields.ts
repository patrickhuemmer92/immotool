/**
 * Feldnamen-Schema für das Formular „Steuersätze je Eigentümer".
 *
 * Eigene Datei, weil `actions.ts` ein "use server"-Modul ist und dort nur
 * async Functions exportiert werden dürfen — Client-Form und Server-Action
 * teilen sich das Schema also hierüber.
 */

export const OWNER_TAX_FIELD_PREFIX = "owner_tax_rate:";

export function ownerTaxFieldName(ownerId: string): string {
  return `${OWNER_TAX_FIELD_PREFIX}${ownerId}`;
}
