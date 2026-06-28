import assert from "node:assert/strict";
import test from "node:test";

import type { WorkItem } from "../types";
import { getPrimaryMark } from "./matchUtils";

const item = (overrides: Partial<WorkItem>): WorkItem => ({
  number: 1,
  name: "Item",
  rate: "",
  unit: "шт",
  projectVolume: 1,
  rowType: "item",
  ...overrides,
});

test("uses WorkItem position as the primary window mark when present", () => {
  assert.equal(
    getPrimaryMark(
      item({
        position: "B-6(\u0437\u0435\u0440)",
        name: "B-6(\u0437\u0435\u0440) Window B-6 (2000 x 2380)",
      })
    ),
    "b-6(mirror)"
  );
});

test("prefers a more specific name mark over a base rate mark", () => {
  assert.equal(
    getPrimaryMark(
      item({
        rate: "\u0412-6 \u0413\u041e\u0421\u0422",
        name: "Window B-6(\u0437\u0435\u0440) (2000 x 2380)",
      })
    ),
    "b-6(mirror)"
  );
  assert.equal(
    getPrimaryMark(
      item({
        rate: "\u0412-7 \u0413\u041e\u0421\u0422",
        name: "Window B-7* (4000 x 2380)",
      })
    ),
    "b-7(mirror)"
  );
});

test("prefers a mirrored name mark over a base rate mark", () => {
  assert.equal(
    getPrimaryMark(
      item({
        rate: "B-7",
        name: "Window B-7(\u0437\u0435\u0440\u043a) (4000 x 2380)",
      })
    ),
    "b-7(mirror)"
  );
});
