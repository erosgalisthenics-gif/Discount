export function parseMoneyToNumber(input: string): number | null {
  const raw = input.trim().replace(/\s/g, "").replace("€", "");
  if (!raw) return null;

  // Si hay coma y punto: asumimos miles con punto y decimal con coma (formato ES)
  if (raw.includes(",") && raw.includes(".")) {
    const normalized = raw.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  // Si solo hay coma: decimal con coma
  if (raw.includes(",")) {
    const n = Number(raw.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  // Si solo hay punto o nada: decimal con punto
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

export function centsToEuros(cents: number): number {
  return cents / 100;
}

export function calcDiscountCents(originalCents: number, discountPct: number) {
  const pct = Math.min(100, Math.max(0, Math.round(discountPct)));
  // redondeo al centimo (half-up aproximado)
  const finalCents = Math.round((originalCents * (100 - pct)) / 100);
  const savedCents = originalCents - finalCents;
  return { pct, finalCents, savedCents };
}

export function formatEUR(euros: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(euros);
}
