import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  AR_WINDOW_SPECIFICATION_COLUMNS,
  extractArWindowsSpecificationDebug,
} from "./extractArWindowsSpecification";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lYv9WQAAAABJRU5ErkJggg==",
  "base64"
);

test("prepares the AR windows result shape and exports a debug PNG", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "ar-windows-"));
  const outputPath = path.join(tempDir, "ar-windows-page-1.png");

  try {
    const result = await extractArWindowsSpecificationDebug({
      pdfData: new Uint8Array([1, 2, 3]),
      outputPath,
      pageNumber: 1,
      renderPageImage: async ({ outputPath: rendererOutputPath }) => {
        await writeFile(rendererOutputPath, tinyPng);
      },
    });

    assert.deepEqual(result.columns, AR_WINDOW_SPECIFICATION_COLUMNS);
    assert.deepEqual(result.rows, []);
    assert.equal(result.extractionStatus, "debug-image-exported");
    assert.deepEqual(result.debug, {
      pageNumber: 1,
      imagePath: outputPath,
    });

    const written = await readFile(outputPath);
    assert.deepEqual(written.subarray(0, 8), tinyPng.subarray(0, 8));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
