import test from "node:test";
import assert from "node:assert/strict";
import { createStorageArea } from "../src/web/storageArea.ts";
import { createRuntime } from "../src/web/messageBus.ts";
import { extractShared } from "../src/web/shareTarget.ts";

function memoryBacking() {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("storage area round-trips values through callbacks and promises", async () => {
  const area = createStorageArea(memoryBacking(), "local", () => {});
  await area.set({ user: { uid: "u1", links: [1, 2] }, flag: true });

  assert.deepEqual(await area.get(["user"]), { user: { uid: "u1", links: [1, 2] } });
  assert.deepEqual(await area.get("flag"), { flag: true });
  assert.deepEqual(await area.get(["missing"]), {});
  assert.deepEqual(await area.get({ missing: "fallback", flag: false }), { missing: "fallback", flag: true });

  const viaCallback = await new Promise((resolve) => area.get(["flag"], resolve));
  assert.deepEqual(viaCallback, { flag: true });
});

test("storage area reports changes with old and new values", async () => {
  const seen: unknown[] = [];
  const area = createStorageArea(memoryBacking(), "local", (changes, areaName) => seen.push({ changes, areaName }));

  await area.set({ a: 1 });
  await area.set({ a: 2 });
  await area.remove("a");
  await area.remove("a"); // already gone: no event
  await tick();

  assert.deepEqual(seen, [
    { changes: { a: { oldValue: undefined, newValue: 1 } }, areaName: "local" },
    { changes: { a: { oldValue: 1, newValue: 2 } }, areaName: "local" },
    { changes: { a: { oldValue: 2 } }, areaName: "local" },
  ]);
});

test("clear only removes this area's keys", async () => {
  const backing = memoryBacking();
  backing.setItem("unrelated", "keep");
  const area = createStorageArea(backing, "local", () => {});

  await area.set({ user: 1, other: 2 });
  await area.clear();

  assert.deepEqual(await area.get(null), {});
  assert.equal(backing.getItem("unrelated"), "keep");
});

test("storage area tolerates corrupt JSON and ignores foreign external changes", async () => {
  const backing = memoryBacking();
  const seen: unknown[] = [];
  const area = createStorageArea(backing, "local", (changes) => seen.push(changes));
  backing.setItem("lp:broken", "{not json");

  assert.deepEqual(await area.get(["broken"]), {});

  area.applyExternalChange("someone-elses-key", null, "1");
  area.applyExternalChange("lp:user", JSON.stringify({ n: 1 }), JSON.stringify({ n: 2 }));
  assert.deepEqual(seen, [{ user: { oldValue: { n: 1 }, newValue: { n: 2 } } }]);
});

test("runtime answers requests through the handler and callback", async () => {
  const runtime = createRuntime("web", (message, sendResponse) => {
    if (message.type !== "PING") return false;
    setTimeout(() => sendResponse({ pong: message.n }), 0);
    return true;
  });

  const viaCallback = await new Promise((resolve) => runtime.sendMessage({ type: "PING", n: 1 }, resolve));
  assert.deepEqual(viaCallback, { pong: 1 });
  assert.deepEqual(await runtime.sendMessage({ type: "PING", n: 2 }), { pong: 2 });
});

test("runtime broadcasts to onMessage listeners and flags unanswered messages", async () => {
  const runtime = createRuntime("web", () => false);
  const received: unknown[] = [];
  const listener = (message: unknown) => received.push(message);
  runtime.onMessage.addListener(listener);

  const lastErrors: Array<string | undefined> = [];
  await new Promise<void>((resolve) =>
    runtime.sendMessage({ type: "SIGN_IN_COMPLETE" }, () => {
      lastErrors.push(runtime.lastError?.message);
      resolve();
    }),
  );
  assert.deepEqual(received, [{ type: "SIGN_IN_COMPLETE" }]);
  assert.match(lastErrors[0] ?? "", /message port closed/);
  assert.equal(runtime.lastError, undefined, "lastError is only visible during the callback");

  runtime.onMessage.removeListener(listener);
  runtime.sendMessage({ type: "AGAIN" });
  assert.equal(received.length, 1);
});

test("runtime keeps only the first response", async () => {
  const runtime = createRuntime("web", (_message, sendResponse) => {
    sendResponse("first");
    sendResponse("second");
    return true;
  });
  assert.equal(await runtime.sendMessage({ type: "X" }), "first");
});

test("share target prefers the url param, then a link inside the text", () => {
  const params = (query: string) => new URLSearchParams(query);

  assert.deepEqual(extractShared(params("url=https%3A%2F%2Fexample.com%2Fa&text=ignored")), {
    url: "https://example.com/a",
  });
  // Android often puts the link in `text`.
  assert.deepEqual(extractShared(params("title=Cool&text=Look%20at%20this%20https%3A%2F%2Fexample.com%2Fb%20wow")), {
    url: "https://example.com/b",
  });
  assert.deepEqual(extractShared(params("text=just%20a%20thought")), { text: "just a thought" });
  assert.deepEqual(extractShared(params("title=Only%20a%20title")), { text: "Only a title" });
  assert.equal(extractShared(params("source=pwa")), null);
  assert.equal(extractShared(params("url=javascript%3Aalert(1)")), null);
});
