"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withPortalActionGuards } from "@/modules/portal/identity";
import { istSchulManager } from "@/modules/portal/rollen";
import { bewerbungStatusSetzen, anfrageStatusSchema } from "@/modules/portal/os-kern";

/**
 * os/bewerbungen/actions.ts — Status-Pflege der Bewerbungen (OS-P3, Paket A).
 * ----------------------------------------------------------------------------
 * Guard-Kette wie os/anfragen (Session → Identity → MFA → istSchulManager).
 * UPDATE-Grant `status` existiert seit 0023 (in 0025 erneut vergeben) — der
 * Wechsel bindet die aktive Schule über school_jobs im WHERE (os-kern.ts);
 * Vermittlungs-Zeilen (Quereinsteiger) sind dort SQL-seitig ausgenommen.
 */
const eingabeSchema = z.object({
  bewerbungId: z.string().uuid(),
  status: anfrageStatusSchema,
});

export const bewerbungStatusAktualisieren = withPortalActionGuards(
  async (identity, formData: FormData): Promise<void> => {
    const parsed = eingabeSchema.safeParse({
      bewerbungId: formData.get("bewerbungId"),
      status: formData.get("status"),
    });
    if (!parsed.success || !identity.aktiveSchule) return;
    const ok = await bewerbungStatusSetzen(
      identity.aktiveSchule.schoolId,
      parsed.data.bewerbungId,
      parsed.data.status,
    );
    if (ok) revalidatePath("/app/os/bewerbungen");
  },
  { require: istSchulManager },
);
