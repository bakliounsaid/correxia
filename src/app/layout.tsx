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
      { url: "/logo-correxia-mark.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/logo-correxia-mark.png",
    apple: [{ url: "/logo-correxia-mark.png", type: "image/png", sizes: "512x512" }],
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
