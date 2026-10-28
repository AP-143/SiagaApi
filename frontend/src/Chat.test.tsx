import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "./App";
import { createdMaps, openPopups } from "./test/fakeMapLibre";
import { SAMBAS_HOTSPOT, collection } from "./test/hotspotFixtures";
import { mockApi } from "./test/mockApi";

vi.mock("maplibre-gl", async () => (await import("./test/fakeMapLibre")).fakeMapLibreModule);

type Reply = { kind: string; answer: string; data: Record<string, unknown> };

const COUNT_REPLY: Reply = {
  kind: "count",
  answer: "Dalam 24 jam terakhir ada 3.295 titik api di Provinsi Kalimantan Tengah.",
  data: { count: 3295 },
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

function setup(
  chat: (url: URL, init?: RequestInit) => Response | Promise<Response> = () => json(COUNT_REPLY),
  address = "/",
  /** What /chat/status says; left out, the route does not exist, like an older server. */
  status?: { ai: boolean },
) {
  window.history.replaceState({}, "", address);
  const fetchMock = mockApi({
    ...(status ? { "/chat/status": status } : {}),
    "/hotspots": collection(SAMBAS_HOTSPOT),
    "/hotspots/counts": [],
    "/provinces": [],
    "/freshness": { last_updated: "2026-10-16T07:00:00Z", stale: false },
    "/layers/peatlands": { type: "FeatureCollection", features: [] },
    "/layers/provinces": { type: "FeatureCollection", features: [] },
    "/chat": chat,
  });
  render(<App />);
  return fetchMock;
}

function chatRequests(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls.filter(
    ([url]) => new URL(String(url), "http://localhost").pathname === "/api/chat",
  );
}

async function openChat() {
  await userEvent.click(screen.getByRole("button", { name: "Tanya" }));
  return screen.getByRole("log", { name: "Percakapan" });
}

async function ask(text: string) {
  await userEvent.type(screen.getByRole("textbox", { name: "Pertanyaan" }), text);
  await userEvent.click(screen.getByRole("button", { name: "Kirim" }));
}

beforeEach(() => {
  createdMaps.length = 0;
  openPopups.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

// ---- The panel itself ---------------------------------------------------------------------------

test("the chat starts closed so the map stays in view", () => {
  setup();

  expect(screen.getByRole("button", { name: "Tanya" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("textbox", { name: "Pertanyaan" })).toBeNull();
});

test("opening the chat shows a greeting that says what it can answer", async () => {
  setup();

  const log = await openChat();

  expect(within(log).getByText(/jumlah titik api per wilayah/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Tanya" })).toHaveAttribute("aria-expanded", "true");
});

test("the chat warns that a Hotspot is a satellite detection, not a confirmed fire", async () => {
  setup();
  await openChat();

  expect(screen.getByText(/deteksi satelit/)).toBeInTheDocument();
});

test("the greeting offers example questions to tap", async () => {
  setup();
  await openChat();

  expect(screen.getByRole("button", { name: /Berapa titik api di Kalimantan Tengah/ })).toBeInTheDocument();
});

// ---- Asking -------------------------------------------------------------------------------------

test("a question is sent to the server and the answer appears under it", async () => {
  const fetchMock = setup();
  const log = await openChat();

  await ask("Berapa titik api di Kalteng?");

  expect(await within(log).findByText(/3\.295 titik api/)).toBeInTheDocument();
  expect(within(log).getByText("Berapa titik api di Kalteng?")).toBeInTheDocument();
  const [[, init]] = chatRequests(fetchMock);
  expect(init?.method).toBe("POST");
  expect(JSON.parse(String(init?.body))).toEqual({ message: "Berapa titik api di Kalteng?" });
});

test("pressing Enter sends the question too", async () => {
  const fetchMock = setup();
  await openChat();

  await userEvent.type(screen.getByRole("textbox", { name: "Pertanyaan" }), "Kapan data diperbarui?{Enter}");

  await waitFor(() => expect(chatRequests(fetchMock)).toHaveLength(1));
});

test("Shift+Enter adds a new line instead of sending", async () => {
  const fetchMock = setup();
  await openChat();

  await userEvent.type(screen.getByRole("textbox", { name: "Pertanyaan" }), "baris satu{Shift>}{Enter}{/Shift}baris dua");

  expect(chatRequests(fetchMock)).toHaveLength(0);
  expect(screen.getByRole("textbox", { name: "Pertanyaan" })).toHaveValue("baris satu\nbaris dua");
});

test("the box is emptied once the question is sent", async () => {
  setup();
  await openChat();

  await ask("Berapa titik api?");

  expect(screen.getByRole("textbox", { name: "Pertanyaan" })).toHaveValue("");
});

test("an empty or blank question cannot be sent", async () => {
  const fetchMock = setup();
  await openChat();

  expect(screen.getByRole("button", { name: "Kirim" })).toBeDisabled();
  await userEvent.type(screen.getByRole("textbox", { name: "Pertanyaan" }), "   ");
  expect(screen.getByRole("button", { name: "Kirim" })).toBeDisabled();
  expect(chatRequests(fetchMock)).toHaveLength(0);
});

test("a question is limited to the length the server accepts", async () => {
  setup();
  await openChat();

  expect(screen.getByRole("textbox", { name: "Pertanyaan" })).toHaveAttribute("maxlength", "500");
});

test("while waiting for an answer the chat says so and does not send twice", async () => {
  let release: (response: Response) => void = () => {};
  const waiting = new Promise<Response>((resolve) => (release = resolve));
  const fetchMock = setup(() => waiting);
  await openChat();

  await ask("Berapa titik api?");

  expect(await screen.findByText("Sedang menjawab…")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Kirim" })).toBeDisabled();
  release(json(COUNT_REPLY));
  await waitFor(() => expect(screen.queryByText("Sedang menjawab…")).toBeNull());
  expect(chatRequests(fetchMock)).toHaveLength(1);
});

test("a tapped example question is asked right away", async () => {
  const fetchMock = setup();
  await openChat();

  await userEvent.click(screen.getByRole("button", { name: /Kapan data terakhir diperbarui/ }));

  await waitFor(() => expect(chatRequests(fetchMock)).toHaveLength(1));
  expect(JSON.parse(String(chatRequests(fetchMock)[0][1]?.body)).message).toBe("Kapan data terakhir diperbarui?");
});

test("conversation order is kept: question, answer, question, answer", async () => {
  let n = 0;
  setup(() => json({ kind: "count", answer: `Jawaban nomor ${++n}`, data: {} }));
  const log = await openChat();

  await ask("pertama");
  await within(log).findByText("Jawaban nomor 1");
  await ask("kedua");
  await within(log).findByText("Jawaban nomor 2");

  const text = log.textContent ?? "";
  expect(text.indexOf("pertama")).toBeLessThan(text.indexOf("Jawaban nomor 1"));
  expect(text.indexOf("Jawaban nomor 1")).toBeLessThan(text.indexOf("kedua"));
  expect(text.indexOf("kedua")).toBeLessThan(text.indexOf("Jawaban nomor 2"));
});

// ---- Answers are text, never markup -------------------------------------------------------------

test("an answer containing HTML is shown literally and never becomes markup", async () => {
  setup(() => json({ kind: "count", answer: "<img src=x onerror=alert(1)> <b>tebal</b>", data: {} }));
  const log = await openChat();

  await ask("coba");

  expect(await within(log).findByText(/<b>tebal<\/b>/)).toBeInTheDocument();
  expect(log.querySelector("img, b")).toBeNull();
});

const RANKING_ANSWER = [
  "Peringkat 5 teratas kabupaten/kota berdasarkan jumlah titik api di Kalimantan dalam 24 jam terakhir:",
  "1. Seruyan: 1.027 titik api",
  "2. Ketapang: 798 titik api",
  "3. Kotawaringin Barat: 662 titik api",
  "Data terakhir diperbarui 16 Okt 2026, 23.34 WIB.",
  "Ini deteksi satelit, belum tentu kebakaran yang sudah terkonfirmasi.",
].join("\n");

function rankingReply(answer = RANKING_ANSWER): Reply {
  return { kind: "ranking", answer, data: { ranking: [{ name: "Seruyan", count: 1027 }] } };
}

test("a ranking is shown as a list with the name on one side and the count on the other", async () => {
  setup(() => json(rankingReply()));
  const log = await openChat();

  await ask("peringkat");

  const items = within(await within(log).findByRole("list")).getAllByRole("listitem");
  expect(items).toHaveLength(3);
  expect(within(items[0]).getByText("Seruyan")).toBeInTheDocument();
  expect(within(items[0]).getByText("1.027")).toBeInTheDocument();
  expect(within(items[2]).getByText("Kotawaringin Barat")).toBeInTheDocument();
  expect(within(items[2]).getByText("662")).toBeInTheDocument();
});

test("the sentence that introduces a ranking, and the notes after it, stay outside the list", async () => {
  setup(() => json(rankingReply()));
  const log = await openChat();

  await ask("peringkat");

  const list = await within(log).findByRole("list");
  const intro = within(log).getByText(/^Peringkat 5 teratas/);
  const freshness = within(log).getByText(/Data terakhir diperbarui 16 Okt 2026/);
  const caveat = within(log).getByText(/deteksi satelit, belum tentu kebakaran/);
  for (const outside of [intro, freshness, caveat]) expect(list).not.toContainElement(outside);
  expect(list.textContent).not.toContain("titik api");
});

test("a ranking item is plain text, never markup", async () => {
  setup(() => json(rankingReply("Peringkat:\n1. <b>Seruyan</b>: 5 titik api\nCatatan.")));
  const log = await openChat();

  await ask("peringkat");

  expect(await within(log).findByText("<b>Seruyan</b>")).toBeInTheDocument();
  expect(log.querySelector("b")).toBeNull();
});

test("a ranking answer in a shape it does not know is shown as plain text with its line breaks", async () => {
  setup(() =>
    json({ kind: "ranking", answer: "Peringkat:\n1. Seruyan, sekitar seribu\nSesuatu yang lain", data: {} }),
  );
  const log = await openChat();

  await ask("peringkat");

  const bubble = (await within(log).findByText(/1\. Seruyan, sekitar seribu/)).closest("p") as HTMLElement;
  expect(bubble.textContent).toContain("Sesuatu yang lain");
  expect(getComputedStyle(bubble).whiteSpace).toBe("pre-line");
  expect(within(log).queryByRole("list")).toBeNull();
});

test("an empty ranking is still said in words", async () => {
  setup(() => json(rankingReply("Peringkat kabupaten/kota:\nTidak ada titik api.\nCatatan.")));
  const log = await openChat();

  await ask("peringkat");

  expect(await within(log).findByText(/Tidak ada titik api/)).toBeInTheDocument();
  expect(within(log).queryByRole("list")).toBeNull();
});

// ---- Suggestions that come back with an answer --------------------------------------------------

test("a question it cannot answer comes with suggestions that can be tapped", async () => {
  const fetchMock = setup((_, init) => {
    const message = JSON.parse(String(init?.body)).message as string;
    if (message.startsWith("Apa itu")) {
      return json({
        kind: "unsupported",
        answer: "Maaf, saya belum bisa menjawab pertanyaan itu.",
        data: { suggestions: ["Berapa titik api di Kalimantan Barat hari ini?"] },
      });
    }
    return json(COUNT_REPLY);
  });
  const log = await openChat();
  await ask("Apa itu hotspot?");
  await within(log).findByText(/belum bisa menjawab/);

  await userEvent.click(within(log).getByRole("button", { name: "Berapa titik api di Kalimantan Barat hari ini?" }));

  await waitFor(() => expect(chatRequests(fetchMock)).toHaveLength(2));
  expect(JSON.parse(String(chatRequests(fetchMock)[1][1]?.body)).message).toBe(
    "Berapa titik api di Kalimantan Barat hari ini?",
  );
});

test("when the place is ambiguous the choices can be tapped, keeping the rest of the question", async () => {
  const fetchMock = setup((_, init) => {
    const message = JSON.parse(String(init?.body)).message as string;
    if (message === "berapa titik api di Kutai 48 jam?") {
      return json({
        kind: "clarify",
        answer: "Maksud Anda yang mana: Kutai Barat atau Kutai Timur?",
        data: {
          candidates: [
            { type: "regency", code: "ID6402", name: "Kutai Barat" },
            { type: "regency", code: "ID6403", name: "Kutai Timur" },
          ],
        },
      });
    }
    return json(COUNT_REPLY);
  });
  const log = await openChat();
  await ask("berapa titik api di Kutai 48 jam?");
  await within(log).findByText(/Maksud Anda yang mana/);

  await userEvent.click(within(log).getByRole("button", { name: "Kutai Timur" }));

  await waitFor(() => expect(chatRequests(fetchMock)).toHaveLength(2));
  // The tapped name is added to the original question so its time window and filters survive
  expect(JSON.parse(String(chatRequests(fetchMock)[1][1]?.body)).message).toBe(
    "berapa titik api di Kutai 48 jam? Kutai Timur",
  );
  // What the person sees is just the choice they made
  expect(within(log).getAllByText("Kutai Timur").length).toBeGreaterThan(0);
});

// ---- When things go wrong -----------------------------------------------------------------------

test("a server error is explained and the chat keeps working", async () => {
  let calls = 0;
  setup(() => (++calls === 1 ? new Response("down", { status: 503 }) : json(COUNT_REPLY)));
  const log = await openChat();

  await ask("pertama");
  expect(await within(log).findByText(/chat sedang tidak bisa dihubungi/)).toBeInTheDocument();
  await ask("kedua");

  expect(await within(log).findByText(/3\.295 titik api/)).toBeInTheDocument();
});

test("a network failure is explained", async () => {
  setup(() => {
    throw new TypeError("Failed to fetch");
  });
  const log = await openChat();

  await ask("halo");

  expect(await within(log).findByText(/chat sedang tidak bisa dihubungi/)).toBeInTheDocument();
});

test("being rate limited tells the person how long to wait", async () => {
  setup(() =>
    json({ detail: "Too many requests. Try again in 30 seconds." }, { status: 429, headers: { "Retry-After": "30" } }),
  );
  const log = await openChat();

  await ask("halo");

  expect(await within(log).findByText(/Terlalu banyak pertanyaan.*30 detik/)).toBeInTheDocument();
});

test("a failed question stays visible so the person knows what was not answered", async () => {
  setup(() => new Response("down", { status: 500 }));
  const log = await openChat();

  await ask("Berapa titik api di Sambas?");

  expect(await within(log).findByText("Berapa titik api di Sambas?")).toBeInTheDocument();
});

// ---- The rest of the page is unaffected ---------------------------------------------------------

test("the chat does not touch the map filters or the page address", async () => {
  setup();
  await openChat();
  await ask("Berapa titik api di Kalteng?");
  await screen.findByText(/3\.295 titik api/);

  expect(window.location.search).toBe("");
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));
});

// ---- "Tampilkan di peta": from an answer to the same view on the map ----------------------------

const KALTENG_AREA = { type: "province", code: "ID62", name: "Kalimantan Tengah" };
const SAMBAS_AREA = { type: "regency", code: "ID6101", name: "Sambas", province_code: "ID61" };
const REGION_AREA = { type: "region", name: "Kalimantan" };

function viewReply(area: Record<string, unknown>, extra: Record<string, unknown> = {}, kind = "count"): Reply {
  return {
    kind,
    answer: "Dalam 48 jam terakhir ada 12 titik api.",
    data: { count: 12, area, window: "48h", peat_only: false, include_low: false, ...extra },
  };
}

function hotspotRequests(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .map(([url]) => new URL(String(url), "http://localhost"))
    .filter((url) => url.pathname === "/api/hotspots");
}

async function askAndShowOnMap(fetchMock: ReturnType<typeof mockApi>) {
  const log = await openChat();
  await ask("pertanyaan");
  await userEvent.click(await within(log).findByRole("button", { name: "Tampilkan di peta" }));
  return { log, request: () => hotspotRequests(fetchMock).at(-1)!.searchParams };
}

test("an answer about a Province can be shown on the map with the same window", async () => {
  const fetchMock = setup(() => json(viewReply(KALTENG_AREA)));

  const { request } = await askAndShowOnMap(fetchMock);

  await waitFor(() => expect(request().get("province")).toBe("ID62"));
  expect(request().get("window")).toBe("48h");
  expect(new URLSearchParams(window.location.search).get("province")).toBe("ID62");
  expect(new URLSearchParams(window.location.search).get("window")).toBe("48h");
});

test("an answer about a Regency shows its Province and the Regency on the map", async () => {
  const fetchMock = setup(() => json(viewReply(SAMBAS_AREA, { window: "7d" })));

  const { request } = await askAndShowOnMap(fetchMock);

  await waitFor(() => expect(request().get("regency")).toBe("ID6101"));
  expect(request().get("province")).toBe("ID61");
  expect(request().get("window")).toBe("7d");
});

test("an answer about all of Kalimantan clears any place filter on the map", async () => {
  // The map starts on one Province; the answer is about everything.
  const fetchMock = setup(() => json(viewReply(REGION_AREA)), "/?province=ID61");
  await waitFor(() => expect(hotspotRequests(fetchMock).at(-1)!.searchParams.get("province")).toBe("ID61"));
  const log = await openChat();
  await ask("semua");

  await userEvent.click(await within(log).findByRole("button", { name: "Tampilkan di peta" }));

  await waitFor(() => expect(hotspotRequests(fetchMock).at(-1)!.searchParams.has("province")).toBe(false));
  expect(hotspotRequests(fetchMock).at(-1)!.searchParams.get("window")).toBe("48h");
});

test("peat only and low confidence carry over to the map", async () => {
  const fetchMock = setup(() =>
    json(viewReply(KALTENG_AREA, { peat_only: true, include_low: true, window: "24h" })),
  );

  const { request } = await askAndShowOnMap(fetchMock);

  await waitFor(() => expect(request().get("peat_only")).toBe("true"));
  expect(request().get("min_confidence")).toBe("low");
});

test("a ranking answer can be shown on the map too", async () => {
  const fetchMock = setup(() =>
    json({ ...viewReply(KALTENG_AREA, { ranking: [] }, "ranking"), answer: "Peringkat:\n1. Seruyan" }),
  );

  const { request } = await askAndShowOnMap(fetchMock);

  await waitFor(() => expect(request().get("province")).toBe("ID62"));
});

const NOT_A_VIEW: Reply[] = [
  { kind: "freshness", answer: "Jawaban soal data.", data: { last_updated: null, stale: true } },
  { kind: "unsupported", answer: "Jawaban soal maaf.", data: { suggestions: [] } },
  { kind: "clarify", answer: "Jawaban soal pilihan.", data: { candidates: [] } },
  { kind: "unknown_place", answer: "Jawaban soal tempat.", data: {} },
  { kind: "unsupported_window", answer: "Jawaban soal rentang.", data: { windows: ["24h"] } },
];

test.each(NOT_A_VIEW)("a '$kind' answer is not about a view of the map, so it gets no button", async (reply) => {
  setup(() => json(reply));
  const log = await openChat();

  await ask("pertanyaan");
  await within(log).findByText(reply.answer);

  expect(within(log).queryByRole("button", { name: "Tampilkan di peta" })).toBeNull();
});

test("an answer with an unusable window gets no button rather than a wrong view", async () => {
  setup(() => json(viewReply(KALTENG_AREA, { window: "90d" })));
  const log = await openChat();

  await ask("aneh");
  await within(log).findByText(/ada 12 titik api/);

  expect(within(log).queryByRole("button", { name: "Tampilkan di peta" })).toBeNull();
});

test("each answer keeps its own button, so an earlier view can be restored", async () => {
  let n = 0;
  const fetchMock = setup(() => json(viewReply(++n === 1 ? KALTENG_AREA : SAMBAS_AREA)));
  const log = await openChat();
  await ask("satu");
  await within(log).findAllByRole("button", { name: "Tampilkan di peta" });
  await ask("dua");
  await waitFor(() => expect(within(log).getAllByRole("button", { name: "Tampilkan di peta" })).toHaveLength(2));

  await userEvent.click(within(log).getAllByRole("button", { name: "Tampilkan di peta" })[0]);

  await waitFor(() => expect(hotspotRequests(fetchMock).at(-1)!.searchParams.get("province")).toBe("ID62"));
  expect(hotspotRequests(fetchMock).at(-1)!.searchParams.has("regency")).toBe(false);
});

test("on a phone showing an answer on the map closes the chat so the map is visible", async () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: true,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  const fetchMock = setup(() => json(viewReply(KALTENG_AREA)));
  await openChat();
  await ask("pertanyaan");
  await userEvent.click(await screen.findByRole("button", { name: "Tampilkan di peta" }));

  await waitFor(() => expect(hotspotRequests(fetchMock).at(-1)!.searchParams.get("province")).toBe("ID62"));
  expect(screen.getByRole("button", { name: "Tanya" })).toHaveAttribute("aria-expanded", "false");
});

test("on a wide screen the chat stays open after showing an answer on the map", async () => {
  setup(() => json(viewReply(KALTENG_AREA)));
  await openChat();
  await ask("pertanyaan");

  await userEvent.click(await screen.findByRole("button", { name: "Tampilkan di peta" }));

  expect(screen.getByRole("button", { name: "Tanya" })).toHaveAttribute("aria-expanded", "true");
});

test("the conversation is still there after the chat is closed and reopened", async () => {
  setup(() => json(viewReply(KALTENG_AREA)));
  await openChat();
  await ask("pertanyaan satu");
  await screen.findByText(/12 titik api/);

  await userEvent.click(screen.getByRole("button", { name: "Tanya" }));
  await userEvent.click(screen.getByRole("button", { name: "Tanya" }));

  expect(screen.getByText("pertanyaan satu")).toBeInTheDocument();
});

// ---- Answers quoted from the reviewed documents -------------------------------------------------

const NASA_SOURCE = {
  title: "Tentang titik api (hotspot) dari satelit",
  source: "NASA FIRMS, Pertanyaan Umum (FAQ)",
  url: "https://www.earthdata.nasa.gov/data/tools/firms/faq",
  reviewed: "2026-10-16",
  heading: "Apa itu titik api (hotspot)?",
};

function knowledgeReply(source: Record<string, unknown> = NASA_SOURCE, related: string[] = []): Reply {
  return {
    kind: "knowledge",
    answer:
      "Titik api adalah hasil deteksi satelit.\n\nSumber: Tentang titik api (NASA FIRMS), ditinjau 16 Oktober 2026.",
    data: { sources: [source], related },
  };
}

test("a quoted answer links to its source, opening in a new tab without leaking the page", async () => {
  setup(() => json(knowledgeReply()));
  const log = await openChat();
  await ask("apa itu hotspot?");

  const link = await within(log).findByRole("link", { name: /Buka sumber/ });

  expect(link).toHaveAttribute("href", NASA_SOURCE.url);
  expect(link).toHaveAttribute("target", "_blank");
  expect(link.getAttribute("rel")).toContain("noopener");
  expect(link.getAttribute("rel")).toContain("noreferrer");
});

test("a source whose address is not plain http(s) is named but never made a link", async () => {
  setup(() => json(knowledgeReply({ ...NASA_SOURCE, url: "javascript:alert(1)" })));
  const log = await openChat();
  await ask("apa itu hotspot?");
  await within(log).findByText(/Titik api adalah hasil deteksi satelit/);

  expect(within(log).queryByRole("link")).toBeNull();
  expect(within(log).getByText(/Sumber: Tentang titik api/)).toBeInTheDocument();
});

test("a source without an address (our own documentation) has no link", async () => {
  setup(() => json(knowledgeReply({ ...NASA_SOURCE, url: null })));
  const log = await openChat();
  await ask("apa arti titik ungu di peta?");
  await within(log).findByText(/Titik api adalah hasil deteksi satelit/);

  expect(within(log).queryByRole("link")).toBeNull();
});

test("related passages are offered as questions that can be tapped", async () => {
  const fetchMock = setup(() =>
    json(knowledgeReply(NASA_SOURCE, ["Apakah titik api sama dengan kebakaran?", "Seberapa akurat lokasi titik api?"])),
  );
  const log = await openChat();
  await ask("apa itu hotspot?");

  await userEvent.click(await within(log).findByRole("button", { name: "Seberapa akurat lokasi titik api?" }));

  await waitFor(() => expect(chatRequests(fetchMock)).toHaveLength(2));
  expect(JSON.parse(String(chatRequests(fetchMock)[1][1]?.body)).message).toBe(
    "Seberapa akurat lokasi titik api?",
  );
});

test("a quoted answer has no button to show it on the map", async () => {
  setup(() => json(knowledgeReply()));
  const log = await openChat();
  await ask("apa itu hotspot?");
  await within(log).findByText(/Titik api adalah hasil deteksi satelit/);

  expect(within(log).queryByRole("button", { name: "Tampilkan di peta" })).toBeNull();
});

test("a source link stays with its own answer when the conversation goes on", async () => {
  setup((_, init) =>
    JSON.parse(String(init?.body)).message === "apa itu hotspot?" ? json(knowledgeReply()) : json(COUNT_REPLY),
  );
  const log = await openChat();
  await ask("apa itu hotspot?");
  await within(log).findByRole("link", { name: /Buka sumber/ });
  await ask("berapa titik api di Kalimantan Tengah?");
  await within(log).findByText(/3.295 titik api/);

  expect(within(log).getAllByRole("link", { name: /Buka sumber/ })).toHaveLength(1);
});

// ---- How a quoted answer is laid out ------------------------------------------------------------

test("the source line is set apart from the quoted text, with the link beside it", async () => {
  setup(() => json(knowledgeReply()));
  const log = await openChat();
  await ask("apa itu hotspot?");

  const body = await within(log).findByText("Titik api adalah hasil deteksi satelit.");
  const note = within(log).getByText(/^Sumber: Tentang titik api/);
  const link = within(log).getByRole("link", { name: /Buka sumber/ });

  expect(body).not.toBe(note);
  expect(body.textContent).not.toContain("Sumber:");
  expect(note.parentElement).toContainElement(link);
});

test("a long answer is scrolled to its first line, not to its last", async () => {
  // Layout does not exist in jsdom, so the position of each message is given by hand.
  const offsetTop = vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains("chat-assistant") && this.textContent?.includes("Titik api adalah") ? 480 : 0;
  });
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(2000);
  setup(() => json(knowledgeReply()));
  const log = await openChat();
  await ask("apa itu hotspot?");
  await within(log).findByText("Titik api adalah hasil deteksi satelit.");

  await waitFor(() => expect(log.scrollTop).toBeGreaterThan(0));
  expect(log.scrollTop).toBeLessThan(500);
  offsetTop.mockRestore();
});

test("a message that was just sent is scrolled to the bottom so the wait is visible", async () => {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(2000);
  setup(
    () =>
      new Promise<Response>(() => {
        /* never answers */
      }),
  );
  const log = await openChat();
  await ask("apa itu hotspot?");
  await within(log).findByText("Sedang menjawab…");

  await waitFor(() => expect(log.scrollTop).toBe(2000));
});

// ---- The AI layer ---------------------------------------------------------------------------------

async function statusAsked(fetchMock: ReturnType<typeof mockApi>) {
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(
        ([url]) => new URL(String(url), "http://localhost").pathname === "/api/chat/status",
      ),
    ).toBe(true),
  );
}

test("when the AI is on, the chat says questions are processed by an AI service and to write no personal data", async () => {
  setup(undefined, "/", { ai: true });
  await openChat();

  expect(await screen.findByText(/diproses layanan AI/)).toBeInTheDocument();
  expect(screen.getByText(/data pribadi/)).toBeInTheDocument();
});

test("when the AI is off, the chat does not warn about an AI service", async () => {
  const fetchMock = setup(undefined, "/", { ai: false });
  await openChat();
  await statusAsked(fetchMock);

  expect(screen.queryByText(/layanan AI/)).toBeNull();
});

test("when the server cannot say whether the AI is on, the chat does not warn about an AI service", async () => {
  const fetchMock = setup();
  await openChat();
  await statusAsked(fetchMock);

  expect(screen.queryByText(/layanan AI/)).toBeNull();
});

test("an answer given without the AI says the chat is in simple mode", async () => {
  setup(() =>
    json({ kind: "unsupported", answer: "Maaf, belum bisa menjawab.", data: {}, simple_mode: true }),
  );
  const log = await openChat();

  await ask("pertanyaan bebas");

  expect(await within(log).findByText(/Mode sederhana/)).toBeInTheDocument();
});

test("an ordinary answer carries no simple mode notice", async () => {
  setup();
  const log = await openChat();

  await ask("Berapa titik api di Kalimantan Tengah hari ini?");

  await within(log).findByText(/3\.295 titik api/);
  expect(screen.queryByText(/Mode sederhana/)).toBeNull();
});

// ---- Follow-up questions --------------------------------------------------------------------------

function sentBody(fetchMock: ReturnType<typeof mockApi>, index: number) {
  return JSON.parse(String(chatRequests(fetchMock)[index][1]?.body));
}

test("a second question carries the first question and its answer, so a follow-up can be understood", async () => {
  const fetchMock = setup();
  const log = await openChat();

  await ask("Berapa titik api di Kalimantan Tengah hari ini?");
  await within(log).findByText(/3\.295 titik api/);
  await ask("kalau seminggu?");
  await waitFor(() => expect(chatRequests(fetchMock)).toHaveLength(2));

  expect(sentBody(fetchMock, 1)).toEqual({
    message: "kalau seminggu?",
    history: [
      { role: "user", text: "Berapa titik api di Kalimantan Tengah hari ini?" },
      { role: "assistant", text: COUNT_REPLY.answer },
    ],
  });
});

test("only the last few turns are sent, never the greeting", async () => {
  const fetchMock = setup();
  const log = await openChat();

  for (const [answered, question] of ["satu", "dua", "tiga", "empat"].entries()) {
    await ask(question);
    await waitFor(() => expect(within(log).getAllByText(/3\.295 titik api/)).toHaveLength(answered + 1));
  }
  await ask("lima");
  await waitFor(() => expect(chatRequests(fetchMock)).toHaveLength(5));

  const history = sentBody(fetchMock, 4).history as Array<{ role: string; text: string }>;
  expect(history).toHaveLength(6);
  expect(history.map((turn) => turn.text)).not.toContain(expect.stringContaining("Halo!"));
  expect(history[history.length - 2]).toEqual({ role: "user", text: "empat" });
});

test("a question that failed is not offered to the server as something that was answered", async () => {
  let calls = 0;
  const fetchMock = setup(() => (++calls === 1 ? new Response("down", { status: 500 }) : json(COUNT_REPLY)));
  const log = await openChat();

  await ask("pertama");
  await within(log).findByText(/chat sedang tidak bisa dihubungi/);
  await ask("kedua");
  await waitFor(() => expect(chatRequests(fetchMock)).toHaveLength(2));

  expect(sentBody(fetchMock, 1).history).toEqual([{ role: "user", text: "pertama" }]);
});

// ---- Answers the model wrote from the documents ---------------------------------------------------

function groundedReply(quote = "Titik api adalah hasil deteksi satelit."): Reply {
  return {
    kind: "knowledge",
    answer:
      "Titik api adalah tanda panas yang dilihat satelit, bukan bukti ada kebakaran.\n\n" +
      "Sumber: Tentang titik api (NASA FIRMS), ditinjau 16 Oktober 2026.",
    data: { sources: [NASA_SOURCE], related: [], model_written: true, quote },
  };
}

test("an answer the model wrote says so, with the quotation it rests on under it", async () => {
  setup(() => json(groundedReply()));
  const log = await openChat();

  await ask("apa itu hotspot?");

  expect(await within(log).findByText(/tanda panas yang dilihat satelit/)).toBeInTheDocument();
  expect(within(log).getByText(/Dijawab AI/)).toBeInTheDocument();
  const quote = within(log).getByText("Titik api adalah hasil deteksi satelit.");
  expect(quote.closest("blockquote")).not.toBeNull();
  expect(within(log).getByText(/Sumber: Tentang titik api/)).toBeInTheDocument();
  expect(within(log).getByRole("link", { name: /Buka sumber/ })).toBeInTheDocument();
});

test("a plain quotation carries no AI label and no separate quotation", async () => {
  setup(() => json(knowledgeReply()));
  const log = await openChat();

  await ask("apa itu hotspot?");

  await within(log).findByText(/Titik api adalah hasil deteksi satelit/);
  expect(screen.queryByText(/Dijawab AI/)).toBeNull();
  expect(log.querySelector("blockquote")).toBeNull();
});

test("the quotation under an answer is plain text, never markup", async () => {
  setup(() => json(groundedReply("<img src=x onerror=alert(1)> kutipan")));
  const log = await openChat();

  await ask("apa itu hotspot?");

  expect(await within(log).findByText(/kutipan/)).toBeInTheDocument();
  expect(log.querySelector("img")).toBeNull();
});

test("a data answer is not labelled as written by the AI", async () => {
  setup();
  const log = await openChat();

  await ask("Berapa titik api di Kalimantan Tengah hari ini?");

  await within(log).findByText(/3\.295 titik api/);
  expect(screen.queryByText(/Dijawab AI/)).toBeNull();
});

test("an answer with no source shows no stray digit where the source line would be", async () => {
  setup();
  const log = await openChat();

  await ask("Berapa titik api di Kalimantan Tengah?");

  await within(log).findByText(/3\.295 titik api/);
  expect(within(log).queryByText("0")).toBeNull();
  expect(log.querySelector(".source-note")).toBeNull();
});

test("a ranking that can be shown on the map has no stray digit before its button", async () => {
  setup(() =>
    json({
      kind: "ranking",
      answer: "Peringkat 5 teratas.\n1. Seruyan: 1.027 titik api\nData terakhir diperbarui 29 Okt 2026.",
      data: {
        ranking: [{ name: "Seruyan", count: 1027 }],
        area: REGION_AREA,
        window: "24h",
        peat_only: false,
        include_low: false,
      },
    }),
  );
  const log = await openChat();

  await ask("kabupaten mana paling banyak");

  expect(await within(log).findByRole("button", { name: "Tampilkan di peta" })).toBeInTheDocument();
  expect(within(log).queryByText("0")).toBeNull();
  // The button is the last thing in the answer: nothing but whitespace may sit before it.
  const button = within(log).getByRole("button", { name: "Tampilkan di peta" });
  expect(button.previousSibling?.textContent ?? "").not.toMatch(/^\s*0\s*$/);
});

test("the send button is a small icon with the name 'Kirim', and it is disabled until there is a question", async () => {
  setup();
  await openChat();
  const send = screen.getByRole("button", { name: "Kirim" });

  expect(send.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  expect(send).toHaveTextContent("");
  expect(send).toBeDisabled();

  await userEvent.type(screen.getByRole("textbox", { name: "Pertanyaan" }), "halo");

  expect(send).toBeEnabled();
});
