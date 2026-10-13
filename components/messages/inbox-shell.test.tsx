import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InboxShell } from "@/components/messages/inbox-shell";
import type { InboxEntry } from "@/lib/queries/messages";
import { subscribeToMessageInserts } from "@/lib/realtime-messages";

const refresh = vi.fn();
// One router for the life of the page, as the real hook hands out.
const router = { refresh };
let segment: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSelectedLayoutSegment: () => segment,
}));
vi.mock("@/lib/realtime-messages", () => ({ subscribeToMessageInserts: vi.fn(() => vi.fn()) }));
vi.mock("@/lib/use-viewer-time-zone", () => ({ useViewerTimeZone: () => "America/Mexico_City" }));

const NOW = "2026-10-12T23:00:00Z";

const buying: InboxEntry = {
  id: 1,
  role: "buyer",
  type: "pre_sale",
  order_id: null,
  shop_id: 5,
  shop_name: "Casa Niebla",
  shop_slug: "casa-niebla",
  counterpart_label: "Casa Niebla",
  product: {
    id: 12,
    name: "Taza de barro",
    image_url: "https://cdn.test/taza.jpg",
    price: 250,
    currency_code: "MXN",
    is_available: true,
    href: "/productos/taza-de-barro",
  },
  order_item: null,
  unread_count: 0,
  // 10:42 in Mexico City, the same day as NOW.
  last_message: { body: "Gracias", created_at: "2026-10-12T16:42:00Z", sender_id: "me" },
};

const sellingOrder: InboxEntry = {
  id: 2,
  role: "seller",
  type: "order",
  order_id: 41,
  shop_id: 3,
  shop_name: "Taller Volcán",
  shop_slug: "taller-volcan",
  counterpart_label: "Ana Ruiz",
  product: null,
  order_item: { name: "Reloj de cuerda", image_url: "https://cdn.test/reloj.jpg", more: 1 },
  unread_count: 2,
  last_message: {
    body: "¿Me confirmas el envío?",
    created_at: "2026-10-11T18:00:00Z",
    sender_id: "ana",
  },
};

const sellingEnquiry: InboxEntry = {
  ...sellingOrder,
  id: 3,
  type: "pre_sale",
  order_id: null,
  counterpart_label: "José Peña",
  order_item: null,
  unread_count: 0,
  last_message: { body: "¿Hacen envíos?", created_at: "2026-10-10T18:00:00Z", sender_id: "jose" },
};

const entries = [buying, sellingOrder, sellingEnquiry];

function renderShell(overrides: Partial<Parameters<typeof InboxShell>[0]> = {}) {
  return render(
    <InboxShell currentUserId="me" entries={entries} now={NOW} showSelling {...overrides}>
      <p>panel de la conversación</p>
    </InboxShell>,
  );
}

const row = (name: RegExp) => screen.getByRole("link", { name });
const rowIds = () =>
  within(screen.getByRole("list", { name: "Conversaciones" }))
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"));

