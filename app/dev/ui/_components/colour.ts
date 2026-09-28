export type Rgb = [number, number, number];

let context: CanvasRenderingContext2D | null = null;

// Resolves any computed CSS colour (rgb(), oklch(), color-mix()...) to sRGB
// bytes by painting one pixel, so the checks measure what is really rendered.
export function toRgb(cssColour: string): Rgb {
  context ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!context) return [0, 0, 0];
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = cssColour;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

export function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// WCAG 2.x contrast ratio, 1 to 21.
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
