import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getCachedSettings } from "@/lib/cached-settings";
import { SearchProvider } from "@/components/search/SearchContext";

export async function generateMetadata(): Promise<Metadata> {
  let siteName = "AIM Studio";
  let tagline = "AI-Powered Filmmaking";
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
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      ],
      apple: [
        { url: "/apple-touch-icon.png", sizes: "180x180" },
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
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0d0f14" />
        <meta name="msapplication-TileColor" content="#0d0f14" />
      </head>
      <body className="antigravity-scroll-lock">
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
                <SearchProvider>
          {children}
        </SearchProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js')})}`
          }}
        />
      </body>
    </html>
  );
}
