import { vi } from "vitest";

/** Estado controlável de next/navigation nos testes. */
export const navegacao = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
  params: {} as Record<string, string>,
  search: "",
};
