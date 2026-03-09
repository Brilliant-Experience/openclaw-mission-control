import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SetupGate } from "@/components/setup-gate";
import { Sidebar } from "@/components/sidebar";
import { OpsConsole } from "@/components/ops-console";
import { OpsContextProvider } from "@/components/ops-context-provider";
import { MobileNav } from "@/components/mobile-nav";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mission Control",
  description: "Brilliant Experience — Agent Operations Dashboard",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mission Control",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />
        {/* Apple touch icon */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        {/* iOS splash screens — single fallback for all sizes.
            Production should use device-specific images per Apple's spec. */}
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-splash-fallback.png"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-splash-fallback.png"
          media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-splash-fallback.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-splash-fallback.png"
          media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-splash-fallback.png"
          media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-splash-fallback.png"
          media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)"
        />
        {/* iPhone 16 Pro / 16 Pro Max */}
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-splash-fallback.png"
          media="(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-splash-fallback.png"
          media="(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <OpsContextProvider>
            <SetupGate>
              <div className="flex h-screen w-full overflow-hidden">
                <Sidebar />
                <main className="relative flex flex-1 flex-col overflow-hidden min-w-0 pb-14 md:pb-0">
                  {children}
                </main>
                <OpsConsole />
              </div>
            </SetupGate>
          </OpsContextProvider>
        </ThemeProvider>
          {/* Mobile bottom tab bar — fixed, rendered outside the flex container
              so it overlays content rather than participating in layout flow */}
          <MobileNav />

        {/* Service worker registration */}
        <Script id="sw-register" strategy="afterInteractive" src="data:text/javascript,if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{})" />
      </body>
    </html>
  );
}
