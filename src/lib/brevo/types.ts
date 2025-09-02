export interface BrevoEmailResponse {
  success: boolean;
  messageId?: string | null;
  data?: Record<string, unknown>;
  error?: string;
}

export interface BrevoSender {
  email: string;
  name: string;
}

export interface BrevoRecipient {
  email: string;
  name?: string;
}