beforeEach(() => {
  segment = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("inbox list", () => {
  it("lists what you buy and what you sell together, newest first", () => {
    renderShell();

    expect(rowIds()).toEqual(["/mensajes/1", "/mensajes/2", "/mensajes/3"]);
  });

  it("says on each row which side of it you are on", () => {
    renderShell();

    expect(within(row(/Casa Niebla/)).getByText(/Compra · Consulta/)).toBeInTheDocument();
    expect(within(row(/Ana Ruiz/)).getByText(/Venta · Pedido #41/)).toBeInTheDocument();
    expect(within(row(/José Peña/)).getByText(/Venta · Consulta general/)).toBeInTheDocument();
  });

  it("names what the thread is about", () => {
    renderShell();

    expect(within(row(/Casa Niebla/)).getByText("Taza de barro")).toBeInTheDocument();
    expect(within(row(/Ana Ruiz/)).getByText("Reloj de cuerda y 1 más")).toBeInTheDocument();
  });

  it("shows the picture of the product, or of the order's first line", () => {
    const { container } = renderShell();

    const pictures = [...container.querySelectorAll("img")].map((image) => image.getAttribute("src"));
    expect(pictures).toEqual(["https://cdn.test/taza.jpg", "https://cdn.test/reloj.jpg"]);
    // The words beside each picture already say what it is.
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("previews the last message, and says when it was yours", () => {
    renderShell();

    expect(within(row(/Casa Niebla/)).getByText("Tú: Gracias")).toBeInTheDocument();
    expect(within(row(/Ana Ruiz/)).getByText("¿Me confirmas el envío?")).toBeInTheDocument();
  });

  it("shows the time for today and the day for anything older", () => {
    renderShell();

    expect(within(row(/Casa Niebla/)).getByText("10:42 a.m.")).toBeInTheDocument();
    expect(within(row(/Ana Ruiz/)).getByText("11 oct")).toBeInTheDocument();
  });

  it("counts the messages waiting in a thread", () => {
    renderShell();

    expect(within(row(/Ana Ruiz/)).getByLabelText("2 mensajes sin leer")).toBeInTheDocument();
    expect(within(row(/Casa Niebla/)).queryByLabelText(/sin leer/)).not.toBeInTheDocument();
  });

  it("shows the conversation beside the list", () => {
    renderShell();

    expect(screen.getByText("panel de la conversación")).toBeInTheDocument();
  });
});

describe("inbox filters", () => {
  const filter = (name: RegExp) => screen.getByRole("button", { name });

  it("starts on everything", () => {
    renderShell();

    expect(filter(/^Todos/)).toHaveAttribute("aria-pressed", "true");
    expect(filter(/^Compras/)).toHaveAttribute("aria-pressed", "false");
  });

  it("narrows to what you buy, what you sell, or what is unread", () => {
    renderShell();

    fireEvent.click(filter(/^Compras/));
    expect(rowIds()).toEqual(["/mensajes/1"]);
    expect(filter(/^Compras/)).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(filter(/^Ventas/));
    expect(rowIds()).toEqual(["/mensajes/2", "/mensajes/3"]);

    fireEvent.click(filter(/^Sin leer/));
    expect(rowIds()).toEqual(["/mensajes/2"]);

    fireEvent.click(filter(/^Todos/));
    expect(rowIds()).toHaveLength(3);
  });

  it("puts the unread total on the filters that have any", () => {
    renderShell();

    expect(within(filter(/^Sin leer/)).getByText("2")).toBeInTheDocument();
    expect(within(filter(/^Ventas/)).getByText("2")).toBeInTheDocument();
    expect(within(filter(/^Compras/)).queryByText(/\d/)).not.toBeInTheDocument();
  });

  it("offers no selling filter to somebody who sells nothing", () => {
    renderShell({ entries: [buying], showSelling: false });

    expect(screen.queryByRole("button", { name: /^Ventas/ })).not.toBeInTheDocument();
    expect(filter(/^Compras/)).toBeInTheDocument();
  });

  it("says so when a filter leaves nothing", () => {
    renderShell({ entries: [sellingEnquiry] });

    fireEvent.click(filter(/^Sin leer/));

    expect(screen.getByText("No hay conversaciones aquí.")).toBeInTheDocument();
  });
});

describe("inbox search", () => {
  const search = () => screen.getByRole("searchbox", { name: "Buscar en tus mensajes" });

  it("finds a thread by what its row shows", () => {
    renderShell();

    fireEvent.change(search(), { target: { value: "reloj" } });
    expect(rowIds()).toEqual(["/mensajes/2"]);

    fireEvent.change(search(), { target: { value: "jose pena" } });
    expect(rowIds()).toEqual(["/mensajes/3"]);
  });

  it("says so when nothing matches", () => {
    renderShell();

    fireEvent.change(search(), { target: { value: "bicicleta" } });

    expect(screen.getByText("No hay conversaciones aquí.")).toBeInTheDocument();
  });
});

describe("inbox with a thread open", () => {
  beforeEach(() => {
    segment = "2";
  });

  it("marks the open thread's row", () => {
    renderShell();

    expect(row(/Ana Ruiz/)).toHaveAttribute("aria-current", "page");
    expect(row(/Casa Niebla/)).not.toHaveAttribute("aria-current");
  });

  it("treats the open thread as read", () => {
    renderShell();

    expect(screen.queryByLabelText(/mensajes sin leer/)).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("button", { name: /^Sin leer/ })).queryByText(/\d/),
    ).not.toBeInTheDocument();
  });

  it("keeps the open thread in view under the unread filter", () => {
    renderShell();

    fireEvent.click(screen.getByRole("button", { name: /^Sin leer/ }));

    expect(rowIds()).toEqual(["/mensajes/2"]);
  });

  it("leaves the page heading to the conversation", () => {
    renderShell();

    expect(screen.queryByRole("heading", { name: "Mensajes" })).not.toBeInTheDocument();
    expect(screen.getByText("Mensajes")).toBeInTheDocument();
  });
});

describe("inbox heading", () => {
  it("titles the page while no thread is open", () => {
    renderShell();

    expect(screen.getByRole("heading", { level: 1, name: "Mensajes" })).toBeInTheDocument();
  });
});

describe("empty inbox", () => {
  it("invites a first conversation instead of showing an empty list", () => {
    renderShell({ entries: [] });

    expect(screen.getByText("Aún no tienes mensajes")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explorar productos" })).toHaveAttribute(
      "href",
      "/explorar",
    );
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Todos/ })).not.toBeInTheDocument();
  });

  it("still shows a thread that has no message yet", () => {
    // Asking a shop a question lands here before the first message is written.
    segment = "9";
    renderShell({ entries: [] });

    expect(screen.getByText("panel de la conversación")).toBeInTheDocument();
    expect(screen.queryByText("Aún no tienes mensajes")).not.toBeInTheDocument();
  });
});

describe("inbox freshness", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const subscription = () => vi.mocked(subscribeToMessageInserts).mock.calls[0][0];

  it("listens for messages in every conversation the reader is part of", () => {
    renderShell();

    expect(subscription().conversationId).toBeUndefined();
  });

  it("asks the server again when a message arrives, once per burst", () => {
    renderShell();
    const message = { id: 9, sender_id: "ana", body: "Hola", created_at: NOW };

    act(() => {
      subscription().onInsert(message);
      subscription().onInsert({ ...message, id: 10 });
    });
    expect(refresh).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("asks again when the reader comes back to the tab", () => {
    renderShell();

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(1_000);
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("stops listening when the inbox closes", () => {
    const { unmount } = renderShell();
    const unsubscribe = vi.mocked(subscribeToMessageInserts).mock.results[0].value;

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
