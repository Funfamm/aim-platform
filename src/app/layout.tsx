import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getCachedSettings } from "@/lib/cached-settings";
import { SearchProvider } from "@/components/search/SearchContext";
import { CsrfProvider } from "@/components/CsrfProvider";


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
            __html: `
(function(){
  try{
    // ── Restore theme ──
    var t=localStorage.getItem('aim-theme');
    if(t==='light') document.documentElement.setAttribute('data-theme','light');
    else if(t==='system'&&window.matchMedia('(prefers-color-scheme:light)').matches) document.documentElement.setAttribute('data-theme','light');

    // ── Restore accent colour ──
    var ACCENTS={
      gold:{base:'#e4b95a',light:'#f5dfa0',dark:'#b8922e',glow:'rgba(228,185,90,0.15)',glowStrong:'rgba(228,185,90,0.25)',lift:'0 8px 30px rgba(228,185,90,0.25),0 2px 8px rgba(228,185,90,0.15)'},
      silver:{base:'#c8c8d4',light:'#e8e8f0',dark:'#8888a0',glow:'rgba(200,200,212,0.15)',glowStrong:'rgba(200,200,212,0.25)',lift:'0 8px 30px rgba(200,200,212,0.25),0 2px 8px rgba(200,200,212,0.15)'},
      ember:{base:'#f06b47',light:'#f9a88e',dark:'#b84820',glow:'rgba(240,107,71,0.15)',glowStrong:'rgba(240,107,71,0.25)',lift:'0 8px 30px rgba(240,107,71,0.25),0 2px 8px rgba(240,107,71,0.15)'},
      jade:{base:'#34d399',light:'#6ee7b7',dark:'#059669',glow:'rgba(52,211,153,0.15)',glowStrong:'rgba(52,211,153,0.25)',lift:'0 8px 30px rgba(52,211,153,0.25),0 2px 8px rgba(52,211,153,0.15)'},
      azure:{base:'#60a5fa',light:'#93c5fd',dark:'#2563eb',glow:'rgba(96,165,250,0.15)',glowStrong:'rgba(96,165,250,0.25)',lift:'0 8px 30px rgba(96,165,250,0.25),0 2px 8px rgba(96,165,250,0.15)'}
    };
    var k=localStorage.getItem('aim-accent');
    var a=k&&ACCENTS[k]?ACCENTS[k]:null;
    if(a){
      var r=document.documentElement.style;
      r.setProperty('--accent-gold',a.base);
      r.setProperty('--accent-gold-light',a.light);
      r.setProperty('--accent-gold-dark',a.dark);
      r.setProperty('--accent-gold-glow',a.glow);
      r.setProperty('--accent-cream',a.dark);
      r.setProperty('--text-accent',a.base);
      r.setProperty('--border-accent',a.base+'55');
      r.setProperty('--border-glow',a.base+'80');
      r.setProperty('--shadow-glow','0 0 40px '+a.glow);
      r.setProperty('--shadow-glow-strong','0 0 80px '+a.glowStrong);
      r.setProperty('--shadow-gold-lift',a.lift);
    }
  }catch(e){}
})();
`
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js')})}`
          }}
        />
      </body>
    </html>
  );
}
