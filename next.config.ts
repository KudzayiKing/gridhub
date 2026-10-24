import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * `cacheComponents` is deliberately OFF.
   *
   * Gridhub keeps all user data in IndexedDB and renders it client-side; the only
   * server-side dynamic reads are the Supabase session cookie in `app/app/layout.tsx`
   * and the auth callback route. Cache Components requires every `cookies()` read to
   * sit inside a `<Suspense>` boundary or a `'use cache'` scope, which would force an
   * async-shell split we get no benefit from. Enabling it would trade a real class of
   * build failures for zero performance gain on these routes.
   */
  cacheComponents: false,
  reactCompiler: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
