// src/lib/stripe/promo.ts
import { stripe } from "./config";

export interface CreatePromoCodeWithCouponOptions {
  code: string;
  productIdList: string[];
  expiresAt: Date;
  name: string;
}

export interface CreatePromoCodeResult {
  success: boolean;
  promoCode?: {
    id: string;
    code: string;
    coupon: {
      id: string;
      percent_off: number;
    };
    expires_at: number;
  };
  error?: string;
}

/**
 * Crée un code promo de 10% valable sur les produits de type subscription
 * @param options Options pour créer le code promo
 * @returns Résultat de la création du code promo
 */
export async function createPromoCodeWithCoupon(
  options: CreatePromoCodeWithCouponOptions
): Promise<CreatePromoCodeResult> {
  try {
    const { code, productIdList, expiresAt } = options;

    // Créer un coupon de 10% pour les subscriptions
    const coupon = await stripe.coupons.create({
      percent_off: 10,
      duration: 'once',
      applies_to: {
        products: productIdList
      },
      name: options.name
    });

    // Créer le code promo avec le coupon
    const promoCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: code,
      expires_at: Math.floor(expiresAt.getTime() / 1000), // Convertir en timestamp Unix
    });

    return {
      success: true,
      promoCode: {
        id: promoCode.id,
        code: promoCode.code,
        coupon: {
          id: coupon.id,
          percent_off: 10,
        },
        expires_at: promoCode.expires_at!,
      }
    };

  } catch (error: unknown) {
    console.error("Erreur lors de la création du code promo:", error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue lors de la création du code promo"
    };
  }
}
