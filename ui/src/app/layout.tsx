import type { PropsWithChildren } from "react";
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

import { I18nProvider } from "@/core/i18n/provider";

import "@telegram-apps/telegram-ui/dist/styles.css";
import "normalize.css/normalize.css";
import "./_assets/globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Your Application Title Goes Here",
  description: "Your application description goes here",
};

export default async function RootLayout({ children }: PropsWithChildren) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <I18nProvider>
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
