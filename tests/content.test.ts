import test from "node:test";
import assert from "node:assert/strict";
import {
  REMINDER_INTERVAL_MS,
  aggregateRecipientStatus,
  buildRecipientStatuses,
  ensureRecipientStatuses,
  parseLinkList,
  sanitizePublicProfile,
  shouldSendSharingReminder,
  trimNewest,
  updateLike,
  updateRecipientStatus,
  validateContent,
} from "../src/shared/content.ts";

test("validates and normalizes links", () => {
  assert.deepEqual(validateContent({ contentType: "link", link: " https://example.com/article " }), {
    contentType: "link",
    link: "https://example.com/article",
  });
  assert.throws(() => validateContent({ contentType: "link", link: "example.com" }));
});

test("validates text and enforces the length limit", () => {
  assert.deepEqual(validateContent({ contentType: "text", text: "  hello  " }), {
    contentType: "text",
    text: "hello",
  });
  assert.throws(() => validateContent({ contentType: "text", text: "" }));
  assert.throws(() => validateContent({ contentType: "text", text: "x".repeat(1001) }));
});

test("likes are unique and reversible", () => {
  assert.deepEqual(updateLike(["Ada"], "@ADA", true), ["ada"]);
  assert.deepEqual(updateLike(["ada", "sam"], "@Ada", false), ["sam"]);
});

test("recipient status preserves the first seen timestamp", () => {
  const first = updateRecipientStatus([], { username: "maya", displayName: "Maya Reed" }, "seen", "2026-01-01T10:00:00Z");
  const second = updateRecipientStatus(first, { username: "maya", displayName: "Maya Reed" }, "opened", "2026-01-01T10:05:00Z");
  assert.equal(second[0].seenAt, "2026-01-01T10:00:00Z");
  assert.equal(second[0].openedAt, "2026-01-01T10:05:00Z");
});

test("sanitized profiles never contain undefined (arrayUnion-safe)", () => {
  const cleaned = sanitizePublicProfile({
    username: "@Maya",
    displayName: undefined,
    photoURL: undefined,
    joinedAt: undefined,
  } as any);
  assert.deepEqual(cleaned, { username: "maya" });
  assert.ok(!Object.values(cleaned).some((value) => value === undefined));
  // Nulls from Firebase Auth are dropped too, not written through.
  const nulled = sanitizePublicProfile({ username: "sam", displayName: null, photoURL: null } as any);
  assert.deepEqual(nulled, { username: "sam" });
});

test("recipient status update tolerates profiles with missing fields", () => {
  const next = updateRecipientStatus(
    [],
    { username: "leo", displayName: undefined, photoURL: undefined } as any,
    "seen",
    "2026-01-01T10:00:00Z",
  );
  assert.equal(next[0].username, "leo");
  assert.equal(next[0].status, "seen");
  assert.ok(!Object.values(next[0]).some((value) => value === undefined));
});

test("legacy links without recipientStatuses are seeded from recipients", () => {
  const seeded = ensureRecipientStatuses({
    recipients: ["Ada", "sam"],
    recipientProfiles: [{ username: "ada", displayName: "Ada" }],
    recipientStatuses: undefined,
  } as any);
  assert.deepEqual(
    seeded.map((person) => person.username).sort(),
    ["ada", "sam"],
  );
  assert.ok(seeded.every((person) => person.status === "unseen"));
});

test("recipient statuses are built once per username and sanitized", () => {
  const built = buildRecipientStatuses([
    { username: "Ada", displayName: undefined } as any,
    { username: "@ada" },
    { username: "" },
  ]);
  assert.equal(built.length, 1);
  assert.equal(built[0].username, "ada");
});

test("sent status aggregates across recipients", () => {
  assert.equal(aggregateRecipientStatus([], "unseen"), "unseen");
  assert.equal(aggregateRecipientStatus([{ status: "unseen" }, { status: "unseen" }], "unseen"), "unseen");
  assert.equal(aggregateRecipientStatus([{ status: "unseen" }, { status: "seen" }], "unseen"), "seen");
  assert.equal(aggregateRecipientStatus([{ status: "opened" }, { status: "seen" }], "unseen"), "seen");
  assert.equal(aggregateRecipientStatus([{ status: "opened" }, { status: "opened" }], "unseen"), "opened");
});

test("parses comma-separated link lists", () => {
  assert.deepEqual(
    parseLinkList("https://a.com, https://b.com/x?y=1"),
    ["https://a.com", "https://b.com/x?y=1"],
  );
  assert.deepEqual(
    parseLinkList("https://a.com\nhttps://b.com,https://a.com , "),
    ["https://a.com", "https://b.com"],
  );
  assert.deepEqual(parseLinkList("  http://solo.com  "), ["http://solo.com"]);
});

test("link list parsing keeps commas inside URLs", () => {
  assert.deepEqual(
    parseLinkList("https://maps.google.com/?q=austin,tx"),
    ["https://maps.google.com/?q=austin,tx"],
  );
  assert.deepEqual(
    parseLinkList("https://maps.google.com/?q=austin,tx, https://b.com"),
    ["https://maps.google.com/?q=austin,tx", "https://b.com"],
  );
  assert.deepEqual(
    parseLinkList("https://a.com,https://b.com"),
    ["https://a.com", "https://b.com"],
  );
});

test("link list parsing rejects bad entries by name", () => {
  assert.throws(() => parseLinkList(""), /Enter a link/);
  assert.throws(() => parseLinkList("   ,  "), /Enter a link/);
  assert.throws(() => parseLinkList("https://ok.com, not-a-link"), /not-a-link/);
  assert.throws(() => parseLinkList("ftp://files.com/x"), /ftp/);
});

test("link list parsing enforces the per-share cap", () => {
  const many = Array.from({ length: 21 }, (_, i) => `https://site${i}.com`).join(",");
  assert.throws(() => parseLinkList(many), /up to 20/);
});

test("trims history to the newest entries only", () => {
  const items = [1, 2, 3, 4, 5];
  assert.equal(trimNewest(items, 10), items); // same ref, no-op
  assert.deepEqual(trimNewest(items, 3), [3, 4, 5]);
  assert.deepEqual(trimNewest(items, 0), []);
});

test("sharing reminders require friends, quiet hours, and the interval", () => {
  const now = Date.parse("2026-01-10T12:00:00Z");
  assert.equal(shouldSendSharingReminder({ now, acceptedFriendCount: 1, remindersEnabled: true, localHour: 12 }), true);
  assert.equal(shouldSendSharingReminder({ now, acceptedFriendCount: 0, remindersEnabled: true, localHour: 12 }), false);
  assert.equal(shouldSendSharingReminder({ now, acceptedFriendCount: 1, remindersEnabled: true, localHour: 22 }), false);
  assert.equal(shouldSendSharingReminder({ now, acceptedFriendCount: 1, remindersEnabled: true, localHour: 12, lastReminderAt: now - REMINDER_INTERVAL_MS + 1 }), false);
});
