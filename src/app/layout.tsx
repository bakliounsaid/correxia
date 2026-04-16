import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#007BFF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "CORREX IA",
  description:
    "Plateforme de correction automatisée des copies pour les matières scientifiques.",
  icons: {
    icon: [
      { url: "/logo-correxia.svg?v=2", type: "image/svg+xml" },
      { url: "/logo-correxia-mark.png?v=2", type: "image/png", sizes: "32x32" },
      { url: "/logo-correxia-mark.png?v=2", type: "image/png", sizes: "192x192" },
      { url: "/logo-correxia-mark.png?v=2", type: "image/png", sizes: "512x512" },
    ],
    shortcut: [{ url: "/logo-correxia-mark.png?v=2", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/logo-correxia-mark.png?v=2", type: "image/png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "CORREX IA",
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
        <link rel="icon" href="/logo-correxia.svg?v=2" type="image/svg+xml" />
        <link rel="icon" href="/logo-correxia-mark.png?v=2" sizes="32x32" type="image/png" />
        <link rel="apple-touch-icon" href="/logo-correxia-mark.png?v=2" sizes="180x180" />
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
