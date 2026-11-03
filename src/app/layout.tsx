import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { jsonLd, NOME_SITE, podeIndexar, URL_SITE } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🇧🇷</text></svg>",
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", "@id": `${URL_SITE}/#organizacao`, name: NOME_SITE, url: URL_SITE },
            { "@type": "WebSite", "@id": `${URL_SITE}/#site`, name: NOME_SITE, url: URL_SITE, inLanguage: "pt-BR", publisher: { "@id": `${URL_SITE}/#organizacao` } },
          ],
        }) }} />
        {children}
      </body>
    </html>
  );
}
