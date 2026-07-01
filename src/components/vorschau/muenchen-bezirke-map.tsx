"use client";

import { useMemo, useState } from "react";

/**
 * VORSCHAU — interaktive 3D-Stadtkarte München (25 Stadtbezirke, echte Grenzen).
 * Klick auf Bezirk → sanftes Reinzoomen in die Bezirks-Übersicht mit Fahrschul-Pins;
 * „Zurück zu München" zoomt wieder raus. Grenzdaten: Open Data München (GeoJSON),
 * projiziert/gerundet. Farben + Motion = Konzept; Pins sind Demo-Positionen.
 */

type District = { nr: number; name: string; d: string; cx: number; cy: number };

const MAP: { W: number; H: number; districts: District[] } = {"W":680,"H":532,"districts":[{"nr":1,"name":"Altstadt-Lehel","d":"M383 307L397 297L404 299L405 295L414 297L417 287L417 280L423 272L429 262L433 275L441 281L438 286L435 301L433 306L427 313L420 328L412 323L399 324L392 330L387 329L381 316L383 307Z","cx":413,"cy":303},{"nr":2,"name":"Ludwigsvorstadt-Isarvorstadt","d":"M420 328L415 337L406 340L389 354L377 365L344 343L350 320L354 315L354 309L352 300L356 298L374 303L383 307L381 316L387 329L392 330L399 324L412 323L420 328Z","cx":375,"cy":332},{"nr":3,"name":"Maxvorstadt","d":"M365 265L373 259L391 262L407 267L413 268L411 273L418 275L423 272L417 280L417 287L414 297L405 295L404 299L397 297L383 307L374 303L356 298L352 300L335 298L354 274L365 265Z","cx":381,"cy":283},{"nr":4,"name":"Schwabing-West","d":"M365 265L354 251L360 248L360 236L363 232L370 229L375 230L373 214L370 209L384 209L396 204L418 205L411 209L413 225L413 233L407 233L409 249L407 267L391 262L373 259L365 265Z","cx":388,"cy":236},{"nr":5,"name":"Au-Haidhausen","d":"M389 354L406 340L415 337L420 328L427 313L433 306L435 301L456 308L467 311L479 311L477 319L467 327L460 337L450 347L446 348L441 353L403 363L389 354Z","cx":436,"cy":333},{"nr":6,"name":"Sendling","d":"M377 365L374 370L375 388L372 395L364 401L359 397L356 400L344 399L338 403L330 404L329 369L333 347L332 341L329 333L337 338L344 343L377 365Z","cx":350,"cy":374},{"nr":7,"name":"Sendling-Westpark","d":"M330 404L325 402L299 405L296 401L287 409L281 410L276 416L268 406L269 398L270 344L281 346L283 342L296 332L301 327L312 316L329 333L332 341L333 347L329 369L330 404Z","cx":301,"cy":368},{"nr":8,"name":"Schwanthalerhöhe","d":"M312 316L313 305L327 298L335 298L352 300L354 309L354 315L350 320L344 343L337 338L329 333L312 316Z","cx":334,"cy":316},{"nr":9,"name":"Neuhausen-Nymphenburg","d":"M327 298L318 298L300 296L288 297L275 295L259 292L246 286L237 276L234 271L232 259L232 253L235 245L245 245L250 237L258 238L263 232L283 232L284 226L295 232L321 227L322 232L333 230L351 224L354 229L363 232L360 236L360 248L354 251L365 265L354 274L335 298L327 298Z","cx":299,"cy":262},{"nr":10,"name":"Moosach","d":"M333 230L322 232L321 227L295 232L284 226L283 232L263 232L258 238L250 237L248 219L245 212L247 200L248 173L246 159L243 157L230 152L221 146L212 135L232 144L244 148L255 148L277 155L286 162L326 176L339 175L336 198L337 210L334 221L333 230Z","cx":285,"cy":194},{"nr":11,"name":"Milbertshofen-Am Hart","d":"M381 72L412 68L420 79L422 86L422 109L418 142L427 141L424 163L415 164L418 205L396 204L384 209L370 209L373 214L375 230L370 229L363 232L354 229L351 224L333 230L334 221L337 210L336 198L339 175L353 171L383 170L376 100L381 84L378 78L381 72Z","cx":387,"cy":155},{"nr":12,"name":"Schwabing-Freimann","d":"M418 205L415 164L424 163L427 141L418 142L422 109L447 109L447 100L453 98L455 94L465 94L459 76L467 76L469 70L484 71L488 67L515 76L513 79L514 87L521 92L534 99L534 112L530 119L518 129L513 137L512 149L502 177L496 187L500 190L495 200L491 197L441 281L433 275L429 262L423 272L418 275L411 273L413 268L407 267L409 249L407 233L413 233L413 225L411 209L418 205Z","cx":463,"cy":165},{"nr":13,"name":"Bogenhausen","d":"M477 319L479 311L467 311L456 308L435 301L438 286L441 281L491 197L495 200L494 206L500 204L511 208L509 213L517 216L526 216L535 212L561 209L554 200L555 191L589 195L599 198L609 192L615 199L606 204L616 214L611 224L598 221L599 226L597 232L585 251L577 261L571 257L564 255L564 274L560 291L558 304L561 305L540 322L539 318L517 316L508 316L503 319L497 317L487 317L477 319Z","cx":522,"cy":257},{"nr":14,"name":"Berg am Laim","d":"M540 322L545 337L535 361L533 362L527 375L522 373L512 366L487 360L463 357L455 357L446 348L450 347L460 337L467 327L477 319L487 317L497 317L503 319L508 316L517 316L539 318L540 322Z","cx":502,"cy":341},{"nr":15,"name":"Trudering-Riem","d":"M522 373L527 375L533 362L535 361L545 337L540 322L561 305L558 304L560 291L564 274L564 255L571 257L577 261L587 270L584 295L594 293L640 284L647 291L646 297L641 301L647 308L655 312L660 308L664 314L658 318L660 321L650 325L649 334L652 338L648 348L644 352L631 356L619 345L613 351L619 356L614 362L642 372L639 375L649 384L646 400L640 406L613 421L603 427L600 431L594 422L588 421L570 413L561 411L564 401L553 391L542 384L533 383L522 373Z","cx":594,"cy":348},{"nr":16,"name":"Ramersdorf-Perlach","d":"M600 431L592 435L592 444L589 456L594 463L597 474L576 470L565 472L528 462L503 455L503 451L486 447L487 445L473 444L471 428L460 428L453 424L444 404L437 380L436 371L438 358L441 353L446 348L455 357L463 357L487 360L512 366L522 373L533 383L542 384L553 391L564 401L561 411L570 413L588 421L594 422L600 431Z","cx":514,"cy":414},{"nr":17,"name":"Obergiesing-Fasangarten","d":"M441 353L438 358L436 371L437 380L444 404L453 424L460 428L471 428L473 444L465 448L456 449L450 453L447 447L440 451L431 453L429 447L424 431L418 431L423 428L418 414L411 417L412 401L405 385L397 381L403 370L403 363L441 353Z","cx":432,"cy":406},{"nr":18,"name":"Untergiesing-Harlaching","d":"M339 473L343 460L355 436L355 414L356 409L364 401L372 395L375 388L374 370L377 365L389 354L403 363L403 370L397 381L405 385L412 401L411 417L418 414L423 428L418 431L373 456L362 453L353 481L346 499L343 484L340 479L339 473Z","cx":381,"cy":419},{"nr":19,"name":"Thalkirchen-Obersendling-Forstenried-Fürstenried-Solln","d":"M339 473L325 473L322 477L317 489L316 496L308 498L305 501L296 504L293 512L286 509L281 516L273 514L270 502L271 496L213 458L220 443L215 440L219 425L230 420L233 426L242 424L255 415L268 406L276 416L281 410L287 409L296 401L299 405L325 402L330 404L338 403L344 399L356 400L359 397L364 401L356 409L355 414L355 436L343 460L339 473Z","cx":289,"cy":449},{"nr":20,"name":"Hadern","d":"M202 338L217 334L226 331L227 335L235 333L244 333L252 334L257 339L262 345L270 344L269 398L268 406L255 415L242 424L233 426L230 420L219 425L213 415L220 401L213 399L199 399L200 391L200 374L203 374L204 365L202 347L202 338Z","cx":236,"cy":376},{"nr":21,"name":"Pasing-Obermenzing","d":"M202 338L200 333L193 330L194 327L178 324L172 328L167 322L154 320L151 315L162 288L165 282L172 277L182 275L182 272L173 269L157 254L145 244L149 237L158 227L153 213L161 211L170 212L173 215L195 208L195 214L204 212L215 208L220 210L233 223L238 219L248 219L250 237L245 245L235 245L232 253L232 259L234 271L237 276L246 286L247 295L243 306L235 324L235 333L227 335L226 331L217 334L202 338Z","cx":200,"cy":270},{"nr":22,"name":"Aubing-Lochhausen-Langwied","d":"M151 315L140 313L133 315L128 325L114 336L102 343L90 346L76 345L74 337L68 339L67 328L65 321L72 315L67 303L71 301L69 290L63 286L60 280L56 280L56 271L40 270L39 264L32 261L28 256L16 258L20 244L25 239L30 226L32 214L31 209L34 203L42 201L52 201L60 205L70 195L74 187L71 182L72 173L66 170L70 144L89 143L144 131L143 134L162 135L155 140L152 146L153 172L141 175L143 182L153 189L152 200L161 211L153 213L158 227L149 237L145 244L157 254L173 269L182 272L182 275L172 277L165 282L162 288L151 315Z","cx":102,"cy":238},{"nr":23,"name":"Allach-Untermenzing","d":"M224 93L237 111L238 117L233 119L234 137L232 144L212 135L221 146L230 152L243 157L246 159L248 173L247 200L245 212L248 219L238 219L233 223L220 210L215 208L204 212L195 214L195 208L173 215L170 212L161 211L152 200L153 189L143 182L141 175L153 172L152 146L155 140L162 135L143 134L144 131L155 129L165 126L189 121L192 114L200 103L213 95L224 93Z","cx":200,"cy":164},{"nr":24,"name":"Feldmoching-Hasenbergl","d":"M339 175L326 176L286 162L277 155L255 148L244 148L232 144L234 137L233 119L238 117L237 111L224 93L225 91L245 82L244 75L245 66L243 59L248 50L246 43L251 38L248 28L249 22L267 16L289 22L311 34L319 58L326 63L343 67L346 71L353 73L381 72L378 78L381 84L376 100L383 170L353 171L339 175Z","cx":305,"cy":104},{"nr":25,"name":"Laim","d":"M246 286L259 292L275 295L288 297L300 296L318 298L327 298L313 305L312 316L301 327L296 332L283 342L281 346L270 344L262 345L257 339L252 334L244 333L235 333L235 324L243 306L247 295L246 286Z","cx":274,"cy":316}]};

