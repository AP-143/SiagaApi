import { afterEach, describe, expect, it, vi } from "vitest";

import { apiUrl, pathInSite, withBase } from "./base";

afterEach(() => vi.unstubAllEnvs());

describe("apiUrl", () => {
  it("keeps the /api prefix of the dev proxy when no API address is set", () => {
    vi.stubEnv("VITE_API_BASE_URL", "");

    expect(apiUrl("/hotspots")).toBe("/api/hotspots");
  });

  it("goes to the configured API address when one is set, ignoring a trailing slash", () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://siagaapi.onrender.com/");

    expect(apiUrl("/hotspots")).toBe("https://siagaapi.onrender.com/hotspots");
    expect(apiUrl("/chat")).toBe("https://siagaapi.onrender.com/chat");
  });
});

describe("site addresses under a folder", () => {
  it("leave paths as they are at the root", () => {
    vi.stubEnv("BASE_URL", "/");

    expect(withBase("/peta")).toBe("/peta");
    expect(withBase("/landing/hero-night.webp")).toBe("/landing/hero-night.webp");
    expect(withBase("/")).toBe("/");
    expect(pathInSite("/peta")).toBe("/peta");
    expect(pathInSite("/")).toBe("/");
  });

  it("are put under the folder the site is served from", () => {
    vi.stubEnv("BASE_URL", "/SiagaApi/");

    expect(withBase("/peta")).toBe("/SiagaApi/peta");
    expect(withBase("/landing/hero-night.webp")).toBe("/SiagaApi/landing/hero-night.webp");
    expect(withBase("/")).toBe("/SiagaApi/");
  });

  it("are read back from the current address, with or without a trailing slash", () => {
    vi.stubEnv("BASE_URL", "/SiagaApi/");

    expect(pathInSite("/SiagaApi/peta")).toBe("/peta");
    expect(pathInSite("/SiagaApi/peta/")).toBe("/peta");
    expect(pathInSite("/SiagaApi/")).toBe("/");
    expect(pathInSite("/SiagaApi")).toBe("/");
  });
});
