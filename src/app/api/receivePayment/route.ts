// src/app/api/receivePayment/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";

// Initialisation de Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

// Types pour une meilleure type-safety
interface PaymentData {
  prenom: string;
  nom: string;
  email: string;
  customerId: string;
  paymentIntentId: string;
  invoiceId: string;
  productDescription: string;
}

interface WebhookPayload {
  event_type: string;
  description?: string;
  latest_charge?: string;
}

// Helper pour récupérer les données de manière safe - DEPRECATED
// Remplacé par l'utilisation directe de la SDK Stripe

// Fonction pour extraire les données de paiement
async function extractPaymentData(latestCharge: string): Promise<PaymentData | null> {
  try {
    // 1. Récupérer les infos de la charge avec la SDK Stripe
    const chargeData = await stripe.charges.retrieve(latestCharge);
    
    const customerId = typeof chargeData.customer === 'string' ? chargeData.customer : chargeData.customer?.id;
    const paymentIntentId = typeof chargeData.payment_intent === 'string' ? chargeData.payment_intent : chargeData.payment_intent?.id;

    if (!paymentIntentId) {
      console.error("Payment Intent ID not found in charge data");
      return null;
    }

    // 2. Récupérer les sessions de checkout liées au payment intent
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: paymentIntentId,
      limit: 1,
    });

    const session = sessions.data[0];
    if (!session) {
      console.error("No session found for payment intent");
      return null;
    }

    // 3. Extraire les données de manière safe
    const customFields = session.custom_fields || [];
    const prenomField = customFields.find((field) => field.key === 'prnom');
    const nomField = customFields.find((field) => field.key === 'nom');
    
    const email = session.customer_details?.email || '';
    const invoiceId = typeof session.invoice === 'string' ? session.invoice : session.invoice?.id || '';

    // 4. Récupérer les détails de la facture si elle existe
    let productDescription = '';
    if (invoiceId) {
      try {
        const invoice = await stripe.invoices.retrieve(invoiceId);
        productDescription = invoice.lines.data[0]?.description || '';
      } catch (error) {
        console.error("Failed to fetch invoice data:", error);
      }
    }

    return {
      prenom: prenomField?.text?.value || '',
      nom: nomField?.text?.value || '',
      paymentIntentId,
      email,
      customerId: customerId || '',
      invoiceId,
      productDescription,
    };

  } catch (error) {
    console.error("Error extracting payment data:", error);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    // Parse et validation du body
    const body: WebhookPayload = await req.json();
    const {
      event_type,
      description = '',
      latest_charge,
    } = body;

    // Validation des champs obligatoires
    if (!event_type) {
      return NextResponse.json(
        { 
          success: false,
          error: "Champs obligatoires manquants (payment_intent_id, event_type)" 
        },
        { status: 400 }
      );
    }

    // Vérification du type d'événement
    if (event_type !== "payment_intent.succeeded") {
      return NextResponse.json(
        { 
          success: false,
          error: `Event type non supporté: ${event_type}` 
        },
        { status: 400 }
      );
    }

    // Traitement selon la description
    const trimmedDescription = description.trim();
    let paymentData: PaymentData | null = null;
    let flowType: string;

    // Si description vide ou "Subscription creation" -> on récupère les infos
    if (trimmedDescription === "" || trimmedDescription === "Subscription creation") {
      
      if (!latest_charge) {
        return NextResponse.json(
          { 
            success: false,
            error: "latest_charge requis pour ce type de flow" 
          },
          { status: 400 }
        );
      }

      flowType = trimmedDescription === "" 
        ? "Flow 1: Description vide" 
        : "Flow 2: Subscription creation";

      console.log(`Processing ${flowType}`);
      
      // Extraction des données de paiement
      paymentData = await extractPaymentData(latest_charge);
      console.log("Données de paiement extraites:", paymentData);

      if (!paymentData) {
        return NextResponse.json(
          { 
            success: false,
            error: "Impossible de récupérer les données de paiement" 
          },
          { status: 500 }
        );
      }

      console.log("Données extraites avec succès:", {
        prenom: paymentData.prenom,
        nom: paymentData.nom,
        email: paymentData.email,
        customerId: paymentData.customerId,
        invoiceId: paymentData.invoiceId,
        productDescription: paymentData.productDescription,
      });

    } else if (trimmedDescription === "Subscription update") {
      flowType = "Flow 3: Subscription update";
      console.log("Subscription update - pas de traitement pour le moment");
    } else {
      flowType = `Flow inconnu: ${trimmedDescription}`;
      console.log(flowType);
    }

    // Réponse finale
    return NextResponse.json({
      success: true,
      message: "Payment webhook traité avec succès ✅",
      flow: flowType,
      data: paymentData ? {
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
        charge_id: latest_charge,
      } : {
        latest_charge,
      },
    });

  } catch (error) {
    console.error("Erreur dans le webhook:", error);
    
    // Gestion d'erreur JSON parsing
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { 
          success: false,
          error: "Body JSON invalide" 
        },
        { status: 400 }
      );
    }

    // Autres erreurs
    return NextResponse.json(
      { 
        success: false,
        error: "Erreur interne du serveur",
        details: error instanceof Error ? error.message : "Erreur inconnue"
      },
      { status: 500 }
    );
  }
}