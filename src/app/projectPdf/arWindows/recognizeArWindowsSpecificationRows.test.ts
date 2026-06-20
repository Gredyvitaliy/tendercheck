import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { recognizeArWindowsSpecificationRows } from "./recognizeArWindowsSpecificationRows";

test("recognizes and normalizes AR windows rows through an OCR-ready provider", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "ar-windows-rows-"));
  const imagePath = path.join(tempDir, "ar-windows-page-1.png");

  try {
    await writeFile(imagePath, new Uint8Array([0x89, 0x50, 0x4e, 0x47]));

    const result = await recognizeArWindowsSpecificationRows({
      imagePath,
      provider: {
        recognizeRows: async (actualImagePath) => {
          assert.equal(actualImagePath, imagePath);
          return [
            {
              mark: " B-1 ",
              designation: " ГОСТ 22233-2001 ",
              name: " Витраж из алюминиевого профиля ",
              area: "103,95",
              quantity: "1",
            },
          ];
        },
      },
    });

    assert.deepEqual(result, [
      {
        mark: "B-1",
        designation: "ГОСТ 22233-2001",
        name: "Витраж из алюминиевого профиля",
        area: "103,95",
        quantity: "1",
        mass: "",
        note: "",
      },
    ]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
