import * as brevo from '@getbrevo/brevo';
import { BrevoEmailResponse, BrevoSender } from './types';

// Configuration du client Brevo
const apiInstance = new brevo.TransactionalEmailsApi();
const apiKey = process.env.BREVO_API_KEY || '';

if (!apiKey) {
  console.error('❌ BREVO_API_KEY manquante dans les variables d\'environnement');
} else {
  console.log('✅ BREVO_API_KEY trouvée, longueur:', apiKey.length);
}

apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  from?: BrevoSender;
}

export interface SendTemplateEmailOptions {
  to: string;
  templateId: number;
  params?: Record<string, string | number>;
  contactAttributes?: Record<string, string | number>;
  from?: BrevoSender;
}

export async function sendEmail(options: SendEmailOptions): Promise<BrevoEmailResponse> {
  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    
    sendSmtpEmail.subject = options.subject;
    sendSmtpEmail.htmlContent = options.htmlContent;
    sendSmtpEmail.textContent = options.textContent;
    sendSmtpEmail.sender = options.from || {
      name: process.env.BREVO_SENDER_NAME || 'Lili Choose Eat',
      email: process.env.BREVO_SENDER_EMAIL || 'noreply@lili-choose-eat.com'
    };
    sendSmtpEmail.to = [{ email: options.to }];

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    
    return {
      success: true,
      messageId: result.body?.messageId || null,
      data: result.body as Record<string, unknown>
    };
  } catch (error) {
    console.error('Erreur envoi email Brevo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    };
  }
}

export async function sendTemplateEmail(options: SendTemplateEmailOptions): Promise<BrevoEmailResponse> {
  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    
    sendSmtpEmail.templateId = options.templateId;
    sendSmtpEmail.params = options.params || {};
    sendSmtpEmail.sender = options.from || {
      name: process.env.BREVO_SENDER_NAME || 'Lili Choose Eat',
      email: process.env.BREVO_SENDER_EMAIL || 'noreply@lili-choose-eat.com'
    };
    
    // Pour les templates avec variables contact, on utilise 'to' avec des attributs
    sendSmtpEmail.to = [{
      email: options.to,
      ...(options.contactAttributes && Object.keys(options.contactAttributes).length > 0 
        ? options.contactAttributes 
        : {})
    }];

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    
    return {
      success: true,
      messageId: result.body?.messageId || null,
      data: result.body as Record<string, unknown>
    };
  } catch (error) {
    console.error('Erreur envoi email template Brevo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    };
  }
}

export async function sendPromoCodeEmail(
  email: string, 
  promoCode: string, 
  prenom?: string
): Promise<BrevoEmailResponse> {
  // Utilise le template ID de votre template Brevo
  const templateId = parseInt(process.env.BREVO_PROMO_TEMPLATE_ID || '1');
  
  return await sendTemplateEmail({
    to: email,
    templateId: templateId,
    contactAttributes: {
      PRENOM: prenom || 'Cher client',
      'code-parrain': promoCode,
      EMAIL: email
    }
  });
}

// Fonction générique pour envoyer d'autres types d'emails avec templates
export async function sendWelcomeEmail(email: string, userName: string): Promise<BrevoEmailResponse> {
  const templateId = parseInt(process.env.BREVO_WELCOME_TEMPLATE_ID || '2');
  
  return await sendTemplateEmail({
    to: email,
    templateId: templateId,
    params: {
      USER_NAME: userName,
      APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://lili-choose-eat.com'
    }
  });
}

export async function sendOrderConfirmationEmail(
  email: string, 
  orderNumber: string, 
  orderTotal: string
): Promise<BrevoEmailResponse> {
  const templateId = parseInt(process.env.BREVO_ORDER_CONFIRMATION_TEMPLATE_ID || '3');
  
  return await sendTemplateEmail({
    to: email,
    templateId: templateId,
    params: {
      ORDER_NUMBER: orderNumber,
      ORDER_TOTAL: orderTotal,
      APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://lili-choose-eat.com'
    }
  });
}
