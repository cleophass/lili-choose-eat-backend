// src/lib/stripe/utils.ts
import { stripe } from "./config";
import { PaymentData } from "./types";

// Fonction pour extraire uniquement l'ID de souscription
export async function extractSubscriptionId(latestCharge: string): Promise<string | null> {
  try {
    // 1. Récupérer les infos de la charge avec la SDK Stripe
    const chargeData = await stripe.charges.retrieve(latestCharge);

    const paymentIntentId = typeof chargeData.payment_intent === 'string' 
      ? chargeData.payment_intent 
      : chargeData.payment_intent?.id;

    if (!paymentIntentId) {
      console.error("Payment Intent ID not found in charge data");
      return null;
    }

    // 2. Récupérer le Payment Intent
    const paymentIntentData = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log("Payment Intent data retrieved:", paymentIntentData);

    // 3. Récupérer le customer ID
    const customerId = typeof paymentIntentData.customer === 'string' 
      ? paymentIntentData.customer 
      : paymentIntentData.customer?.id;

    if (!customerId) {
      console.error("Customer ID not found in payment intent");
      return null;
    }


    
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 10
    });
    console.log("Active subscriptions retrieved:", subscriptions.data);

    const targetAmount = paymentIntentData.amount;
    console.log("Target amount for matching subscription:", targetAmount);
    
    // Essayer de trouver une souscription avec le même montant
    let matchingSubscription = subscriptions.data.find(sub => {
      const latestInvoice = sub.latest_invoice;
      if (typeof latestInvoice === 'string') {
        // Si on a juste l'ID, on ne peut pas comparer facilement
        return true; // On prend la première pour l'instant
      } else if (latestInvoice && latestInvoice.amount_paid === targetAmount) {
        return true;
      }
      return false;
    });

    // Si pas de correspondance exacte, prendre la première souscription active
    if (!matchingSubscription && subscriptions.data.length > 0) {
      matchingSubscription = subscriptions.data[0];
    }

    if (matchingSubscription) {
      console.log("Subscription ID found:", matchingSubscription.id);
      return matchingSubscription.id;
    }

    console.error("No matching subscription found");
    return null;

  } catch (error) {
    console.error("Error extracting subscription ID:", error);
    return null;
  }
}

// Fonction pour extraire les données de paiement
export async function extractPaymentData(latestCharge: string, payment_intent: string): Promise<PaymentData | null> {
  try {
    // 1. Récupérer les infos de la charge avec la SDK Stripe
    const chargeData = await stripe.charges.retrieve(latestCharge);
    console.log("Charge data retrieved:", chargeData);

    const customerId = typeof chargeData.customer === 'string' 
      ? chargeData.customer 
      : chargeData.customer?.id;
  
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: payment_intent,
      limit: 1,
    });

    const session = sessions.data[0];
    console.log("ssession:",session)
    console.log("Checkout session retrieved:", session);

    if (!session) {
      console.error("No session found for payment intent");
      return null;
    }

    // s'il y'a un code promo dans session.discounts.promotion_code le reucperer
    const promotionCodeData = session.discounts?.[0]?.promotion_code;
    const promotionCode = typeof promotionCodeData === 'string' 
      ? promotionCodeData 
      : promotionCodeData?.id || '';

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    console.log("Line items retrieved:", lineItems.data);

    // 3. Extraire les données de manière safe
    const customFields = session.custom_fields || [];
    const prenomField = customFields.find((field) => field.key === 'prnom');
    const nomField = customFields.find((field) => field.key === 'nom');
    
    const email = session.customer_details?.email || '';
    const invoiceId = typeof session.invoice === 'string' 
      ? session.invoice 
      : session.invoice?.id || '';
    let productId = '';

    // 4. Récupérer le productId depuis les line items (toujours disponible)
    try {
      productId = lineItems.data[0]?.price?.product as string || '';
    } catch (error) {
      console.error("Failed to fetch product ID from line items:", error);
    }

    // 5. Récupérer les détails de la facture si elle existe, sinon depuis les line items
    let productDescription = '';
    if (invoiceId) {
      try {
        const invoice = await stripe.invoices.retrieve(invoiceId);
        productDescription = invoice.lines.data[0]?.description || '';
      } catch (error) {
        console.error("Failed to fetch invoice data:", error);
      }
    } else {
      // Pour les produits uniques, récupérer depuis les line items de la session
      try {
        productDescription = lineItems.data[0]?.description || '';
      } catch (error) {
        console.error("Failed to fetch line items description:", error);
      }
    }

    return {
      prenom: prenomField?.text?.value || '',
      nom: nomField?.text?.value || '',
      email,
      customerId: customerId || '',
      invoiceId,
      productDescription,
      productId,
      promotionCode
    };

  } catch (error) {
    console.error("Error extracting payment data:", error);
    return null;
  }
}

// Fonction pour récupérer l'ID de souscription depuis une facture
export async function getSubscriptionIdFromInvoice(invoiceId: string): Promise<string | null> {
  try {
    const invoiceData = await stripe.invoices.retrieve(invoiceId);
    console.log("Données de la facture extraites:", {
      subscription: invoiceData.parent?.subscription_details?.subscription,
      invoice_id: invoiceData.id
    });

    // Le subscription ID se trouve directement dans invoiceData.parent?.subscription_details
    const subscription = invoiceData.parent?.subscription_details?.subscription;
    return typeof subscription === 'string' 
      ? subscription 
      : (typeof subscription === 'object' && subscription?.id) || null;

  } catch (error) {
    console.error("Erreur lors de la récupération de l'invoice:", error);
    return null;
  }
}
