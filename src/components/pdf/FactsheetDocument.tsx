import { Document } from "@react-pdf/renderer";
import type { PdfPropertyData } from "@/lib/pdf/data";
import type { PdfLocale } from "@/lib/pdf/translate";
import { FactsheetPage } from "./FactsheetPage";

/**
 * Standalone single-page property Factsheet PDF. Delegates the page layout
 * to FactsheetPage so the Portfolio-Factbook can re-use the exact same
 * page when it appends per-property factsheets.
 */
export function FactsheetDocument({
  data,
  locale,
}: {
  data: PdfPropertyData;
  locale: PdfLocale;
}) {
  return (
    <Document title={`Factsheet ${data.property.address}`}>
      <FactsheetPage data={data} locale={locale} />
    </Document>
  );
}
