import "server-only";

import { sql } from "drizzle-orm";
import { z } from "zod";
import { withCurrentUserContext } from "@/server/dal";

/**
 * modules/portal/abo.ts — Datenpfad der Tarif-/Abo-Seite V1 (Welle 2).
 * ============================================================================
 *  - JEDE Query läuft über withCurrentUserContext → RLS ist die Wahrheit:
 *    school_subscriptions liest seit 0031 NUR der Schul-Manager (+admin),
 *    Spalten OHNE stripe_subscription_ref; subscription_plans lesen
 *    Authentifizierte (0029).
 *  - FAIL-SOFT: Fehler → null.
 *  - MONATS-VORSCHAU = neutrale ZUSAMMENSETZUNG (Grundgebühr + Seats ×
 *    Seat-Preis, Aktions-HINWEIS separat) — KEINE Rechnung, KEIN Checkout
 *    (Stripe-Anbindung ist eine spätere Ausbaustufe; CTA ist eine ehrliche
 *    Frühzugangs-Anfrage per Mail).
 *  - SEAT-Zählung V1 = aktive Fahrlehrer-Profile der Schule (instructors,
 *    aktiv = true) — ehrlich als „derzeit" gekennzeichnet; die vertragliche
 *    Seat-Zahl (anzahl_lizenzen) wird daneben gezeigt, wenn ein Abo existiert.
 */

async function failSoft<T>(name: string, work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (fehler) {
    console.error(
      `[portal-abo] ${name} fehlgeschlagen:`,
      fehler instanceof Error ? fehler.message : "unbekannter Fehler",
    );
    return null;
  }
}

type Rows = Array<Record<string, unknown>>;

const planSchema = z.object({
  code: z.string().nullable(),
  name: z.string(),
  preis_monat_netto_cent: z.coerce.number().int().min(0).nullable(),
  seat_preis_monat_netto_cent: z.coerce.number().int().min(0).nullable(),
  aktion_preis_monat_netto_cent: z.coerce.number().int().min(0).nullable(),
  aktion_monate: z.coerce.number().int().min(1).nullable(),
});
export type AboPlan = z.infer<typeof planSchema>;

const aboSchema = z.object({
  status: z.enum(["active", "paused", "cancelled"]),
  anzahl_lizenzen: z.coerce.number().int().min(0),
  start_datum: z.string().nullable(),
});

export interface AboUebersicht {
  /** Aktueller Plan: gebuchter Plan ODER ehrlicher start-Fallback (kein Abo). */
  plan: AboPlan;
  /** true, wenn ein school_subscriptions-Datensatz existiert. */
  hatAbo: boolean;
  aboStatus: "active" | "paused" | "cancelled" | null;
  vertraglicheSeats: number | null;
  startDatum: string | null;
  /** Aktive Fahrlehrer-Profile der Schule (derzeitige Seat-Basis). */
  fahrlehrerAktiv: number;
  /** Alle aktiven saas-Pläne (Vergleich/Upgrade-Hinweis). */
  katalog: AboPlan[];
}

export async function getAboUebersicht(schoolId: string): Promise<AboUebersicht | null> {
  return failSoft("abo-uebersicht", async () =>
    withCurrentUserContext(async (tx) => {
      const abo = (await tx.execute(sql`
        select s.status, s.anzahl_lizenzen,
               to_char(s.start_datum, 'DD.MM.YYYY') as start_datum,
               p.code, p.name, p.preis_monat_netto_cent, p.seat_preis_monat_netto_cent,
               p.aktion_preis_monat_netto_cent, p.aktion_monate
          from public.school_subscriptions s
          join public.subscription_plans p on p.id = s.plan_id
         where s.school_id = ${schoolId}
           and s.status in ('active', 'paused')
         order by s.created_at desc
         limit 1
      `)) as unknown as Rows;

      const katalogRows = (await tx.execute(sql`
        select code, name, preis_monat_netto_cent, seat_preis_monat_netto_cent,
               aktion_preis_monat_netto_cent, aktion_monate
          from public.subscription_plans
         where aktiv = true and typ = 'saas' and code is not null
         order by coalesce(preis_monat_netto_cent, 0) asc
         limit 10
      `)) as unknown as Rows;
      const katalog = katalogRows.map((r) => planSchema.parse(r));

      const fahrlehrer = (await tx.execute(sql`
        select count(*)::int as anzahl
          from public.instructors
         where school_id = ${schoolId} and aktiv = true
      `)) as unknown as Rows;
      const fahrlehrerAktiv = z.coerce.number().int().min(0).parse(fahrlehrer[0]?.anzahl ?? 0);

      if (abo.length === 0) {
        // Kein Abo → ehrlicher Fallback auf den Free-Tier aus dem Katalog.
        const start =
          katalog.find((p) => p.code === "start") ??
          ({
            code: "start",
            name: "onelane start",
            preis_monat_netto_cent: 0,
            seat_preis_monat_netto_cent: null,
            aktion_preis_monat_netto_cent: null,
            aktion_monate: null,
          } satisfies AboPlan);
        return {
          plan: start,
          hatAbo: false,
          aboStatus: null,
          vertraglicheSeats: null,
          startDatum: null,
          fahrlehrerAktiv,
          katalog,
        };
      }

      const zeile = abo[0];
      const vertrag = aboSchema.parse(zeile);
      return {
        plan: planSchema.parse(zeile),
        hatAbo: true,
        aboStatus: vertrag.status,
        vertraglicheSeats: vertrag.anzahl_lizenzen,
        startDatum: vertrag.start_datum,
        fahrlehrerAktiv,
        katalog,
      };
    }),
  );
}

/** Neutrale Monats-Zusammensetzung (Cent): Grundgebühr + Seats × Seat-Preis. */
export function baueMonatsVorschau(
  plan: AboPlan,
  seats: number,
): { grundCent: number; seatSummeCent: number; gesamtCent: number; aktionGesamtCent: number | null } {
  const grundCent = plan.preis_monat_netto_cent ?? 0;
  const seatSummeCent = (plan.seat_preis_monat_netto_cent ?? 0) * Math.max(0, seats);
  const gesamtCent = grundCent + seatSummeCent;
  const aktionGesamtCent =
    plan.aktion_preis_monat_netto_cent !== null
      ? plan.aktion_preis_monat_netto_cent + seatSummeCent
      : null;
  return { grundCent, seatSummeCent, gesamtCent, aktionGesamtCent };
}
