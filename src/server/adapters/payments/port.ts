/**
 * PaymentPort — Vertrag für Zahlungen (Stripe). Sensible Karten-/Kontodaten
 * werden NIE selbst gespeichert, nur Stripe-Referenzen (siehe SECURITY.md).
 *
 * Phase 1: nur die Schnittstelle. Die Stripe-Connect-Vertiefung (SEPA als
 * empfohlener Standard, Karte/Wallet zusätzlich) folgt in einer späteren Phase.
 */
export interface PaymentCustomerRef {
  customerId: string;
}

export interface PaymentPort {
  createCustomer(input: { email: string }): Promise<PaymentCustomerRef>;
}
