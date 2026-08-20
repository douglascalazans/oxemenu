import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const privateCacheHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
      { source: "/admin/:path*", headers: privateCacheHeaders },
      { source: "/painel/:path*", headers: privateCacheHeaders },
      { source: "/conta", headers: privateCacheHeaders },
      { source: "/api/admin/:path*", headers: privateCacheHeaders },
      { source: "/api/manage/:path*", headers: privateCacheHeaders },
      { source: "/api/merchant/:path*", headers: privateCacheHeaders },
      { source: "/api/auth/:path*", headers: privateCacheHeaders },
      { source: "/api/session", headers: privateCacheHeaders },
      { source: "/api/uploads", headers: privateCacheHeaders },
    ];
  },
};

export default nextConfig;
