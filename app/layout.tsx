import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { getSiteUrl } from "@/lib/site-url";
import { SiteJsonLd } from "@/components/seo/site-json-ld";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const appUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Gridhub — One hub. Everything organized.",
    template: "%s · Gridhub",
  },
  description:
    "Your money. Your business. Your life. Your work. One intelligent workspace.",
  applicationName: "Gridhub",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Gridhub",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    siteName: "Gridhub",
    title: "Gridhub — One hub. Everything organized.",
    description:
      "Your money. Your business. Your life. Your work. One intelligent workspace.",
    url: appUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Gridhub — One hub. Everything organized.",
    description: "Your money. Your business. Your life. Your work. One intelligent workspace.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // The header's glass over the flat canvas — not the canvas itself. Reporting `--bg` left a
  // visible step under the status bar, because a translucent header over #f7f7f2 is lighter
  // than #f7f7f2. Providers recomputes this per theme; this is the light default first paint
  // uses, and it must match `manifest.theme_color`.
  themeColor: "#FCFCFA",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${manrope.variable}`}>
      <body>
        <SiteJsonLd />
        <div className="gp-ambient" aria-hidden="true" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
