"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withPortalActionGuards } from "@/modules/portal/identity";
import { istSchulRolle } from "@/modules/portal/rollen";
import {
  verfuegbarkeitAnlegen,
  verfuegbarkeitLoeschen,
} from "@/modules/portal/os-betrieb";

/**
 * os/kalender/actions.ts — Verfügbarkeits-Pflege V1 (Welle 2, Migration 0031).
 * ----------------------------------------------------------------------------
 * PFLICHT-Kette (Review-Auflage 1): withPortalActionGuards = Session →
 * PortalIdentity → MFA → Rollen-Prädikat (alle drei Schul-Rollen — WER welche
 * Zeilen pflegen darf, entscheiden Modul-SQL + RLS 0031: Manager schulweit,
 * Fahrlehrer:in NUR eigene Zeilen via app.own_instructor_ids). Ungültige oder
 * unberechtigte Eingaben sind stille No-ops (kein Fehler-Orakel — Muster
 * zeiterfassung/actions.ts). Termin-Anlage bleibt bewusst AUS (eigenes Modul
 * mit Storno-Regeln, P4/V1.1).
 */

const istSchulMitglied = (identity: Parameters<typeof istSchulRolle>[0]) =>
  istSchulRolle(identity, "inhaber", "verwaltung", "fahrlehrer");

/** FormData-String defensiv lesen (Files/fehlende Felder → leerer String). */
function feld(formData: FormData, name: string): string {
  const wert = formData.get(name);
  return typeof wert === "string" ? wert : "";
}

/** Tag-Kodierung des Formulars: `d:<ISO-Datum>` (konkret) oder `w:<0..6>` (wiederkehrend). */
const TAG_RE = /^(d:\d{4}-\d{2}-\d{2}|w:[0-6])$/;

const anlegenSchema = z.object({
  instructorId: z.string().uuid(),
  tag: z.string().regex(TAG_RE),
  von: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  bis: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  istBlockiert: z.boolean(),
});

export const verfuegbarkeitEintragen = withPortalActionGuards(
  async (identity, formData: FormData): Promise<void> => {
    const schule = identity.aktiveSchule;
    if (!schule) return;
    const parsed = anlegenSchema.safeParse({
      instructorId: feld(formData, "instructorId"),
      tag: feld(formData, "tag"),
      von: feld(formData, "von"),
      bis: feld(formData, "bis"),
      istBlockiert: feld(formData, "istBlockiert") === "1",
    });
    if (!parsed.success) return;

    const { tag } = parsed.data;
    await verfuegbarkeitAnlegen(schule.schoolId, {
      instructorId: parsed.data.instructorId,
      datum: tag.startsWith("d:") ? tag.slice(2) : null,
      wochentag: tag.startsWith("w:") ? Number(tag.slice(2)) : null,
      von: parsed.data.von,
      bis: parsed.data.bis,
      istBlockiert: parsed.data.istBlockiert,
    });
    revalidatePath("/app/os/kalender");
  },
  { require: istSchulMitglied },
);

export const verfuegbarkeitEntfernen = withPortalActionGuards(
  async (identity, formData: FormData): Promise<void> => {
    const schule = identity.aktiveSchule;
    if (!schule) return;
    const parsed = z.object({ slotId: z.string().uuid() }).safeParse({
      slotId: feld(formData, "slotId"),
    });
    if (!parsed.success) return;
    await verfuegbarkeitLoeschen(schule.schoolId, parsed.data.slotId);
    revalidatePath("/app/os/kalender");
  },
  { require: istSchulMitglied },
);
