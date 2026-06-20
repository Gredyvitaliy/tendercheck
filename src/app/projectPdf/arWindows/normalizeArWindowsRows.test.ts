import assert from "node:assert/strict";
import test from "node:test";

import { normalizeArWindowsSpecificationRows } from "./normalizeArWindowsRows";

test("normalizes AR windows row fields to trimmed strings", () => {
  const rows = normalizeArWindowsSpecificationRows([
    {
      mark: "  B-16* ",
      designation: " ГОСТ 22233-2001 ",
      name:
        " Витраж   из алюминиевого профиля\nс заполнением СПД 4М1-10-4М1 ",
      area: " 7,14 ",
      quantity: " 3 ",
      mass: null,
      note: "  Наружный слой\nостекления из закаленного стекла ",
    },
  ]);

  assert.deepEqual(rows, [
    {
      mark: "B-16*",
      designation: "ГОСТ 22233-2001",
      name: "Витраж из алюминиевого профиля с заполнением СПД 4М1-10-4М1",
      area: "7,14",
      quantity: "3",
      mass: "",
      note: "Наружный слой остекления из закаленного стекла",
    },
  ]);
});

test("keeps the full AR windows row shape when OCR misses cells", () => {
  const rows = normalizeArWindowsSpecificationRows([
    {
      mark: "ПД-1",
      name: "подоконник шириной 300",
      area: "180,3м",
    },
  ]);

  assert.deepEqual(rows, [
    {
      mark: "ПД-1",
      designation: "",
      name: "подоконник шириной 300",
      area: "180,3м",
      quantity: "",
      mass: "",
      note: "",
    },
  ]);
});
