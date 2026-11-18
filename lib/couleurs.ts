/**
 * Texte clair ou foncé selon la luminance du fond : certaines activités sont
 * très sombres (Anesthésie #7030A0) et le texte foncé y était illisible.
 */
export function texteSur(fond: string): string {
  const hex = fond.replace("#", "");
  if (hex.length !== 6) return "#0f172a";
  const canal = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(canal(0)) + 0.7152 * lin(canal(2)) + 0.0722 * lin(canal(4));
  return L > 0.45 ? "#0f172a" : "#ffffff";
}
