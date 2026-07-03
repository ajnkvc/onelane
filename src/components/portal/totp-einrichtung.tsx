"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { totpEinrichtungStarten, totpBestaetigen } from "@/modules/portal/actions";

/**
 * totp-einrichtung.tsx — Client-Insel des TOTP-Flows (Supabase-Pfad).
 * ----------------------------------------------------------------------------
 * Beide Modi laufen über SERVER-Actions (Tokens/Cookies bleiben httpOnly):
 *  - 'einrichten': Start-Aktion räumt unverifizierte Faktoren auf, enrollt und
 *    liefert QR (SVG-Data-URI) + Secret; Code-Eingabe → challenge+verify.
 *  - 'challenge': bestehender verifizierter Faktor; Code → challengeAndVerify.
 * Erfolg hebt die Session serverseitig auf aal2 → weiter zu /app.
 */
interface Props {
  modus: "einrichten" | "challenge";
  factorId: string | null;
}

export function TotpEinrichtung({ modus, factorId }: Props) {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, startTransition] = useTransition();
  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    qrDataUri: string | null;
    secret: string | null;
  } | null>(null);

  const aktiverFactorId = enrollment?.factorId ?? factorId;

  function starten() {
    setFehler(null);
    startTransition(async () => {
      const r = await totpEinrichtungStarten();
      if (!r.ok || !r.factorId) {
        setFehler("Einrichtung derzeit nicht möglich. Bitte später erneut versuchen.");
        return;
      }
      setEnrollment({
        factorId: r.factorId,
        qrDataUri: r.qrDataUri ?? null,
        secret: r.secret ?? null,
      });
    });
  }

  function bestaetigen(formData: FormData) {
    setFehler(null);
    const code = String(formData.get("code") ?? "").trim();
    const id = aktiverFactorId;
    if (!id) return;
    startTransition(async () => {
      const r = await totpBestaetigen({ factorId: id, code });
      if (!r.ok) {
        setFehler("Der Code war nicht gültig. Bitte neuen Code eingeben.");
        return;
      }
      router.push("/app");
      router.refresh();
    });
  }

  return (
    <div className="mt-8 grid gap-6">
      {modus === "einrichten" && !enrollment ? (
        <div className="grid gap-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Richte eine Authenticator-App (z. B. auf deinem Handy) ein. Im
            nächsten Schritt erscheint ein QR-Code zum Scannen.
          </p>
          <button
            type="button"
            onClick={starten}
            disabled={laeuft}
            className="min-h-11 rounded-full bg-accent px-5 font-semibold text-accent-foreground disabled:opacity-60"
          >
            {laeuft ? "Wird vorbereitet …" : "Einrichtung starten"}
          </button>
        </div>
      ) : null}

      {enrollment ? (
        <div className="grid gap-3">
          {enrollment.qrDataUri ? (
            // eslint-disable-next-line @next/next/no-img-element -- Data-URI-QR (kein next/image-Fall)
            <img
              src={enrollment.qrDataUri}
              alt="QR-Code für die Authenticator-App"
              width={176}
              height={176}
              className="rounded-md border border-border bg-white p-2"
            />
          ) : null}
          {enrollment.secret ? (
            <p className="text-xs text-muted-foreground">
              Manueller Schlüssel: <code className="break-all">{enrollment.secret}</code>
            </p>
          ) : null}
        </div>
      ) : null}

      {aktiverFactorId ? (
        <form action={bestaetigen} className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">6-stelliger Code aus der App</span>
            <input
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoComplete="one-time-code"
              className="min-h-11 w-40 rounded-md border border-border bg-card px-3 font-mono tracking-[0.3em]"
            />
          </label>
          <button
            type="submit"
            disabled={laeuft}
            className="min-h-11 w-fit rounded-full bg-accent px-5 font-semibold text-accent-foreground disabled:opacity-60"
          >
            {laeuft ? "Wird geprüft …" : "Bestätigen"}
          </button>
        </form>
      ) : null}

      {fehler ? (
        <p className="rounded-md border border-border bg-muted px-4 py-3 text-sm">{fehler}</p>
      ) : null}
    </div>
  );
}
