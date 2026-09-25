import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("command shortcuts have keys on every operating system", async () => {
  const manifestUrl = new URL("../public/manifest.json", import.meta.url);
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

  for (const [name, command] of Object.entries(manifest.commands ?? {})) {
    const suggestedKey = (command as { suggested_key?: Record<string, string> })
      .suggested_key;

    assert.ok(suggestedKey, `${name} must define suggested_key`);
    assert.ok(
      suggestedKey.default ||
        ["windows", "mac", "linux", "chromeos"].every(
          (platform) => suggestedKey[platform],
        ),
      `${name} must define a default key or keys for every operating system`,
    );
  }
});
