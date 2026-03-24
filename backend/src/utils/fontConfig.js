import { StandardFonts } from "pdf-lib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ValidationError } from "./errors.js";

export const DEFAULT_FONT_KEY = "helveticaBold";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FONT_DIR = path.resolve(__dirname, "../fonts");

export const FONT_CONFIG = {
  helvetica: { label: "Helvetica", type: "standard", name: StandardFonts.Helvetica },
  helveticaBold: { label: "Helvetica Bold", type: "standard", name: StandardFonts.HelveticaBold },
  helveticaItalic: { label: "Helvetica Italic", type: "standard", name: StandardFonts.HelveticaOblique },
  helveticaBoldItalic: {
    label: "Helvetica Bold Italic",
    type: "standard",
    name: StandardFonts.HelveticaBoldOblique,
  },
  timesRoman: { label: "Times Roman", type: "standard", name: StandardFonts.TimesRoman },
  timesRomanBold: { label: "Times Roman Bold", type: "standard", name: StandardFonts.TimesRomanBold },
  timesRomanItalic: { label: "Times Roman Italic", type: "standard", name: StandardFonts.TimesRomanItalic },
  timesRomanBoldItalic: {
    label: "Times Roman Bold Italic",
    type: "standard",
    name: StandardFonts.TimesRomanBoldItalic,
  },
  courier: { label: "Courier", type: "standard", name: StandardFonts.Courier },
  courierBold: { label: "Courier Bold", type: "standard", name: StandardFonts.CourierBold },
  courierItalic: { label: "Courier Italic", type: "standard", name: StandardFonts.CourierOblique },
  courierBoldItalic: { label: "Courier Bold Italic", type: "standard", name: StandardFonts.CourierBoldOblique },
};

export function parseFontKey(value) {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (!FONT_CONFIG[normalized]) {
    return DEFAULT_FONT_KEY;
  }

  return normalized;
}

export function getFontSource(fontKey) {
  return FONT_CONFIG[fontKey] ?? FONT_CONFIG[DEFAULT_FONT_KEY];
}
