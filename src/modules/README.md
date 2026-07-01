# src/modules — Geschäftslogik je Fachmodul

Jedes Fachmodul (z. B. `schools/`, `enrollment/`, `content/`) folgt derselben
Konvention, damit Logik nicht in `page.tsx`/`route.ts` „verrutscht":

```
modules/<x>/
  actions.ts     ← "use server": Eingabe-Validierung (Zod) + Session + Berechtigung,
                    ruft dann einen Use-Case. KEIN Geschäftswissen hier.
  use-cases/     ← die eigentlichen Geschäftsregeln, framework-unabhängig und
                    isoliert testbar. Rufen server/dal + adapters.
  <x>.types.ts   ← gemeinsame Typen des Moduls
```

**Verbindlicher Datenfluss:**

```
UI/Formular → actions.ts → use-cases/ → server/dal (+ adapters)
```

Die konkreten Module entstehen mit den jeweiligen Features (Schritte C ff.).
