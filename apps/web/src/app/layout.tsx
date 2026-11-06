import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { preconnect } from "react-dom";
import { AppearanceProvider } from "@/components/providers/appearance-provider";
import { DemoSessionProvider } from "@/components/providers/demo-session";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "SpecDesk — from app idea to buildable plan", template: "%s · SpecDesk" },
  description:
    "Describe your app idea. SpecDesk's AI agents ask the right questions and give you features, screens, tech stack, timeline and a price range — with PDF and Markdown files.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Warm up the Calendly connection so the booking panel opens fast.
  preconnect("https://calendly.com");
  preconnect("https://assets.calendly.com");
  return (
    <html lang="en" className={cn(geistSans.variable, geistMono.variable, inter.variable, "antialiased")} suppressHydrationWarning>
      <body className="min-h-svh bg-background font-sans text-foreground">
        <AppearanceProvider>
          <DemoSessionProvider>
            <TooltipProvider delayDuration={200}>
              {children}
              <Toaster position="bottom-right" richColors />
            </TooltipProvider>
          </DemoSessionProvider>
        </AppearanceProvider>
      </body>
    </html>
  );
}
