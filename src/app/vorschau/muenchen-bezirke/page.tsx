import type { Metadata } from "next";
import Link from "next/link";
import MuenchenBezirkeMap from "@/components/vorschau/muenchen-bezirke-map";

/**
 * VORSCHAU — interaktive München-Stadtbezirks-Karte (Konzept für die Stadt-Seite).
 * Reiner Design-/IA-Test, `noindex`, nicht im Footer verlinkt.
 */
export const metadata: Metadata = {
  title: "Vorschau — München Stadtbezirke",
  robots: { index: false, follow: false },
};

export default function VorschauMuenchenBezirke() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[60rem] px-5 pt-6">
        <Link href="/vorschau" className="text-sm text-sky-700 underline-offset-2 hover:underline">← Vorschauen</Link>
      </div>
      <MuenchenBezirkeMap />
    </div>
  );
}
