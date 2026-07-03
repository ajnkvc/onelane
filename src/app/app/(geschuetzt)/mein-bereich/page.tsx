import { notFound, redirect } from "next/navigation";
import { getPortalIdentity } from "@/modules/portal/identity";
import { istStudent } from "@/modules/portal/rollen";

/**
 * /app/mein-bereich — Übersichts-Weiche (OS-P3, Paket D): Die Schüler-Übersicht
 * IST das rollenspezifische Dashboard unter /app (P2-Kontrakt, Nav-Eintrag
 * „Übersicht"). Diese Route existiert nur für direkt eingetippte URLs und
 * leitet Schüler dorthin um; alle anderen Rollen sehen — wie im gesamten
 * mein-bereich-Baum — 404 (kein Existenz-Orakel).
 */
export default async function Seite() {
  const identity = await getPortalIdentity();
  if (!identity || !istStudent(identity)) notFound();
  redirect("/app");
}
