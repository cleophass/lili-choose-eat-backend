// src/lib/stripe/promo.ts
import { stripe } from "./config";

export interface CreatePromoCodeOptions {
  couponId: string;
  code?: string;
  maxRedemptions?: number;
  expiresAt?: number;
  customerId?: string;
  firstTimeTransaction?: boolean;
  minimumAmount?: number;
  currency?: string;
}

export interface CreatePromoCodeResult {
  success: boolean;
  promoCode?: {
    id: string;
    code: string;
    coupon: {
      id: string;
      percent_off?: number;
      amount_off?: number;
      currency?: string;
    };
    expires_at?: number;
    max_redemptions?: number;
    times_redeemed: number;
  };
  error?: string;
}

/**
 * Génère un code promo Stripe
 * @param options Options pour créer le code promo
 * @returns Résultat de la création du code promo
 */
export async function createPromoCode(options: CreatePromoCodeOptions): Promise<CreatePromoCodeResult> {
  try {
    const {
      couponId,
      code,
      maxRedemptions,
      expiresAt,
      customerId,
      firstTimeTransaction,
      minimumAmount,
      currency = 'eur'
    } = options;

    // Paramètres de base pour le code promo
    const promoCodeParams: {
      coupon: string;
      code?: string;
      max_redemptions?: number;
      expires_at?: number;
      restrictions?: Record<string, unknown>;
    } = {
      coupon: couponId,
    };

    // Code personnalisé (optionnel, Stripe génère automatiquement si non fourni)
    if (code) {
      promoCodeParams.code = code;
    }

    // Nombre maximum d'utilisations
    if (maxRedemptions) {
      promoCodeParams.max_redemptions = maxRedemptions;
    }

    // Date d'expiration (timestamp Unix)
    if (expiresAt) {
      promoCodeParams.expires_at = expiresAt;
    }

    // Restrictions
    const restrictions: {
      first_time_transaction?: boolean;
      minimum_amount?: number;
      minimum_amount_currency?: string;
    } = {};
    
    if (customerId) {
      // Restreindre à un client spécifique
      restrictions.first_time_transaction = firstTimeTransaction || false;
    }

    if (minimumAmount) {
      // Montant minimum pour utiliser le code
      restrictions.minimum_amount = minimumAmount;
      restrictions.minimum_amount_currency = currency;
    }

    if (Object.keys(restrictions).length > 0) {
      promoCodeParams.restrictions = restrictions;
    }

    // Créer le code promo avec Stripe
    const promoCode = await stripe.promotionCodes.create(promoCodeParams);

    console.log("Code promo créé avec succès:", {
      id: promoCode.id,
      code: promoCode.code,
      coupon: promoCode.coupon.id
    });

    return {
      success: true,
      promoCode: {
        id: promoCode.id,
        code: promoCode.code,
        coupon: {
          id: promoCode.coupon.id,
          percent_off: promoCode.coupon.percent_off || undefined,
          amount_off: promoCode.coupon.amount_off || undefined,
          currency: promoCode.coupon.currency || undefined,
        },
        expires_at: promoCode.expires_at || undefined,
        max_redemptions: promoCode.max_redemptions || undefined,
        times_redeemed: promoCode.times_redeemed,
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

/**
 * Génère un coupon Stripe (requis avant de créer un code promo)
 * @param percentOff Pourcentage de réduction (mutuel exclusif avec amountOff)
 * @param amountOff Montant de réduction en centimes (mutuel exclusif avec percentOff)
 * @param currency Devise pour amountOff (par défaut: 'eur')
 * @param duration Type de durée ('once', 'repeating', 'forever')
 * @param durationInMonths Nombre de mois si duration = 'repeating'
 * @param name Nom du coupon
 * @returns Résultat de la création du coupon
 */
export async function createCoupon(
  percentOff?: number,
  amountOff?: number,
  currency: string = 'eur',
  duration: 'once' | 'repeating' | 'forever' = 'once',
  durationInMonths?: number,
  name?: string
): Promise<{ success: boolean; coupon?: import('stripe').Stripe.Coupon; error?: string }> {
  try {
    if (!percentOff && !amountOff) {
      throw new Error("percentOff ou amountOff doit être fourni");
    }

    if (percentOff && amountOff) {
      throw new Error("percentOff et amountOff sont mutuellement exclusifs");
    }

    const couponParams: {
      duration: 'once' | 'repeating' | 'forever';
      percent_off?: number;
      amount_off?: number;
      currency?: string;
      duration_in_months?: number;
      name?: string;
    } = {
      duration,
    };

    if (percentOff) {
      couponParams.percent_off = percentOff;
    }

    if (amountOff) {
      couponParams.amount_off = amountOff;
      couponParams.currency = currency;
    }

    if (duration === 'repeating' && durationInMonths) {
      couponParams.duration_in_months = durationInMonths;
    }

    if (name) {
      couponParams.name = name;
    }

    const coupon = await stripe.coupons.create(couponParams);

    console.log("Coupon créé avec succès:", {
      id: coupon.id,
      percent_off: coupon.percent_off,
      amount_off: coupon.amount_off,
      currency: coupon.currency
    });

    return {
      success: true,
      coupon
    };

  } catch (error: unknown) {
    console.error("Erreur lors de la création du coupon:", error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue lors de la création du coupon"
    };
  }
}

/**
 * Fonction utilitaire pour créer un code promo avec un nouveau coupon
 * @param promoCodeOptions Options pour le code promo
 * @param couponOptions Options pour le coupon
 * @returns Résultat de la création complète
 */
export async function createPromoCodeWithCoupon(
  promoCodeOptions: Omit<CreatePromoCodeOptions, 'couponId'>,
  couponOptions: {
    percentOff?: number;
    amountOff?: number;
    currency?: string;
    duration?: 'once' | 'repeating' | 'forever';
    durationInMonths?: number;
    name?: string;
  }
): Promise<CreatePromoCodeResult> {
  try {
    // Créer d'abord le coupon
    const couponResult = await createCoupon(
      couponOptions.percentOff,
      couponOptions.amountOff,
      couponOptions.currency,
      couponOptions.duration,
      couponOptions.durationInMonths,
      couponOptions.name
    );

    if (!couponResult.success || !couponResult.coupon) {
      return {
        success: false,
        error: couponResult.error || "Erreur lors de la création du coupon"
      };
    }

    // Créer ensuite le code promo avec le coupon
    return await createPromoCode({
      ...promoCodeOptions,
      couponId: couponResult.coupon.id
    });

  } catch (error: unknown) {
    console.error("Erreur lors de la création du code promo avec coupon:", error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue"
    };
  }
}
