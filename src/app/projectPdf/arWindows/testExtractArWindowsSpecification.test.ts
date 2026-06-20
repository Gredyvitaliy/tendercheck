import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { testExtractArWindowsSpecification } from "./testExtractArWindowsSpecification";

const minimalPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lYv9WQAAAABJRU5ErkJggg==",
  "base64"
);

test("logs the explicit PDF path used by the AR windows render prototype", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "ar-windows-cli-"));
  const pdfPath = path.join(tempDir, "Спецификация.pdf");
  const outputPath = path.join(tempDir, "ar-windows-page-1.png");
  const logs: string[] = [];

  try {
    await writeFile(pdfPath, minimalPdfBytes);

    await testExtractArWindowsSpecification(pdfPath, {
      outputPath,
      logger: (message) => {
        logs.push(message);
      },
      renderPageImage: async ({ outputPath: rendererOutputPath }) => {
        await writeFile(rendererOutputPath, tinyPng);
      },
    });

    assert.equal(logs[0], `Rendering AR windows PDF: ${pdfPath}`);
    assert.deepEqual(
      (await readFile(outputPath)).subarray(0, 8),
      tinyPng.subarray(0, 8)
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