const DEPTH = 5;

function bboxOf(d: string) {
  const n = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  for (let i = 0; i + 1 < n.length; i += 2) {
    const x = n[i], y = n[i + 1];
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
  }
  return { x: minx, y: miny, w: maxx - minx, h: maxy - miny, cx: (minx + maxx) / 2, cy: (miny + maxy) / 2 };
}
function slug(s: string): string {
  return s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
const hue = (i: number) => (i * 41 + 200) % 360;

export default function MuenchenBezirkeMap() {
  const [zoom, setZoom] = useState<number | null>(null);
  const [hov, setHov] = useState<number | null>(null);
  const W = MAP.W, H = MAP.H;

  const boxes = useMemo(() => Object.fromEntries(MAP.districts.map((d) => [d.nr, bboxOf(d.d)])), []);
  const sel = zoom != null ? MAP.districts.find((d) => d.nr === zoom) ?? null : null;

  // Zoom-Transform auf den Karten-Layer
  let s = 1, Tx = 0, Ty = 0;
  if (sel) {
    const b = boxes[sel.nr];
    s = Math.min(Math.min(W / b.w, H / b.h) * 0.6, 4.2);
    Tx = W / 2 - s * b.cx;
    Ty = H / 2 - s * b.cy;
  }

  // Demo-Pins für den geöffneten Bezirk (Bildschirm-Koordinaten, skalieren nicht mit)
  const pins = useMemo(() => {
    if (!sel) return [];
    const b = boxes[sel.nr];
    const k = 2 + (sel.nr % 4);
    const arr = [];
    for (let i = 0; i < k; i++) {
      const a = i * 2.39996, rr = b.w * 0.16 * (0.45 + (i % 3) * 0.3);
      const px = b.cx + Math.cos(a) * rr, py = b.cy + Math.sin(a) * rr * 0.7;
      arr.push({ x: s * px + Tx, y: s * py + Ty, i });
    }
    return arr;
  }, [sel, boxes, s, Tx, Ty]);

  const count = sel ? (sel.nr * sel.nr) % 17 + 3 : 0;

  return (
    <div className="relative mx-auto max-w-[60rem] px-5 py-8 text-[#0f2942]">
      <style>{`
        @keyframes mucSheen{to{transform:rotate(360deg)}}
        @keyframes mucRise{from{transform:translateY(10px)}to{transform:translateY(0)}}
        @keyframes mucPin{0%{opacity:0;transform:translateY(-26px)}60%{transform:translateY(4px)}100%{opacity:1;transform:translateY(0)}}
        .muc-sheen{position:absolute;inset:-30%;background:conic-gradient(from 0deg,rgba(14,165,233,.10),rgba(163,230,53,.10),rgba(244,114,182,.10),rgba(14,165,233,.10));filter:blur(40px);border-radius:50%;pointer-events:none}
        @media (prefers-reduced-motion: no-preference){.muc-sheen{animation:mucSheen 40s linear infinite}.muc-enter{animation:mucRise .5s ease both;animation-delay:calc(var(--i) * 14ms)}.muc-pin{animation:mucPin .5s cubic-bezier(.2,1.3,.4,1) both;animation-delay:calc(var(--i) * 70ms)}}
        .muc-zoomlayer{transition:transform .65s cubic-bezier(.4,0,.2,1);transform-origin:0 0}
        .muc-dist{transition:opacity .45s ease,filter .2s}
        .muc-gone{opacity:0 !important;pointer-events:none}
      `}</style>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">{sel ? `München · ${sel.name}` : "München · 25 Stadtbezirke"}</h1>
        {sel ? (
          <button
            onClick={() => setZoom(null)}
            className="rounded-full border border-sky-300 bg-white px-3 py-1 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50"
          >
            ← Zurück zu München
          </button>
        ) : (
          <span className="text-xs text-slate-500">3D · Bezirk anklicken → reinzoomen · Pins = Demo-Fahrschulen</span>
        )}
        {sel && <span className="text-sm text-slate-600">ca. {count} Fahrschulen · <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">/fahrschulen/muenchen/{slug(sel.name)}</code></span>}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100">
        <div className="muc-sheen" aria-hidden="true" />
        <svg viewBox={`0 0 ${W} ${H + DEPTH + 8}`} className="relative block w-full" role="img" aria-label="Interaktive 3D-Karte der Münchner Stadtbezirke">
          <g className="muc-zoomlayer" style={{ transform: sel ? `translate(${Tx}px, ${Ty}px) scale(${s})` : "none" }}>
            {MAP.districts.map((d, idx) => {
              const isSel = sel?.nr === d.nr;
              // Beim Reinzoomen nur den gewählten Bezirk rendern — alle anderen verschwinden.
              if (sel && !isSel) return null;
              const light = isSel ? 84 : hov === d.nr ? 86 : 90;
              const top = `hsl(${hue(idx)} 72% ${light}%)`;
              const wall = `hsl(${hue(idx)} 45% ${isSel ? 64 : 72}%)`;
              return (
                <g key={d.nr} className="muc-enter muc-dist" style={{ ["--i"]: idx } as React.CSSProperties}>
                  <g
                    style={{ cursor: sel ? "default" : "pointer" }}
                    onMouseEnter={() => !sel && setHov(d.nr)}
                    onMouseLeave={() => setHov((h) => (h === d.nr ? null : h))}
                    onClick={() => !sel && setZoom(d.nr)}
                  >
                    {Array.from({ length: DEPTH }).map((_, k) => (
                      <path key={k} d={d.d} transform={`translate(0 ${DEPTH - k})`} fill={wall} />
                    ))}
                    <path d={d.d} fill={top} stroke="#fff" strokeWidth={isSel ? 0.8 : 1.1} />
                    <text x={d.cx} y={d.cy - 1} textAnchor="middle" fontSize={11} fontWeight={800} fill="#0f2942" stroke="#fff" strokeWidth={2.4} style={{ paintOrder: "stroke", pointerEvents: "none" }}>{d.nr}</text>
                    <text x={d.cx} y={d.cy + 9} textAnchor="middle" fontSize={7.5} fontWeight={600} fill="#475569" stroke="#fff" strokeWidth={1.8} style={{ paintOrder: "stroke", pointerEvents: "none" }}>{d.name.split("-")[0].slice(0, 12)}</text>
                  </g>
                </g>
              );
            })}
          </g>

          {/* Pin-Layer (skaliert nicht) */}
          {pins.map((p) => (
            <g key={p.i} className="muc-pin" style={{ ["--i"]: p.i } as React.CSSProperties} transform={`translate(${p.x} ${p.y})`}>
              <path d="M0 0 C -8 -11 -8 -20 0 -24 C 8 -20 8 -11 0 0 Z" fill="#e11d48" stroke="#fff" strokeWidth={1.5} />
              <circle cx={0} cy={-15} r={3.2} fill="#fff" />
              <title>Fahrschule (Demo) {p.i + 1}</title>
            </g>
          ))}
        </svg>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Konzept-Prototyp: echte Bezirksgrenzen (Open Data München), farbig + Motion. Reinzoomen öffnet später die echte Bezirks-Seite mit Fahrschul-Pins aus Geokoordinaten. Pins hier sind Demo-Positionen.
      </p>
    </div>
  );
}
