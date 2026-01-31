import { env } from "@/lib/env";
import { TransactionalEmailsApi, SendSmtpEmail } from "@getbrevo/brevo";

export const emailAPI = new TransactionalEmailsApi();
(emailAPI as any).authentications.apiKey.apiKey = env.BREVO_API_KEY;
