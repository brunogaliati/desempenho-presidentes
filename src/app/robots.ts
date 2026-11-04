import type { MetadataRoute } from "next";
import { podeIndexar, URL_SITE } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  // As URLs legadas continuam rastreáveis para que os robôs leiam os redirects.
  return podeIndexar()
    ? { rules: { userAgent: "*", allow: "/", disallow: "/api/" }, sitemap: `${URL_SITE}/sitemap.xml` }
    : { rules: { userAgent: "*", disallow: "/" } };
}
