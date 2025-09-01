// src/lib/stripe/types.ts

// Types pour une meilleure type-safety
export interface PaymentData {
  prenom: string;
  nom: string;
  email: string;
  customerId: string;
  invoiceId: string;
  productDescription: string;
  productId: string;
}

export interface WebhookPayload {
  event_type: string;
  description?: string;
  latest_charge?: string;
  payment_intent?: string;
}
