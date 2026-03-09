import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { Header, AgentChatPanel } from "@/components/header";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { ThemeProvider } from "@/components/theme-provider";
import { ChatNotificationToast } from "@/components/chat-notification-toast";
import { RestartAnnouncementBar } from "@/components/restart-announcement-bar";
import { SetupGate } from "@/components/setup-gate";
import { UsageAlertMonitor } from "@/components/usage-alert-monitor";
import { OpenClawUpdateBanner } from "@/components/openclaw-update-banner";
import { OpsConsole } from "@/components/ops-console";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const isHosted = process.env.AGENTBAY_HOSTED === "true";

export const metadata: Metadata = {
  title: "Mission Control — Dark Ops Intelligence Center",
  description:
    "Mission Control — Dark Ops Intelligence Center. " +
    "Monitor, chat with, and manage your local AI agents, models, cron jobs, " +
    "vector memory, and skills — all from a single local AI management tool " +
    "that runs entirely on your machine.",
  keywords: [
    "OpenClaw GUI",
    "AI agent dashboard",
    "local AI management tool",
    "OpenClaw dashboard",
    "AI agent manager",
    "local AI assistant",
    "OpenClaw Mission Control",
    "self-hosted AI dashboard",
    "AI agent monitoring",
    "open source AI GUI",
    "AI model management",
    "AI cron jobs",
    "vector memory dashboard",
    "LLM management tool",
    "private AI",
  ],
  manifest: isHosted ? undefined : "/manifest.json",
  applicationName: "Mission Control — Dark Ops Intelligence Center",
  authors: [{ name: "Brilliant Experience" }],
  creator: "Brilliant Experience",
  publisher: "Brilliant Experience",
  category: "technology",
  openGraph: {
    type: "website",
    siteName: "Mission Control — Dark Ops Intelligence Center",
    title: "Mission Control — Dark Ops Intelligence Center",
    description:
      "Monitor, chat with, and manage your local AI agents from one sleek dashboard.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mission Control — Dark Ops Intelligence Center",
    description:
      "Monitor, chat with, and manage your local AI agents from one sleek dashboard.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mission Control",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#101214",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icons/icon-192.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <SetupGate>
            <KeyboardShortcuts />
            <div className="flex h-screen overflow-hidden bg-stone-50 text-stone-900 dark:bg-[#101214] dark:text-stone-100">
              <Sidebar />
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <Header />
                <RestartAnnouncementBar />
                <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-stone-50 dark:bg-[#101214]">
                  {children}
                </main>
              </div>
              <OpsConsole />
            </div>
            <AgentChatPanel />
            <ChatNotificationToast />
            {!isHosted && <OpenClawUpdateBanner />}
            {!isHosted && <UsageAlertMonitor />}
          </SetupGate>
        </ThemeProvider>
      </body>
    </html>
  );
}
