"use client";

import { MessageCircle, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

type ShareActionsProps = {
  label: string;
  title: string;
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

export function ShareActions({ label, title }: ShareActionsProps) {
  const pageUrl = useSyncExternalStore(
    subscribeToLocation,
    getLocationSnapshot,
    getServerLocationSnapshot,
  );
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
    const url = pageUrl || window.location.href;
    setStatus(null);

    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    await copyLink(url);
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
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-brand transition-colors hover:border-brand"
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
