import { NextResponse } from "next/server";
import { 
  type WebhookPayload, 
  processPaymentCreationFlow, 
  processSubscriptionUpdateFlow 
} from "@/lib/stripe";

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
    if (event_type !== "payment_intent.succeeded" && event_type !== "payment_intent.payment_failed") {
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

    // Si description vide ou "Subscription creation" -> processPaymentCreationFlow
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

      const result = await processPaymentCreationFlow(trimmedDescription, latest_charge);
      
      if (!result.success) {
        return NextResponse.json(
          { 
            success: false,
            error: result.error 
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Payment webhook traité avec succès ✅",
        flow: result.flowType,
        data: result.data,
      });

    } else if (trimmedDescription === "Subscription update") {
      
      if (!latest_charge) {
        return NextResponse.json(
          { 
            success: false,
            error: "latest_charge requis pour le flow Subscription update" 
          },
          { status: 400 }
        );
      }

      const result = await processSubscriptionUpdateFlow(latest_charge);

      if (!result.success) {
        return NextResponse.json(
          { 
            success: false,
            error: result.error 
          },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        message: "Payment webhook traité avec succès ✅",
        flow: result.flowType,
        data: result.data,
      });

    } else {
      const flowType = `Flow inconnu: ${trimmedDescription}`;
      console.log(flowType);

      return NextResponse.json({
        success: true,
        message: "Payment webhook traité avec succès ✅",
        flow: flowType,
        data: {
          latest_charge,
        },
      });
    }

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