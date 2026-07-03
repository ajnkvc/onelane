"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withPortalActionGuards } from "@/modules/portal/identity";
import { istSchulRolle } from "@/modules/portal/rollen";
import {
  ZEIT_KATEGORIEN,
  beendeZeitEintrag,
  starteZeitEintrag,
} from "@/modules/portal/os-betrieb";

/**
 * os/zeiterfassung/actions.ts — Ein-/Ausstempeln (OS-P3 Paket B).
 * ----------------------------------------------------------------------------
 * PFLICHT-Kette (Review-Auflage 1): withPortalActionGuards = Session →
 * PortalIdentity → MFA → Rollen-Prädikat (alle drei Schul-Rollen — identisch
 * zum Seiten-Gate). Die DB-Arbeit liegt in modules/portal/os-betrieb (RLS:
 * Mitglied schreibt NUR eigene Einträge der eigenen Schule, 0029); ungültige
 * Eingaben sind stille No-ops (kein Fehler-Orakel, Muster shell-actions.ts).
 */

const istSchulMitglied = (identity: Parameters<typeof istSchulRolle>[0]) =>
  istSchulRolle(identity, "inhaber", "verwaltung", "fahrlehrer");

const einstempelnSchema = z.object({
  kategorie: z.enum(ZEIT_KATEGORIEN),
  // DB-Cap: 1000 Bytes (0029) — 250 Zeichen sind auch bei 4-Byte-UTF-8 sicher.
  notiz: z
    .string()
    .trim()
    .max(250)
    .transform((wert) => (wert === "" ? null : wert)),
});

/** FormData-String defensiv lesen (Files/fehlende Felder → leerer String). */
function feld(formData: FormData, name: string): string {
  const wert = formData.get(name);
  return typeof wert === "string" ? wert : "";
}

export const einstempeln = withPortalActionGuards(
  async (identity, formData: FormData): Promise<void> => {
    const schule = identity.aktiveSchule;
    if (!schule) return;
    const parsed = einstempelnSchema.safeParse({
      kategorie: feld(formData, "kategorie"),
      notiz: feld(formData, "notiz"),
    });
    if (!parsed.success) return;

    await starteZeitEintrag(
      schule.schoolId,
      identity.user.id,
      parsed.data.kategorie,
      parsed.data.notiz,
    );
    revalidatePath("/app/os/zeiterfassung");
  },
  { require: istSchulMitglied },
);

// Kein FormData-Parameter nötig: () => Promise<void> ist form-action-kompatibel
// (weniger Parameter), die Guard-Kette bleibt identisch.
export const ausstempeln = withPortalActionGuards(
  async (identity): Promise<void> => {
    const schule = identity.aktiveSchule;
    if (!schule) return;
    await beendeZeitEintrag(schule.schoolId, identity.user.id);
    revalidatePath("/app/os/zeiterfassung");
  },
  { require: istSchulMitglied },
);
