// src/lib/stripe/config.ts
import Stripe from "stripe";

// Initialisation de Stripe
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});
