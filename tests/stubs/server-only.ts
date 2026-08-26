// `server-only` is resolved by the Next.js bundler, not by npm, so Vitest needs
// a stand-in before it can import a module that guards itself with it.
export {};
