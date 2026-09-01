import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";

import { BottomNav } from "@/components/layout/bottom-nav";
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
      lang="es"
      className={`${bricolage.variable} ${instrument.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="antialiased">
        <div className="flex min-h-screen flex-col">
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
