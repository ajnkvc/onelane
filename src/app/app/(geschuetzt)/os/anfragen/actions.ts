"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withPortalActionGuards } from "@/modules/portal/identity";
import { istSchulManager } from "@/modules/portal/rollen";
import { anfrageStatusSetzen, anfrageStatusSchema } from "@/modules/portal/os-kern";

/**
 * os/anfragen/actions.ts — Status-Pflege der Anfragen (OS-P3, Paket A).
 * ----------------------------------------------------------------------------
 * Volle Guard-Kette via withPortalActionGuards (Session → Identity → MFA →
 * istSchulManager, Review-Auflage 1). SCHUL-BINDUNG: es wird ausschließlich die
 * AKTIVE Schule der geprüften Identität an das Modul gereicht — das UPDATE in
 * os-kern.ts bindet school_id zusätzlich im WHERE, RLS (0022) bleibt letzte
 * Linie. Kaputte/fremde Eingaben = stiller No-op (shell-actions-Muster).
 */
const eingabeSchema = z.object({
  leadId: z.string().uuid(),
  status: anfrageStatusSchema,
});

export const anfrageStatusAktualisieren = withPortalActionGuards(
  async (identity, formData: FormData): Promise<void> => {
    const parsed = eingabeSchema.safeParse({
      leadId: formData.get("leadId"),
      status: formData.get("status"),
    });
    if (!parsed.success || !identity.aktiveSchule) return;
    const ok = await anfrageStatusSetzen(
      identity.aktiveSchule.schoolId,
      parsed.data.leadId,
      parsed.data.status,
    );
    if (ok) revalidatePath("/app/os/anfragen");
  },
  { require: istSchulManager },
);
