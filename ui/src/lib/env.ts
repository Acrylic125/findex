import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    BOT_KEY: z.string(),
    ENCRYPTION_KEY: z.string(),
    /** Used to verify webhook POSTs are from Telegram. Set the same value in setWebhook(..., { secret_token }). */
    TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
    // BREVO_API_KEY: z.string(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BOT_KEY: process.env.BOT_KEY,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    // BREVO_API_KEY: process.env.BREVO_API_KEY,
  },

  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
   * it as a type mismatch violation. Additionally, if you have an empty string
   * for a value that is supposed to be a string with a default value (e.g.
   * `DOMAIN=` in an ".env" file), the default value will never be applied.
   *
   * In order to solve these issues, we recommend that all new projects
   * explicitly specify this option as true.
   */
  emptyStringAsUndefined: true,
});
