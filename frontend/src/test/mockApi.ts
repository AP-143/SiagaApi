import { vi } from "vitest";

type Route = unknown | ((url: URL, init?: RequestInit) => Response | Promise<Response>);

/**
 * Replace the network with canned responses keyed by path (without the /api prefix). A plain value
 * is returned as JSON; a function gets the URL and the request options (method, body) and returns
 * a Response, so a test can vary the answer or fail it.
 */
export function mockApi(routes: Record<string, Route>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const path = url.pathname.replace(/^\/api/, "");
    if (!(path in routes)) return new Response("not found", { status: 404 });
    const route = routes[path];
    if (typeof route === "function") {
      return (route as (url: URL, init?: RequestInit) => Response | Promise<Response>)(url, init);
    }
    return new Response(JSON.stringify(route), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
