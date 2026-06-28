import assert from "node:assert/strict";
import test from "node:test";

import { normalizeWindowMark } from "./normalizeWindowMark";

test("normalizes visually identical latin and cyrillic B window marks", () => {
  assert.equal(normalizeWindowMark("\u0412-1"), normalizeWindowMark("B-1"));
  assert.equal(normalizeWindowMark("\u04121"), normalizeWindowMark("B-1"));
  assert.equal(normalizeWindowMark("B-01"), normalizeWindowMark("B-1"));
  assert.equal(
    normalizeWindowMark("\u0412-6(\u0437\u0435\u0440)"),
    normalizeWindowMark("B-6(\u0437\u0435\u0440)")
  );
  assert.equal(normalizeWindowMark("\u0412-7*"), normalizeWindowMark("B-7*"));
});

test("keeps significant suffixes while normalizing spacing and dashes", () => {
  assert.equal(normalizeWindowMark(" \u0412 \u2013 006 ( \u0437\u0435\u0440 ) "), "b-6(mirror)");
  assert.equal(normalizeWindowMark("B \u2014 007 *"), "b-7(mirror)");
});

test("normalizes mirrored AR window suffix variants", () => {
  assert.equal(
    normalizeWindowMark("B-6(\u0437\u0435\u0440)"),
    normalizeWindowMark("\u0412-6(\u0437\u0435\u0440\u043a)")
  );
  assert.equal(
    normalizeWindowMark("B-9(\u0437\u0435\u0440)"),
    normalizeWindowMark("\u0412-9(\u0437\u0435\u0440\u043a)")
  );
  assert.equal(normalizeWindowMark("B-6(\u0437\u0435\u0440\u043a.)"), "b-6(mirror)");
  assert.equal(normalizeWindowMark("B-6(\u0437\u0435\u0440\u043a\u0430\u043b\u044c\u043d\u043e\u0435)"), "b-6(mirror)");
  assert.equal(normalizeWindowMark("B-7*"), normalizeWindowMark("B-7(\u0437\u0435\u0440\u043a)"));
  assert.equal(normalizeWindowMark("\u0412-7*"), normalizeWindowMark("B-7(\u0437\u0435\u0440\u043a)"));
  assert.equal(normalizeWindowMark("B-7*"), normalizeWindowMark("\u0412-7(\u0437\u0435\u0440\u043a)"));
  assert.notEqual(normalizeWindowMark("B-7"), normalizeWindowMark("B-7*"));
  assert.notEqual(normalizeWindowMark("B-7"), normalizeWindowMark("B-7(\u0437\u0435\u0440\u043a)"));
});

test("does not treat size parentheses as part of the window mark", () => {
  assert.equal(normalizeWindowMark("B-1 (21000 x 4950)"), "b-1");
  assert.equal(normalizeWindowMark("\u0412-9 (\u0444\u0440\u0430\u043c\u0443\u0436\u043d\u044b\u0439 x 2380)"), "b-9");
});
