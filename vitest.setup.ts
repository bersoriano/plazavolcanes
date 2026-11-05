import "@testing-library/jest-dom/vitest";

// Recent versions of Node define a global localStorage that stays undefined unless
// started with --localstorage-file. Vitest keeps a global that already exists,
// and window is globalThis here, so jsdom's working one has to be put back.
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom?.window;

if (dom) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: dom.localStorage });
}
