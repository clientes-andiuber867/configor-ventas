import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CONFIGOR | Ventas y administración",
  description: "Caja y gestión de CONFIGOR Carnes.",
  applicationName: "CONFIGOR",
  appleWebApp: { capable: true, title: "CONFIGOR" },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=configor-logo", sizes: "any" },
      { url: "/icons/configor-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/configor-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico?v=configor-logo",
    apple: {
      url: "/icons/configor-180.png",
      sizes: "180x180",
      type: "image/png",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
