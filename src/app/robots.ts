import type { MetadataRoute } from "next";
import { podeIndexar, URL_SITE } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  // Protótipos continuam rastreáveis para que os robôs leiam o noindex.
  return podeIndexar()
    ? { rules: { userAgent: "*", allow: "/", disallow: "/api/" }, sitemap: `${URL_SITE}/sitemap.xml` }
    : { rules: { userAgent: "*", disallow: "/" } };
}
