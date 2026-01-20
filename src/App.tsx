import { useMemo, useRef, useState } from "react";
import {
  calcDiscountCents,
  centsToEuros,
  eurosToCents,
  formatEUR,
  parseMoneyToNumber,
} from "./lib/discount";

const QUICK = [10, 20, 30, 40, 50, 70];

export default function App() {
  const [priceInput, setPriceInput] = useState("");
  const [pct, setPct] = useState(30);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const parsed = useMemo(() => parseMoneyToNumber(priceInput), [priceInput]);

  const result = useMemo(() => {
    if (parsed == null || parsed < 0) return null;
    const originalCents = eurosToCents(parsed);
    return calcDiscountCents(originalCents, pct);
  }, [parsed, pct]);

  const finalText = result ? formatEUR(centsToEuros(result.finalCents)) : "—";
  const savedText = result ? formatEUR(centsToEuros(result.savedCents)) : "—";

  function showToast(msg: string) {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 900);
  }

  // Fallback “legacy” SIN focus en textarea (evita el salto en iOS)
  function legacyCopy(text: string): boolean {
    try {
      const selection = document.getSelection();
      const prevRange =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

      const span = document.createElement("span");
      span.textContent = text;
      span.style.position = "fixed";
      span.style.left = "-9999px";
      span.style.top = "0";
      span.style.whiteSpace = "pre";
      span.style.userSelect = "text";

      document.body.appendChild(span);

      const range = document.createRange();
      range.selectNodeContents(span);

      selection?.removeAllRanges();
      selection?.addRange(range);

      // Nota: a veces devuelve false aunque copie, pero suele funcionar
      const ok = document.execCommand("copy");

      selection?.removeAllRanges();
      if (prevRange && selection) selection.addRange(prevRange);

      span.remove();
      return ok;
    } catch {
      return false;
    }
  }

  async function copyFinal() {
    if (!result) return;
    const text = finalText;

    let ok = false;

    // Clipboard moderno (mejor en HTTPS / PWA instalada)
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = false;
    }

    // Fallback para local/http o Safari quisquilloso
    if (!ok) ok = legacyCopy(text);

    showToast(ok ? "Precio copiado" : "No se pudo copiar");
  }

  const showFormatHint = priceInput.trim() !== "" && parsed == null;

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-md px-4 py-6">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium text-zinc-700">
            Precio original
          </label>

          <div className="mt-2 flex items-center gap-2">
            <input
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-lg outline-none ring-0 focus:border-zinc-300 focus:outline-none focus:ring-4 focus:ring-zinc-100"
              aria-label="Precio original"
            />
            <span className="select-none text-zinc-500">€</span>
          </div>

          {showFormatHint && (
            <p className="mt-2 text-xs text-zinc-500">
              Usa coma o punto para decimales.
            </p>
          )}

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-700">
                Descuento
              </label>
              <div className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-800">
                {pct}%
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={90}
              step={1}
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              className="mt-3 w-full"
              aria-label="Porcentaje de descuento"
            />

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setPct((p) => Math.max(0, p - 1))}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 active:scale-[0.99]"
              >
                −1
              </button>
              <button
                onClick={() => setPct((p) => Math.max(0, p - 5))}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 active:scale-[0.99]"
              >
                −5
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setPct((p) => Math.min(90, p + 5))}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 active:scale-[0.99]"
              >
                +5
              </button>
              <button
                onClick={() => setPct((p) => Math.min(90, p + 1))}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 active:scale-[0.99]"
              >
                +1
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK.map((v) => (
                <button
                  key={v}
                  onClick={() => setPct(v)}
                  className={
                    "rounded-full px-3 py-1 text-sm font-medium " +
                    (pct === v
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200")
                  }
                >
                  {v}%
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-medium text-zinc-600">Precio final</div>
          <div className="mt-1 text-4xl font-semibold tracking-tight">
            {finalText}
          </div>

          <div className="mt-2 text-sm text-zinc-600">
            Ahorras:{" "}
            <span className="font-medium text-zinc-800">{savedText}</span>
          </div>

          <button
            onClick={copyFinal}
            disabled={!result}
            className="mt-4 w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            Copiar precio final
          </button>
        </section>

        {toastMsg && (
          <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
            <div className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
              {toastMsg}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
