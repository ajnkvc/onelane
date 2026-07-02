import Link from "next/link";

/**
 * TrustBadge — Wortbild des Programms „onelane trust".
 * ----------------------------------------------------------------------------
 * Kompaktes Marken-Badge in Wortbild-Optik analog zur Wordmark (reine
 * Typografie, kein Asset, CSP-fest, server-tauglich): „onelane" in Foreground,
 * „trust" abgesetzt als Pill in Primary — alles klein geschrieben, rounded-full,
 * ruhig und hochwertig.
 *
 * VERLINKUNG: Standardmäßig verlinkt das Badge auf die Erklärseite /trust
 * (sichtbarer Fokus-Ring, aria-label). `href={null}` rendert die reine
 * Wortbild-Optik ohne Link — z. B. auf /trust selbst (kein Selbst-Link).
 *
 * RECHTSLEITPLANKE: Dies ist ein MARKEN-Versprechen („wir bleiben an deiner
 * Seite"), KEIN Gütesiegel. Deshalb bewusst KEINE Siegel-/Schild-/Haken-Optik
 * und keine Begriffe wie „geprüft/zertifiziert/Siegel" — weder hier noch an
 * den Einsatzstellen ergänzen.
 */
const SIZES = {
  sm: { wrap: "gap-1.5 px-3 py-1 text-sm", tag: "px-2 py-0.5 text-[11px]" },
  md: { wrap: "gap-2 px-4 py-1.5 text-base", tag: "px-2.5 py-1 text-xs" },
} as const;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function TrustBadge({
  size = "md",
  href = "/trust",
  className = "",
}: {
  size?: "sm" | "md";
  /** Linkziel (Default: /trust). `null` = ohne Link (z. B. auf /trust selbst). */
  href?: string | null;
  className?: string;
}) {
  const s = SIZES[size];
  const badge = (
    <span
      className={`inline-flex w-fit items-center rounded-full border border-border bg-card font-extrabold lowercase tracking-tight text-foreground ${
        href ? "transition-colors duration-[var(--motion-duration-fast)] ease-[var(--motion-ease)] hover:border-brand-sky/60" : ""
      } ${s.wrap} ${className}`}
    >
      onelane
      <span className={`rounded-full bg-primary/10 font-semibold text-primary ${s.tag}`}>
        trust
      </span>
    </span>
  );
  if (!href) return badge;
  return (
    <Link
      href={href}
      aria-label="Mehr über onelane trust"
      className={`inline-flex w-fit rounded-full ${focusRing}`}
    >
      {badge}
    </Link>
  );
}
