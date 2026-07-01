/**
 * Flag — kleine, abgerundete Sprach-/Länderflagge in Landesfarben (statt „de"/„en").
 * Reines Inline-SVG (kein externes Asset, CSP-fest). `title`/`aria-label` mit
 * ausgeschriebenem Sprachnamen für Tooltip + Screenreader.
 */
const NAMES: Record<string, string> = {
  de: "Deutsch",
  en: "Englisch",
  tr: "Türkisch",
  it: "Italienisch",
  es: "Spanisch",
  fr: "Französisch",
  ru: "Russisch",
  el: "Griechisch",
};

function inner(code: string) {
  switch (code) {
    case "de":
      return (<><rect width="24" height="16" fill="#000" /><rect y="5.33" width="24" height="5.33" fill="#d00" /><rect y="10.66" width="24" height="5.34" fill="#ffce00" /></>);
    case "fr":
      return (<><rect width="8" height="16" fill="#0055a4" /><rect x="8" width="8" height="16" fill="#fff" /><rect x="16" width="8" height="16" fill="#ef4135" /></>);
    case "it":
      return (<><rect width="8" height="16" fill="#009246" /><rect x="8" width="8" height="16" fill="#fff" /><rect x="16" width="8" height="16" fill="#ce2b37" /></>);
    case "ru":
      return (<><rect width="24" height="5.33" fill="#fff" /><rect y="5.33" width="24" height="5.33" fill="#0039a6" /><rect y="10.66" width="24" height="5.34" fill="#d52b1e" /></>);
    case "es":
      return (<><rect width="24" height="16" fill="#aa151b" /><rect y="4" width="24" height="8" fill="#f1bf00" /></>);
    case "en":
      return (<><rect width="24" height="16" fill="#fff" /><rect x="10" width="4" height="16" fill="#ce1124" /><rect y="6" width="24" height="4" fill="#ce1124" /></>);
    case "tr":
      return (<><rect width="24" height="16" fill="#e30a17" /><circle cx="10" cy="8" r="4" fill="#fff" /><circle cx="11.6" cy="8" r="3.2" fill="#e30a17" /></>);
    case "el":
      return (<><rect width="24" height="16" fill="#0d5eaf" /><rect y="3.2" width="24" height="3.2" fill="#fff" /><rect y="9.6" width="24" height="3.2" fill="#fff" /><rect width="11" height="9.6" fill="#0d5eaf" /><rect x="4" width="3" height="9.6" fill="#fff" /><rect y="3.2" width="11" height="3.2" fill="#fff" /></>);
    default:
      return <rect width="24" height="16" fill="#94a3b8" />;
  }
}

export function Flag({ code }: { code: string }) {
  const name = NAMES[code] ?? code.toUpperCase();
  return (
    <span title={name} className="inline-block overflow-hidden rounded-[5px] ring-1 ring-black/10" style={{ width: 22, height: 15 }}>
      <svg viewBox="0 0 24 16" width="22" height="15" role="img" aria-label={name}>{inner(code)}</svg>
    </span>
  );
}
