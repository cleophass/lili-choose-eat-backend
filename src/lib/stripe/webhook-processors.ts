// src/lib/stripe/webhook-processors.ts
import { extractPaymentData, extractSubscriptionId, getSubscriptionIdFromInvoice } from "./utils";

export interface ProcessorResult {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
  flowType: string;
}

// Processeur pour les flows 1 & 2 (description vide ou "Subscription creation")
export async function processPaymentCreationFlow(
  description: string, 
  latestCharge: string
): Promise<ProcessorResult> {
  const flowType = description === "" 
    ? "Flow 1: Description vide" 
    : "Flow 2: Subscription creation";

  console.log(`Processing ${flowType}`);
  
  // Extraction des données de paiement
  const paymentData = await extractPaymentData(latestCharge);

  if (!paymentData) {
    return {
      success: false,
      error: "Impossible de récupérer les données de paiement",
      flowType
    };
  }

  let subscriptionId: string | null = null;

  // Récupération des informations de subscription si invoice existe
  if (paymentData.invoiceId) {
    subscriptionId = await getSubscriptionIdFromInvoice(paymentData.invoiceId);
  }

  console.log("Données extraites avec succès:", {
    prenom: paymentData.prenom,
    nom: paymentData.nom,
    email: paymentData.email,
    customerId: paymentData.customerId,
    invoiceId: paymentData.invoiceId,
    productDescription: paymentData.productDescription,
    subscriptionId,
  });

  return {
    success: true,
    flowType,
    data: {
      payment_intent_id: paymentData.paymentIntentId,
      customer: {
        id: paymentData.customerId,
        prenom: paymentData.prenom,
        nom: paymentData.nom,
        email: paymentData.email,
      },
      invoice: {
        id: paymentData.invoiceId,
        product_description: paymentData.productDescription,
      },
      subscription: subscriptionId ? {
        id: subscriptionId,
      } : null,
      charge_id: latestCharge,
    }
  };
}

// Processeur pour le flow 3 ("Subscription update")
export async function processSubscriptionUpdateFlow(latestCharge: string): Promise<ProcessorResult> {
  const flowType = "Flow 3: Subscription update";
  


  
  // Extraction uniquement de l'ID de souscription
  const subscriptionId = await extractSubscriptionId(latestCharge);

  console.log("Subscription ID extrait:", subscriptionId);

  if (!subscriptionId) {
    return {
      success: false,
      error: "Impossible de récupérer l'ID de souscription",
      flowType
    };
  }

  return {
    success: true,
    flowType,
    data: {
      subscription: {
        id: subscriptionId,
      },
      charge_id: latestCharge,
    }
  };
}
