const PRODUCTION_SITE_URL = "https://www.gridhub.online";

/** Returns the public base URL, never allowing a local URL to leak into production metadata. */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    if (!configured) return PRODUCTION_SITE_URL;

    try {
      const url = new URL(configured);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return PRODUCTION_SITE_URL;
      if (url.hostname === "gridhub.online") url.hostname = "www.gridhub.online";
      return url.origin;
    } catch {
      return PRODUCTION_SITE_URL;
    }
  }

  if (!configured) return "http://localhost:3000";
  try {
    return new URL(configured).origin;
  } catch {
    return "http://localhost:3000";
  }
}
