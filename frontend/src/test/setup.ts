import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import * as React from "react";
import { afterEach, vi } from "vitest";
import { navegacao } from "./navegacao";

// Node 25 expõe um `localStorage` global experimental (quebrado sem --localstorage-file) que
// sombreia o do jsdom. Instalamos um Storage em memória confiável para os testes.
class MemoryStorage implements Storage {
  private dados = new Map<string, string>();
  get length() {
    return this.dados.size;
  }
  clear() {
    this.dados.clear();
  }
  getItem(k: string) {
    return this.dados.has(k) ? this.dados.get(k)! : null;
  }
  key(i: number) {
    return [...this.dados.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.dados.delete(k);
  }
  setItem(k: string, v: string) {
    this.dados.set(k, String(v));
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true, writable: true });
}

// jsdom não implementa matchMedia/ResizeObserver (usados por Recharts e Base UI).
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

afterEach(() => {
  cleanup();
  storage.clear();
  navegacao.params = {};
  navegacao.search = "";
  vi.clearAllMocks();
});

// next/link e next/navigation fora do App Router: versões simples para os testes.
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch, ...rest }: { href: string; children: React.ReactNode; prefetch?: unknown } & Record<string, unknown>) => {
    void prefetch;
    return React.createElement("a", { href: String(href), ...rest }, children);
  },
}));

vi.mock("next/navigation", async () => {
  const { navegacao: nav } = await import("./navegacao");
  return {
    useRouter: () => ({ push: nav.push, replace: nav.replace, back: nav.back, refresh: nav.refresh, prefetch: () => {} }),
    useParams: () => nav.params,
    useSearchParams: () => new URLSearchParams(nav.search),
    usePathname: () => "/",
  };
});
