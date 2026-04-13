import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#007BFF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "CORREXIA — Correction assistée par IA",
  description:
    "Plateforme de correction automatisée des copies pour les matières scientifiques.",
  icons: {
    icon: [
      { url: "/logo-correxia.svg", type: "image/svg+xml", sizes: "any" },
    ],
    shortcut: "/logo-correxia.svg",
    apple: [{ url: "/logo-correxia.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    title: "CORREXIA",
    statusBarStyle: "default",
  },
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
        className="min-h-[100dvh] bg-gray-100 font-sans antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
