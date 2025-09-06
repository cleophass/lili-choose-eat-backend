// src/lib/stripe/types.ts

// Types pour une meilleure type-safety
export interface PaymentData {
  prenom: string;
}

export interface PromoPayload {
  email:string;
  paymentId: string;
}
