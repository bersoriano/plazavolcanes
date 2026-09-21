import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Fraunces, Instrument_Sans } from "next/font/google";

import { BottomNav } from "@/components/layout/bottom-nav";
import { LaunchBar } from "@/components/layout/launch-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getSiteUrl } from "@/lib/site-url";

import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

// Loaded as a variable only, not applied here: the premium scope in
// globals.css swaps it in by overriding --font-bricolage, the variable the
// compiled `font-display` utility actually reads. An ordinary page never
// touches --font-bricolage, so it keeps Bricolage and this face costs it
// nothing but the stylesheet entry.
const fraunces = Fraunces({
  variable: "--font-fraunces-variable",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Relative canonical and OpenGraph URLs resolve against the live domain.
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Plaza Volcanes",
    template: "%s | Plaza Volcanes",
  },
  description:
    "Descubre productos únicos de tiendas independientes en Plaza Volcanes.",
};

// `viewport-fit=cover` is what lets env(safe-area-inset-*) report anything but
// zero, and the quick-access bar sits in the home indicator's lane.
export const viewport: Viewport = {
  initialScale: 1,
  themeColor: "#b8ff6a",
  viewportFit: "cover",
  width: "device-width",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es-MX"
      className={`${bricolage.variable} ${instrument.variable} ${fraunces.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="antialiased">
        <div className="flex min-h-screen flex-col">
          <LaunchBar />
          <SiteHeader />
          <main className="flex-1 pb-[calc(4.5rem+1px+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>
          <SiteFooter />
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
