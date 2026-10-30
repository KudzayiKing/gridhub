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
  // The product has its own locale selector and static reviewed translations. Prevent
  // browser page-translation from retranslating those strings inconsistently per device.
  other: { google: "notranslate" },
  applicationName: "Gridhub",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Gridhub",
    // Start edge-to-edge on iOS. Providers switches to the light-icon-safe default
    // when the active app theme is light.
    statusBarStyle: "black-translucent",
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
  // Native browser/system bars need a solid fallback. The client updates this to the active
  // light or dark chrome token after the selected theme is available.
  themeColor: "#fcfcfa",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" translate="no" suppressHydrationWarning className={`${inter.variable} ${manrope.variable} notranslate`}>
      <body>
        <SiteJsonLd />
        <div className="gp-ambient" aria-hidden="true" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
