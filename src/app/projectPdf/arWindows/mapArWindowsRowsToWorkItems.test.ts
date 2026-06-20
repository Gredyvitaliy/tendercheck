import assert from "node:assert/strict";
import test from "node:test";

import {
  mapArWindowsRowsToWorkItems,
  normalizeArWindowsQuantity,
} from "./mapArWindowsRowsToWorkItems";
import type { ArWindowSpecificationRow } from "./types";

const row = (
  overrides: Partial<ArWindowSpecificationRow>
): ArWindowSpecificationRow => ({
  mark: "B-1",
  designation: "ГОСТ 22233-2001",
  name: "Витраж из алюминиевого профиля",
  area: "103,95",
  quantity: "1",
  mass: "",
  note: "",
  ...overrides,
});

test("maps AR windows rows to WorkItems with marks preserved", () => {
  const workItems = mapArWindowsRowsToWorkItems([
    row({
      mark: "B-10",
      designation: "ГОСТ 22233-2001",
      name: "Витраж B-10",
      quantity: "10",
    }),
    row({
      mark: "B-16*",
      designation: "ГОСТ 22233-2001",
      name: "Витраж B-16*",
      quantity: "3",
    }),
    row({
      mark: "ПД-1",
      designation: "",
      name: "подоконник шириной 300",
      quantity: "",
    }),
  ]);

  assert.equal(workItems[0].number, 10);
  assert.equal(workItems[0].position, "B-10");
  assert.equal(workItems[0].projectVolume, 10);
  assert.equal(workItems[0].unit, "шт");
  assert.equal(workItems[0].rowType, "item");
  assert.equal(workItems[0].rate, "");
  assert.match(workItems[0].name, /B-10/);
  assert.match(workItems[0].name, /ГОСТ 22233-2001/);
  assert.match(workItems[0].name, /Витраж B-10/);

  assert.equal(workItems[1].number, 16);
  assert.equal(workItems[1].position, "B-16*");
  assert.equal(workItems[1].projectVolume, 3);

  assert.equal(workItems[2].number, 1);
  assert.equal(workItems[2].position, "ПД-1");
  assert.equal(workItems[2].projectVolume, 0);
});

test("normalizes AR windows quantity strings", () => {
  assert.equal(normalizeArWindowsQuantity("10"), 10);
  assert.equal(normalizeArWindowsQuantity("3"), 3);
  assert.equal(normalizeArWindowsQuantity(""), 0);
  assert.equal(normalizeArWindowsQuantity("not a number"), 0);
});
