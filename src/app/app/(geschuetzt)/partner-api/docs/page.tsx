import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteUrl } from "@/lib/public-config";
import { DEV_API_KEY_TOKEN } from "@/modules/api/dev-key";
import { getApiPartnerKontext } from "@/modules/portal/dashboard";
import { getPortalIdentity, isDevSessionActive } from "@/modules/portal/identity";
import { hatPlattformRolle } from "@/modules/portal/rollen";
import { DashboardHero } from "@/components/portal/dashboards/hero";
import { PanelKarte, Zeile, ZeilenListe } from "@/components/portal/karten";

/**
 * partner-api/docs — Verbindungsanleitung V1 (Paket C, ersetzt den Platzhalter).
 * ----------------------------------------------------------------------------
 * NUR eingeloggt sichtbar (Gate 1:1 vom Platzhalter: admin ODER Partner-
 * Mitglied) — kein öffentliches API-Marketing in V1. Inhalt: Endpunkte,
 * Auth-Header, Scopes, MCP-Verbindung, Fehlercodes. Der Dev-Schlüssel-Block
 * rendert AUSSCHLIESSLICH bei aktivem Dev-Session-Seam (lokal).
 */
export const metadata: Metadata = { title: "Dokumentation" };

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-lg bg-muted px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground/90">
      <code>{children}</code>
    </pre>
  );
}

export default async function Seite() {
  const identity = await getPortalIdentity();
  if (!identity) notFound();
  const istAdmin = hatPlattformRolle(identity, "admin");
  if (!istAdmin && (await getApiPartnerKontext()) === null) notFound();

  const basisUrl = getSiteUrl();
  const devSeam = isDevSessionActive();

  return (
    <div className="grid gap-8">
      <DashboardHero
        kicker="partner-api"
        titel="Dokumentation"
        satz="Alles, was du für deine Anbindung brauchst: REST, MCP, Scopes und Fehlercodes."
      />

      <PanelKarte titel="Zugang" kicker="auth">
        <p className="text-sm text-muted-foreground">
          Jede authentifizierte Anfrage trägt deinen API-Schlüssel als Bearer-Token im
          Authorization-Header. Der Schlüssel wird dir von onelane übergeben und ist
          danach nirgends mehr einsehbar — behandle ihn wie ein Passwort.
        </p>
        <CodeBlock>{`Authorization: Bearer <dein-schluessel>`}</CodeBlock>
        <p className="mt-2 text-xs text-muted-foreground/80">
          Dein Schlüssel wird von onelane ausgestellt und ist ab Ausstellung sofort
          gültig; widerrufene, rotierte oder abgelaufene Schlüssel antworten mit 401.
        </p>
      </PanelKarte>

      <PanelKarte titel="REST-Endpunkte" kicker="rest · v1">
        <ZeilenListe>
          <Zeile
            links={<span className="font-mono text-xs">GET /api/v1/ping</span>}
            sub="Verbindungstest — ohne Schlüssel aufrufbar, antwortet mit Dienst, Version und Serverzeit."
            rechts="ohne Auth"
          />
          <Zeile
            links={<span className="font-mono text-xs">GET /api/v1/me</span>}
            sub="Selbstauskunft deines Schlüssels: Partner, Scopes, Status, Ablauf."
            rechts="Scope rest_read"
          />
        </ZeilenListe>
        <CodeBlock>{`curl -H "Authorization: Bearer <dein-schluessel>" \\
  ${basisUrl}/api/v1/me`}</CodeBlock>
      </PanelKarte>

      <PanelKarte titel="Scopes" kicker="rechte">
        <ZeilenListe>
          <Zeile
            links={<span className="font-mono text-xs">rest_read</span>}
            sub="Lesender Zugriff auf die REST-Endpunkte unter /api/v1."
          />
          <Zeile
            links={<span className="font-mono text-xs">mcp</span>}
            sub="Zugriff auf den MCP-Endpunkt /api/mcp (read-only-Werkzeuge)."
          />
        </ZeilenListe>
        <p className="mt-2 text-xs text-muted-foreground/80">
          Welche Scopes dein Schlüssel trägt, siehst du unter „API-Schlüssel“ oder per
          GET /api/v1/me. Weitere Scopes folgen mit neuen Endpunkten.
        </p>
      </PanelKarte>

      <PanelKarte titel="MCP-Verbindung" kicker="mcp">
        <p className="text-sm text-muted-foreground">
          Der MCP-Endpunkt (Model Context Protocol, Streamable HTTP) nimmt
          JSON-RPC-2.0-Nachrichten per POST entgegen und stellt read-only-Werkzeuge
          bereit: <span className="font-mono text-xs">ping</span>,{" "}
          <span className="font-mono text-xs">portal_status</span>,{" "}
          <span className="font-mono text-xs">plan_katalog</span> und{" "}
          <span className="font-mono text-xs">jobs_offen_anzahl</span>. Schulbezogene
          Werkzeuge folgen mit der Schul-Bindung deines Schlüssels.
        </p>
        <CodeBlock>{`{
  "mcpServers": {
    "onelane": {
      "type": "http",
      "url": "${basisUrl}/api/mcp",
      "headers": { "Authorization": "Bearer <dein-schluessel>" }
    }
  }
}`}</CodeBlock>
        <p className="mt-2 text-sm text-muted-foreground">Direkt per curl testen:</p>
        <CodeBlock>{`curl -X POST ${basisUrl}/api/mcp \\
  -H "Authorization: Bearer <dein-schluessel>" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"portal_status"}}'`}</CodeBlock>
      </PanelKarte>

      <PanelKarte titel="Fehlercodes & Limits" kicker="betrieb">
        <ZeilenListe>
          <Zeile
            links={<span className="font-mono text-xs">401 authentication_required</span>}
            sub="Schlüssel fehlt, ist unbekannt, rotiert, widerrufen oder abgelaufen."
          />
          <Zeile
            links={<span className="font-mono text-xs">403 insufficient_scope</span>}
            sub="Der Schlüssel trägt den für diesen Endpunkt nötigen Scope nicht."
          />
          <Zeile
            links={<span className="font-mono text-xs">403 partner_inactive</span>}
            sub="Das Partner-Konto ist pausiert oder beendet."
          />
          <Zeile
            links={<span className="font-mono text-xs">429 rate_limited</span>}
            sub="Fair-Use-Limit erreicht — bitte warte die im retry-after-Header genannte Zeit."
          />
        </ZeilenListe>
        <p className="mt-2 text-xs text-muted-foreground/80">
          Fair-Use in V1: 60 Anfragen pro Minute je Schlüssel. Alle Antworten sind
          no-store; keine Antwort enthält personenbezogene Daten.
        </p>
      </PanelKarte>

      {devSeam ? (
        <PanelKarte titel="Dev-Schlüssel (nur lokale Entwicklung)" kicker="dev">
          <p className="text-sm text-muted-foreground">
            Das Dev-Session-Seam ist aktiv — dieser fest verdrahtete Schlüssel
            funktioniert NUR lokal (fail-closed in Produktion) und gehört zu
            „dev_seed Partner Alpha“:
          </p>
          <CodeBlock>{DEV_API_KEY_TOKEN}</CodeBlock>
        </PanelKarte>
      ) : null}
    </div>
  );
}
