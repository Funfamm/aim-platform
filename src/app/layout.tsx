import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getCachedSettings } from "@/lib/cached-settings";

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
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#D4A853" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js')})}`
          }}
        />
      </body>
    </html>
  );
}
