import path from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Estateably corporate design tokens. Mirrors the brand deck's palette:
 * cool slate background, deep navy structure, mint as the energy color.
 */
export const pdfColors = {
  bg: "#F5F7FA",
  text: "#0A1628",
  textMuted: "#7B8FA8",
  border: "#C8D4E3",
  accent: "#00E5C7",
  accentDark: "#1E3A5F",
  accentLight: "#4DD9C4",
  navy: "#152538",
  positive: "#00E5C7",
  negative: "#FF6B6B",
  bgSubtle: "#F5F7FA",
  // Legacy aliases — keep so existing imports compile.
  muted: "#7B8FA8",
};

export const pdfSpacing = {
  pagePadding: 40,
  sectionGap: 18,
  rowGap: 6,
};

export const pdfFontSizes = {
  pageTitle: 22,
  sectionTitle: 10,
  body: 10,
  small: 9,
  large: 18,
  mono: 9,
};

export const pdfFonts = {
  body: "Inter",
  bold: "Inter-Bold",
  semi: "Inter-SemiBold",
};

const FONT_DIR = path.join(process.cwd(), "src/components/pdf/fonts");

let registered = false;
function registerFonts() {
  if (registered) return;
  Font.register({
    family: pdfFonts.body,
    src: path.join(FONT_DIR, "Inter-Regular.ttf"),
  });
  Font.register({
    family: pdfFonts.semi,
    src: path.join(FONT_DIR, "Inter-SemiBold.ttf"),
  });
  Font.register({
    family: pdfFonts.bold,
    src: path.join(FONT_DIR, "Inter-Bold.ttf"),
  });
  registered = true;
}

registerFonts();
