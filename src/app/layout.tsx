import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MetricasWeb } from "./MetricasWeb";
import { Analytics } from "@/components/Analytics";
import { jsonLd, NOME_SITE, podeIndexar, URL_SITE } from "@/lib/seo";

const geistSans = Geist({
  variable: "--fonte-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--fonte-mono",
  subsets: ["latin"],
});

const TITULO = "Desempenho do Governo";
const DESCRICAO =
  "Os indicadores econômicos de cada mandato presidencial desde o Plano Real, " +
  "calculados do mesmo jeito para todos e comparados com o resto do mundo.";

export const metadata: Metadata = {
  metadataBase: new URL(URL_SITE),
  title: TITULO,
  description: DESCRICAO,
  robots: { index: podeIndexar(), follow: true },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
  openGraph: {
    title: TITULO,
    description: DESCRICAO,
    type: "website",
    locale: "pt_BR",
    siteName: TITULO,
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRICAO,
  },
  icons: {
    icon: [{ url: "/icone.svg", type: "image/svg+xml", sizes: "any" }, { url: "/icone-32.png", type: "image/png", sizes: "32x32" }, { url: "/icone-192.png", type: "image/png", sizes: "192x192" }],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} ${geistSans.className}`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", "@id": `${URL_SITE}/#organizacao`, name: NOME_SITE, url: URL_SITE, description: "Projeto de organização e leitura de indicadores públicos.", subjectOf: { "@type": "AboutPage", url: `${URL_SITE}/sobre` }, contactPoint: { "@type": "ContactPoint", contactType: "Correções de conteúdo", url: `${URL_SITE}/correcoes`, availableLanguage: "pt-BR" } },
            { "@type": "WebSite", "@id": `${URL_SITE}/#site`, name: NOME_SITE, url: URL_SITE, inLanguage: "pt-BR", publisher: { "@id": `${URL_SITE}/#organizacao` } },
          ],
        }) }} />
        {children}
        <Analytics />
        {process.env.NEXT_PUBLIC_WEB_VITALS==='true' && <MetricasWeb/>}
      </body>
    </html>
  );
}
