import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { getSiteUrl } from "@/lib/site-url";

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFDFA" },
    { media: "(prefers-color-scheme: dark)", color: "#1D1D22" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${manrope.variable}`}>
      <body>
        <div className="gp-ambient" aria-hidden="true" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
