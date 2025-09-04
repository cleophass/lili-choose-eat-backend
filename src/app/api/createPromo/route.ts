import { NextResponse } from "next/server";

import { base } from "@/lib/airtable/utils";
import { sendPromoCodeEmail } from "@/lib/brevo";
import { PromoPayload } from "@/lib/promo/types";
import { createPromoCodeWithCoupon } from "@/lib/stripe/promo";

export async function POST(req: Request) {
  try {
    // Détecter le type de contenu et parser en conséquence
    const contentType = req.headers.get('content-type') || '';
    let body: PromoPayload;

    if (contentType.includes('application/json')) {
      // Données JSON (si envoyées depuis une API)
      body = await req.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      // Données de formulaire Webflow
      const formData = await req.formData();
      body = {
        email: formData.get('email') as string || ''
      };
    } else {
      // Fallback: essayer de parser comme form data
      const text = await req.text();
      console.log('Raw body received:', text);
      
      // Parser manuellement les données URL-encoded
      const params = new URLSearchParams(text);
      body = {
        email: params.get('email') || ''
      };
    }

    console.log('Parsed body:', body);

    const { email } = body;

    // Validation des champs obligatoires
    if (!email) {
      return NextResponse.json(
        { 
          success: false,
          error: "Champs obligatoires manquants (email)" 
        },
        { status: 400 }
      );
    }

    // Query Airtable pour voir si l'utilisateur existe
    const records = await base('Clients').select({
      filterByFormula: `{Email} = "${email}"`,
      maxRecords: 1
    }).firstPage();
    console.log("records:", records);

    if (records.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: "Utilisateur non trouvé" 
        },
        { status: 404 }
      );
    }

    const user = records[0];
    
    // Vérifier que l'utilisateur a un "suivi en cours"
    const suiviEnCours = user.get('Suivi en cours ?');
    console.log("suiviEnCours:", suiviEnCours);
    if (!suiviEnCours) {
      return NextResponse.json(
        { 
          success: false,
          error: "L'utilisateur n'a pas de suivi en cours" 
        },
        { status: 400 }
      );
    }


    // Vérifier que l'utilisateur n'a pas déjà un code parainage
    const existingPromoCode = user.get('Code parrainage');
    if (existingPromoCode) {
      return NextResponse.json(
        { 
          success: false,
          error: "L'utilisateur a déjà un Code parrainage" 
        },
        { status: 400 }
      );
    }

    // Générer un code promo avec l'API Stripe
    const promoResult = await createPromoCodeWithCoupon(
      {
        code: `PARRAINAGE-${user.id}`, // Code unique basé sur l'ID de l'utilisateur
        maxRedemptions: 1, // Code utilisable une seule fois
        // Expire dans 6 mois
        expiresAt: Math.floor(Date.now() / 1000) + (6 * 30 * 24 * 60 * 60)
      },
      {
        percentOff: 20, // 20% de réduction
        duration: 'once', // Réduction valable une seule fois
        name: 'Code Parrainage 20%'
      }
    );

    if (!promoResult.success) {
      return NextResponse.json(
        { 
          success: false,
          error: "Erreur lors de la création du code promo",
          details: promoResult.error
        },
        { status: 500 }
      );
    }

    const promoCode = promoResult.promoCode?.code;
    
    if (!promoCode) {
      return NextResponse.json(
        { 
          success: false,
          error: "Code promo non généré"
        },
        { status: 500 }
      );
    }

    // Stocker le code promo dans Airtable
    await base('Clients').update([{
      id: user.id,
      fields: {
        'Code parrainage': promoCode
      }
    }]);

    // Récupérer le prénom s'il existe dans Airtable
    const prenom = user.get('Prénom') || user.get('Prenom') || user.get('prenom');

    // // Envoyer le code par email avec Brevo
    // const emailResult = await sendPromoCodeEmail(email, promoCode, prenom as string);
    
    // if (!emailResult.success) {
    //   console.error("Erreur envoi email:", emailResult.error);
    //   // On continue même si l'email échoue, le code est déjà créé
    // }
    // console.log("Email envoyé avec succès:", emailResult);


    return NextResponse.json({
      success: true,
      message: "Code promo généré avec succès",
      userId: user.id,
      promoCode: promoCode,
      promoDetails: {
        id: promoResult.promoCode?.id,
        couponId: promoResult.promoCode?.coupon.id,
        expiresAt: promoResult.promoCode?.expires_at,
        maxRedemptions: promoResult.promoCode?.max_redemptions
      }
    });

  } catch (error) {
    console.error("Erreur dans createPromo:", error);
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