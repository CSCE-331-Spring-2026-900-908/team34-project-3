import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";

import "@/app/globals.css";
import { PageTranslator } from "@/components/page-translator";
import { AppToaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Boba POS",
  description: "Basic boba shop point-of-sale app for a school project."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={GeistSans.className}>
      <body>
        <PageTranslator />
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
