import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CORREXIA — Correction assistée par IA",
  description:
    "Plateforme de correction automatisée des copies pour les matières scientifiques.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-screen bg-gray-100 font-sans antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
