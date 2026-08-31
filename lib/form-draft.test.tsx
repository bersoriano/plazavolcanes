import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useFormDraft } from "@/lib/form-draft";

/** jsdom ships no working localStorage here, so the test brings its own. */
function memoryStorage() {
  const entries = new Map<string, string>();

  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
    clear: () => entries.clear(),
    key: (index: number) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size;
    },
  } satisfies Storage;
}

function installStorage(storage: Storage) {
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
}

function Subject({ initial = "" }: { initial?: string }) {
  const { clear, formRef, save } = useFormDraft("prueba");

  return (
    <form onInput={save} ref={formRef}>
      <input aria-label="nombre" defaultValue={initial} name="name" />
      <textarea aria-label="descripcion" name="description" />
      <button onClick={clear} type="button">
        limpiar
      </button>
    </form>
  );
}

beforeEach(() => installStorage(memoryStorage()));
// vitest runs without globals here, so React Testing Library never registers
// its own cleanup and rendered trees would otherwise pile up across tests.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("useFormDraft", () => {
  it("keeps what was typed so a crashed tab does not lose it", () => {
    render(<Subject />);

    fireEvent.input(screen.getByLabelText("descripcion"), {
      target: { value: "Barro negro de Oaxaca" },
    });
    cleanup();

    render(<Subject />);
    expect(screen.getByLabelText("descripcion")).toHaveValue("Barro negro de Oaxaca");
  });

  it("does not overwrite a value already on screen", () => {
    render(<Subject />);
    fireEvent.input(screen.getByLabelText("nombre"), { target: { value: "Borrador" } });
    cleanup();

    render(<Subject initial="Guardado" />);
    expect(screen.getByLabelText("nombre")).toHaveValue("Guardado");
  });

  it("forgets the draft once it is cleared", () => {
    render(<Subject />);
    fireEvent.input(screen.getByLabelText("nombre"), { target: { value: "Taza" } });
    fireEvent.click(screen.getByRole("button", { name: "limpiar" }));
    cleanup();

    render(<Subject />);
    expect(screen.getByLabelText("nombre")).toHaveValue("");
  });

  it("survives a browser that refuses local storage", () => {
    // A private window throws on access rather than returning nothing.
    installStorage({
      ...memoryStorage(),
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    } as Storage);

    expect(() => render(<Subject />)).not.toThrow();
    expect(() =>
      fireEvent.input(screen.getByLabelText("nombre"), { target: { value: "Taza" } }),
    ).not.toThrow();
  });
});
