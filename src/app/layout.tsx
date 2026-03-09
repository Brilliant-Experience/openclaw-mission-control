import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SetupGate } from "@/components/setup-gate";
import { Sidebar } from "@/components/sidebar";
import { OpsConsole } from "@/components/ops-console";
import { OpsContextProvider } from "@/components/ops-context-provider";

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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
                <main className="relative flex flex-1 flex-col overflow-hidden min-w-0">
                  {children}
                </main>
                <OpsConsole />
              </div>
            </SetupGate>
          </OpsContextProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
