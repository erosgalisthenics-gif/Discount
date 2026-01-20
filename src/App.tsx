import { useEffect, useMemo, useRef, useState } from "react";
import {
  calcDiscountCents,
  centsToEuros,
  eurosToCents,
  formatEUR,
  parseMoneyToNumber,
} from "./lib/discount";

const QUICK = [10, 20, 30, 40, 50, 60, 70, 80];

function WheelPercent({
  value,
  min = 0,
  max = 90,
  step = 10,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const ITEM_H = 44;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastValRef = useRef<number>(value);

  // --- Sonido tipo “tick” (similar a rueda, no es el sonido propietario de Apple) ---
  const audioRef = useRef<AudioContext | null>(null);

  function ensureAudio() {
    const AC = (window.AudioContext ||
      (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AC) return;

    if (!audioRef.current) audioRef.current = new AC();
    if (audioRef.current.state === "suspended") {
      audioRef.current.resume().catch(() => {});
    }
  }

  function playTick() {
    const ctx = audioRef.current;
    if (!ctx || ctx.state !== "running") return;

    const t0 = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Un “click” corto tipo rueda/seguro
    osc.type = "square";
    osc.frequency.setValueAtTime(1200, t0);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.14, t0 + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + 0.04);
  }

  // --- Valores (de 10 en 10) ---
  const baseValues = useMemo(() => {
    const out: number[] = [];
    for (let v = min; v <= max; v += step) out.push(v);
    return out;
  }, [min, max, step]);

  // Repetimos 3 veces para simular "infinito"
  const items = useMemo(
    () => [...baseValues, ...baseValues, ...baseValues],
    [baseValues]
  );
  const baseLen = baseValues.length;
  const midStartIndex = baseLen;

  // “Snap” del valor al múltiplo de step
  const snappedValue = useMemo(() => {
    const clamped = Math.min(max, Math.max(min, value));
    const snapped = Math.round((clamped - min) / step) * step + min;
    return Math.min(max, Math.max(min, snapped));
  }, [value, min, max, step]);

  // Scroll al valor actual en el bloque central
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const offset = Math.round((snappedValue - min) / step);
    const targetIndex = midStartIndex + offset;
    const targetTop = targetIndex * ITEM_H;

    if (Math.abs(el.scrollTop - targetTop) > ITEM_H) {
      el.scrollTop = targetTop;
    }
  }, [snappedValue, min, step, ITEM_H, midStartIndex]);

  function maybeVibrate() {
    // En iOS normalmente NO vibra en web, en Android sí.
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(10);
      } catch {
        // ignore
      }
    }
  }

  function normalizeToMiddle(el: HTMLDivElement) {
    const idx = Math.round(el.scrollTop / ITEM_H);
    if (idx < baseLen) el.scrollTop += baseLen * ITEM_H;
    else if (idx >= baseLen * 2) el.scrollTop -= baseLen * ITEM_H;
  }

  function onScroll() {
    const el = containerRef.current;
    if (!el) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      normalizeToMiddle(el);

      const idx = Math.round(el.scrollTop / ITEM_H);
      const next = items[idx];

      if (next != null && next !== lastValRef.current) {
        lastValRef.current = next;
        onChange(next);
        maybeVibrate();
        playTick();
      }
    });
  }

  // Solo 3 valores visibles
  const visibleCount = 3;
  const height = visibleCount * ITEM_H;
  const pad = (height - ITEM_H) / 2;

  return (
    <div className="relative" onPointerDown={ensureAudio}>
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="w-full overflow-y-scroll rounded-2xl border border-zinc-200 bg-white shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          height,
          scrollSnapType: "y mandatory",
          paddingTop: pad,
          paddingBottom: pad,
        }}
        aria-label="Selector de porcentaje"
      >
        {items.map((v, i) => {
          const isActive = v === snappedValue;
          return (
            <div
              key={`${v}-${i}`}
              className={
                "flex items-center justify-center text-lg font-semibold " +
                (isActive ? "text-zinc-900" : "text-zinc-400")
              }
              style={{
                height: ITEM_H,
                scrollSnapAlign: "center",
              }}
            >
              {v}%
            </div>
          );
        })}
      </div>

      {/* Banda central (selección) */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-3">
        <div className="h-[44px] rounded-xl border border-zinc-200 bg-zinc-50/60" />
      </div>

      {/* Fade superior/inferior tipo iOS */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-t-2xl bg-gradient-to-b from-white to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-2xl bg-gradient-to-t from-white to-transparent" />
    </div>
  );
}

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

    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = false;
    }

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
             luega usar coma o punto para decimales.
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

            <div className="mt-3">
              <WheelPercent
                value={pct}
                min={0}
                max={90}
                step={10}
                onChange={setPct}
              />
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              {QUICK.map((v) => (
                <button
                  key={v}
                  onClick={() => setPct(v)}
                  className={
                    "h-10 rounded-xl text-sm font-semibold transition active:scale-[0.99] " +
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
          <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]">
            <div className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
              {toastMsg}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
