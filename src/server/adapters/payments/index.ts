import "server-only";
import type { PaymentPort, PaymentCustomerRef } from "./port";

/**
 * Payment-Adapter-Auswahl. Phase 1: Stripe-Stub (noch nicht implementiert).
 * Die `stripe`-Bibliothek wird bewusst erst bei der Stripe-Vertiefung als
 * Abhängigkeit ergänzt (YAGNI), damit das Fundament schlank bleibt.
 */
class StripeAdapter implements PaymentPort {
  async createCustomer(): Promise<PaymentCustomerRef> {
    throw new Error(
      "StripeAdapter: Zahlungsfunktionen sind in Phase 1 noch nicht implementiert.",
    );
  }
}

export function getPaymentAdapter(): PaymentPort {
  return new StripeAdapter();
}
