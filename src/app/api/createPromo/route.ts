import { NextResponse } from "next/server";
import { base } from "@/lib/airtable/utils";
import { PromoPayload } from "@/lib/promo/types";
import { createPromoCodeWithCoupon } from "@/lib/stripe/promo";
import { normalizeNameForPromoCode } from "@/lib/promo/utils";

export async function POST(req: Request) {
  try {
    // Parse et validation du body
    const body: PromoPayload = await req.json();
    const { email, paymentId } = body;

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
    
   


    // Vérifier que l'utilisateur n'a pas déjà un code parainage
    const existingPromoCode = user.get('Code parrainage');
    if (existingPromoCode) {
      return NextResponse.json({
        success: true,
        message: "Code promo existant trouvé",
        userId: user.id,
        promoCode: existingPromoCode,
        isExisting: true
      });
    }

    const prenom = user.get('Prénom') || '';
    const nom = user.get('Nom') || '';
    if (!prenom || !nom) {
      return NextResponse.json(
        {
          success: false,
          error: "L'utilisateur doit avoir un prénom et un nom pour générer un code promo"
        },
        { status: 400 }
      );
    }

    // based on paymentId get record from achat table to get end date of the subscription
    const achatRecords = await base('Achats').select({
      filterByFormula: `{Id paiement Stripe} = "${paymentId}"`,
      maxRecords: 1
    }).firstPage();

    if (achatRecords.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Achat non trouvé pour cet Id paiement Stripe"
        },
        { status: 404 }
      );
    }
    
    const achat = achatRecords[0];
    console.log("achat:", achat);

    // Find product where type == "Abonnement"

    const productRecords = await base('Produits').select({
      filterByFormula: `{Type} = "Abonnement"`,
    }).firstPage();
    if (productRecords.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Aucun produit d'abonnement trouvé dans la base de données"
        },
        { status: 404 }
      );
    }
    // get a list of Id produit Stripe 
    const productIds = productRecords.map(record => record.get('Id produit Stripe')).filter((id): id is string => typeof id === 'string');
    console.log("productIds:", productIds);
    



    // get "Date de fin" 
    const endDate = achat.get('Date de fin');
    if (!endDate) {
      return NextResponse.json(
        {
          success: false,
          error: "La date de fin de l'achat est manquante"
        },
        { status: 400 }
      );
    }

    const endDateObj = new Date(endDate as string);

    // Normaliser le prénom et le nom pour les codes promo
    const normalizedPrenom = normalizeNameForPromoCode(prenom as string);
    const normalizedNom = normalizeNameForPromoCode(nom as string);

    // Générer un code promo avec l'API Stripe prenom + 2 première lettre du nom 
    const promoResult = await createPromoCodeWithCoupon({
      code: `${normalizedPrenom}${normalizedNom.slice(0, 2).toUpperCase()}`,
      productIdList: productIds,
      expiresAt: endDateObj,
      name: `Parrainage de ${prenom} ${nom}`
    });

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



    return NextResponse.json({
      success: true,
      message: "Code promo généré avec succès",
      userId: user.id,
      promoCode: promoCode,
      isExisting: false,
      promoDetails: {
        id: promoResult.promoCode?.id,
        couponId: promoResult.promoCode?.coupon.id,
        expiresAt: promoResult.promoCode?.expires_at
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