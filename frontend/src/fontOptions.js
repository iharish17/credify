export const DEFAULT_FONT_KEY = "helveticaBold";

export const FONT_OPTIONS = [
  {
    value: "helvetica",
    label: "Helvetica",
    cssFamily: '"Helvetica Neue", Arial, sans-serif',
    cssWeight: 400,
    cssStyle: "normal",
  },
  {
    value: "helveticaBold",
    label: "Helvetica Bold",
    cssFamily: '"Helvetica Neue", Arial, sans-serif',
    cssWeight: 700,
    cssStyle: "normal",
  },
  {
    value: "helveticaItalic",
    label: "Helvetica Italic",
    cssFamily: '"Helvetica Neue", Arial, sans-serif',
    cssWeight: 400,
    cssStyle: "italic",
  },
  {
    value: "helveticaBoldItalic",
    label: "Helvetica Bold Italic",
    cssFamily: '"Helvetica Neue", Arial, sans-serif',
    cssWeight: 700,
    cssStyle: "italic",
  },
  {
    value: "timesRoman",
    label: "Times Roman",
    cssFamily: '"Times New Roman", Georgia, serif',
    cssWeight: 400,
    cssStyle: "normal",
  },
  {
    value: "timesRomanBold",
    label: "Times Roman Bold",
    cssFamily: '"Times New Roman", Georgia, serif',
    cssWeight: 700,
    cssStyle: "normal",
  },
  {
    value: "timesRomanItalic",
    label: "Times Roman Italic",
    cssFamily: '"Times New Roman", Georgia, serif',
    cssWeight: 400,
    cssStyle: "italic",
  },
  {
    value: "timesRomanBoldItalic",
    label: "Times Roman Bold Italic",
    cssFamily: '"Times New Roman", Georgia, serif',
    cssWeight: 700,
    cssStyle: "italic",
  },
  {
    value: "courier",
    label: "Courier",
    cssFamily: '"Courier New", monospace',
    cssWeight: 400,
    cssStyle: "normal",
  },
  {
    value: "courierBold",
    label: "Courier Bold",
    cssFamily: '"Courier New", monospace',
    cssWeight: 700,
    cssStyle: "normal",
  },
  {
    value: "courierItalic",
    label: "Courier Italic",
    cssFamily: '"Courier New", monospace',
    cssWeight: 400,
    cssStyle: "italic",
  },
  {
    value: "courierBoldItalic",
    label: "Courier Bold Italic",
    cssFamily: '"Courier New", monospace',
    cssWeight: 700,
    cssStyle: "italic",
  },
];

export function getFontOption(fontKey) {
  return (
    FONT_OPTIONS.find((option) => option.value === fontKey) ??
    FONT_OPTIONS.find((option) => option.value === DEFAULT_FONT_KEY)
  );
}
