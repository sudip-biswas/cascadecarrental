import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/host", "/trips", "/messages", "/profile", "/cars/*/checkout"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
