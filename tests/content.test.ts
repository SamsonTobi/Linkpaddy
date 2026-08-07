import test from "node:test";
import assert from "node:assert/strict";
import {
  REMINDER_INTERVAL_MS,
  shouldSendSharingReminder,
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

test("sharing reminders require friends, quiet hours, and the interval", () => {
  const now = Date.parse("2026-01-10T12:00:00Z");
  assert.equal(shouldSendSharingReminder({ now, acceptedFriendCount: 1, remindersEnabled: true, localHour: 12 }), true);
  assert.equal(shouldSendSharingReminder({ now, acceptedFriendCount: 0, remindersEnabled: true, localHour: 12 }), false);
  assert.equal(shouldSendSharingReminder({ now, acceptedFriendCount: 1, remindersEnabled: true, localHour: 22 }), false);
  assert.equal(shouldSendSharingReminder({ now, acceptedFriendCount: 1, remindersEnabled: true, localHour: 12, lastReminderAt: now - REMINDER_INTERVAL_MS + 1 }), false);
});
