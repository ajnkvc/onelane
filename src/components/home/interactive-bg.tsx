"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * InteractiveBg — gebündelte Client-Insel (kein Inline-Script → CSP-konform).
 * Setzt beim Mausbewegen die CSS-Variablen `--mx`/`--my` (Bereich ~ -1..1) auf
 * dem Container; darin liegende Layer können sie via `calc(var(--mx) * Npx)`
 * für einen sanften Parallax-Effekt nutzen. Reduced-motion: deaktiviert.
 */
export function InteractiveBg({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let tx = 0;
    let ty = 0;
    const apply = () => {
      raf = 0;
      el.style.setProperty("--mx", tx.toFixed(3));
      el.style.setProperty("--my", ty.toFixed(3));
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className={className} style={{ "--mx": 0, "--my": 0 } as CSSProperties}>
      {children}
    </div>
  );
}
