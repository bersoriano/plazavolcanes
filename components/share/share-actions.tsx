"use client";

import { MessageCircle, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

type ShareActionsProps = {
  label: string;
  title: string;
  /**
   * The address to share. Pages that are themselves the thing being shared
   * leave it out and share where the visitor is; the seller panel shares the
   * public shop, which is not the page the seller has open.
   */
  url?: string;
};

function subscribeToLocation() {
  return () => undefined;
}

function getLocationSnapshot() {
  return window.location.href;
}

function getServerLocationSnapshot() {
  return "";
}

export function ShareActions({ label, title, url }: ShareActionsProps) {
  const locationUrl = useSyncExternalStore(
    subscribeToLocation,
    getLocationSnapshot,
    getServerLocationSnapshot,
  );
  const pageUrl = url ?? locationUrl;
  const [status, setStatus] = useState<"copied" | "error" | null>(null);
  const shareText = `Descubre ${title} en Plaza Volcanes.`;

  async function copyLink(url: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  async function share() {
    const shareUrl = pageUrl || window.location.href;
    setStatus(null);

    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url: shareUrl });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    await copyLink(shareUrl);
  }

  const whatsappMessage = pageUrl ? encodeURIComponent(`${shareText}\n${pageUrl}`) : "";

  return (
    <div aria-label={label} className="flex flex-wrap items-center gap-3" role="group">
      <Button onClick={share} variant="secondary">
        <Share2 aria-hidden="true" className="size-4" />
        Compartir
      </Button>
      <a
        aria-label="Compartir por WhatsApp"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-surface-raised px-5 py-2.5 text-sm font-semibold text-brand transition-colors hover:border-brand"
        href={whatsappMessage ? `https://wa.me/?text=${whatsappMessage}` : "https://wa.me/"}
        rel="noopener noreferrer"
        target="_blank"
      >
        <MessageCircle aria-hidden="true" className="size-4" />
        WhatsApp
      </a>
      {status ? (
        <p
          className={`basis-full text-sm font-medium ${status === "copied" ? "text-success" : "text-sale"}`}
          role="status"
        >
          {status === "copied" ? "Enlace copiado." : "No pudimos copiar el enlace."}
        </p>
      ) : null}
    </div>
  );
}
