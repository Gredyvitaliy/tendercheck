import assert from "node:assert/strict";
import test from "node:test";

import type { PdfSpecificationRowCandidate } from "./extractSpecificationRows";
import { mapPdfCandidatesToWorkItems } from "./mapPdfCandidatesToWorkItems";

const makeCandidate = (
  overrides: Partial<PdfSpecificationRowCandidate> = {}
): PdfSpecificationRowCandidate => ({
  pageNumber: 21,
  rawLines: ["3.1. Установка AIRNED к-т 1"],
  position: "3.1",
  name: "Установка AIRNED",
  unit: "к-т",
  quantity: 1,
  confidence: 1,
  reasons: [],
  ...overrides,
});

test("maps a candidate name and quantity to WorkItem", () => {
  const result = mapPdfCandidatesToWorkItems([makeCandidate()]);

  assert.deepEqual(result, [
    {
      number: 0,
      name: "Установка AIRNED",
      rate: "",
      unit: "к-т",
      projectVolume: 1,
      rowType: "item",
      position: "3.1",
    },
  ]);
});

test("maps dash or missing unit to an empty string", () => {
  const result = mapPdfCandidatesToWorkItems([
    makeCandidate({ unit: "-" }),
    makeCandidate({ position: "3.2", unit: undefined }),
  ]);

  assert.deepEqual(
    result.map((item) => item.unit),
    ["", ""]
  );
});

test("skips candidates below the confidence threshold", () => {
  const result = mapPdfCandidatesToWorkItems([
    makeCandidate({ confidence: 0.25 }),
    makeCandidate({ position: "3.2", confidence: 0.5 }),
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].number, 0);
  assert.equal(result[0].position, "3.2");
});

test("preserves position and maps invalid quantity to zero", () => {
  const result = mapPdfCandidatesToWorkItems([
    makeCandidate({ position: "12.2", quantity: Number.NaN }),
    makeCandidate({ position: "12.3", quantity: -5 }),
  ]);

  assert.deepEqual(
    result.map((item) => ({
      position: item.position,
      projectVolume: item.projectVolume,
    })),
    [
      { position: "12.2", projectVolume: 0 },
      { position: "12.3", projectVolume: 0 },
    ]
  );
});

test("skips candidates without a normal name", () => {
  const result = mapPdfCandidatesToWorkItems([
    makeCandidate({ name: "   " }),
    makeCandidate({ name: "-" }),
    makeCandidate({ name: "  Клапан  ", position: undefined }),
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Клапан");
  assert.equal(result[0].position, undefined);
});
