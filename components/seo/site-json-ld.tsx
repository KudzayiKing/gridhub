import { getSiteUrl } from "@/lib/site-url";

export function SiteJsonLd() {
  const siteUrl = getSiteUrl();
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "GridHub",
        url: siteUrl,
        logo: `${siteUrl}/icons/gridhub-mark-on-light.png`,
        email: "support@gridhub.online",
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: "support@gridhub.online",
          availableLanguage: ["English", "Spanish", "Chinese", "Portuguese", "French", "Arabic", "Russian"],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "GridHub",
        url: siteUrl,
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: ["en", "es", "zh-CN", "pt-BR", "fr", "ar", "ru"],
      },
    ],
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
