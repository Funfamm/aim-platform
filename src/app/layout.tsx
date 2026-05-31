import type { Metadata, Viewport } from "next";
import { Outfit, Inter, Playfair_Display } from 'next/font/google';
import Script from 'next/script';
import "./globals.css";
import { getCachedSettings } from "@/lib/cached-settings";
import { SearchProvider } from "@/components/search/SearchContext";
import { CsrfProvider } from "@/components/CsrfProvider";

// ── Google Fonts via next/font ──────────────────────────────────────────────
// next/font self-hosts fonts on the same origin, injects preload <link> tags
// at build time, and eliminates the 750ms render-blocking googleapis.com request.
// Only weights actually used in the codebase are included (audited 2026-05-07).
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-display',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-body',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['italic'],
  display: 'swap',
  variable: '--font-serif',
})


export async function generateMetadata(): Promise<Metadata> {
  let siteName = "AIM Studio";
  let tagline = "Creating Cinema with AI";
  try {
    const s = await getCachedSettings();
    if (s?.siteName) siteName = s.siteName;
    if (s?.tagline) tagline = s.tagline;
  } catch { /* use defaults */ }

  const title = `${siteName} | ${tagline}`;
  return {
    title,
    description: `Where artificial intelligence meets cinematic storytelling. ${tagline}`,
    keywords: "AI filmmaking, AI movies, AI filmmaker, casting calls, AI cinema, AIM Studio",
    icons: {
      icon: [
        { url: "/favicon-32x32.png?v=2", sizes: "32x32", type: "image/png" },
        { url: "/favicon-16x16.png?v=2", sizes: "16x16", type: "image/png" },
      ],
      apple: [
        { url: "/apple-touch-icon.png?v=2", sizes: "180x180" },
      ],
    },
    openGraph: {
      title,
      description: `Where artificial intelligence meets cinematic storytelling. ${tagline}`,
      type: "website",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} ${inter.variable} ${playfair.variable}`}>
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=2" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=2" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=2" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0d0f14" />
        <meta name="msapplication-TileColor" content="#0d0f14" />
        {/* iOS PWA — makes the site behave like a native app when installed */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="AIM Studio" />
        {/* Android Chrome — full standalone mode */}
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <CsrfProvider>
          <SearchProvider>
            {children}
          </SearchProvider>
        </CsrfProvider>

        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js')})}`
          }}
        />
        {/* Turnstile loaded globally so window.turnstile is ready before users navigate to any form */}
        <Script
          id="cf-turnstile-script"
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
