import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";

import "@/app/globals.css";
import { PageTranslator } from "@/components/page-translator";
import { AppToaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Brew 34",
  description: "Point-of-sale and customer ordering app for Brew 34.",
  icons: {
    icon: "/bobashop.png",
    shortcut: "/bobashop.png",
    apple: "/bobashop.png"
  }
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
