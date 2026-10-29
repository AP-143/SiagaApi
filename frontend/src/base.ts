/**
 * Two build-time settings let the same code run in development and on GitHub Pages:
 *
 * - `VITE_API_BASE_URL`: where the API lives. Empty (development) keeps calling `/api/...`, which the
 *   Vite dev server proxies; set (production) every call goes to that address instead.
 * - `BASE_URL` (Vite's `base`, from `VITE_BASE_PATH`): the folder the site is served from, `/` or
 *   `/SiagaApi/` on Pages.
 *
 * Both are read when called, not when the module loads, so a test can change them.
 */

/** The address of an API route such as `/hotspots`. */
export function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
  return `${base || "/api"}${path}`;
}

/** The folder the site is served from, without a trailing slash: "" at the root, "/SiagaApi" on Pages. */
function siteFolder(): string {
  return (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");
}

/** A site address such as `/peta` or `/landing/hero.webp`, put under the folder the site is served from. */
export function withBase(path: string): string {
  return `${siteFolder()}${path}`;
}

/** The path of the current page inside the site: `/SiagaApi/peta` is `/peta`, and the home page is `/`. */
export function pathInSite(pathname: string): string {
  const folder = siteFolder();
  const inside = folder && pathname.startsWith(folder) ? pathname.slice(folder.length) : pathname;
  return inside.replace(/\/+$/, "") || "/";
}
