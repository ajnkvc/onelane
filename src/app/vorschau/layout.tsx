import { notFound } from "next/navigation";
import { isProduction } from "@/lib/public-config";

/**
 * /vorschau/** — interne Design-Prototypen (Farb-/Konzept-Wettkämpfe).
 * IN PRODUKTION HART ABGESCHALTET (Sicherheits-Abnahme 2026-07-02): Die Prototypen
 * enthalten bewusst veraltete Sprache/Claims aus der Explorationsphase
 * (z. B. alte Quoten-Formulierungen) — noindex allein verhindert keinen
 * Direktaufruf. Lokal/Dev bleiben sie als Design-Archiv erreichbar.
 */
export default function VorschauLayout({ children }: { children: React.ReactNode }) {
  if (isProduction()) notFound();
  return children;
}
