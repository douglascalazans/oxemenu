import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "OxeMenu",
  title: {
    default: "OxeMenu | Seu Cardápio Digital",
    template: "%s | OxeMenu",
  },
  description:
    "Cardápios digitais profissionais para restaurantes, cafeterias, lanchonetes e pequenos negócios.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/oxemenu-logo-transparent.png",
    shortcut: "/oxemenu-logo-transparent.png",
    apple: "/oxemenu-logo-transparent.png",
  },
  openGraph: {
    title: "OxeMenu | Seu Cardápio Digital",
    description:
      "Cardápios digitais profissionais para restaurantes, cafeterias, lanchonetes e pequenos negócios.",
    siteName: "OxeMenu",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/oxemenu-logo-transparent.png",
        width: 680,
        height: 220,
        alt: "OxeMenu — Seu Cardápio Digital",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OxeMenu | Seu Cardápio Digital",
    description:
      "Cardápios digitais profissionais para restaurantes, cafeterias, lanchonetes e pequenos negócios.",
    images: ["/oxemenu-logo-transparent.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
