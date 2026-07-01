/**
 * AiPort — Vertrag für spätere KI-Funktionen (z. B. Telefonagent, Chat).
 * ----------------------------------------------------------------------------
 * Phase 1: NUR DER VERTRAG, KEINE Implementierung. Der konkrete Anbieter wird
 * bewusst erst später gewählt (frei wechselbar). Diese Stelle hält die
 * Schnittstelle bereit, damit Phase 2/3 ohne Architektur-Umbau andocken können.
 */
export interface AiCompletionRequest {
  prompt: string;
  system?: string;
}

export interface AiPort {
  complete(request: AiCompletionRequest): Promise<string>;
}
