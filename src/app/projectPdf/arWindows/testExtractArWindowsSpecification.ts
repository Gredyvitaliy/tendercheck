import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  extractArWindowsSpecificationDebug,
  type RenderArWindowsPageImage,
} from "./extractArWindowsSpecification";

const DEFAULT_OUTPUT_PATH = path.join(
  process.cwd(),
  "debug",
  "ar-windows-page-1.png"
);

interface TestExtractArWindowsSpecificationOptions {
  outputPath?: string;
  logger?: (message: string) => void;
  renderPageImage?: RenderArWindowsPageImage;
}

export const testExtractArWindowsSpecification = async (
  pdfPath: string,
  optionsOrOutputPath: TestExtractArWindowsSpecificationOptions | string = {}
): Promise<void> => {
  const options =
    typeof optionsOrOutputPath === "string"
      ? { outputPath: optionsOrOutputPath }
      : optionsOrOutputPath;
  const outputPath = options.outputPath ?? DEFAULT_OUTPUT_PATH;
  const logger = options.logger ?? console.log;
  const resolvedPdfPath = path.resolve(pdfPath);

  logger(`Rendering AR windows PDF: ${resolvedPdfPath}`);

  const pdfFile = await readFile(resolvedPdfPath);
  const pdfData = new Uint8Array(
    pdfFile.buffer,
    pdfFile.byteOffset,
    pdfFile.byteLength
  );

  const result = await extractArWindowsSpecificationDebug({
    pdfData,
    outputPath,
    pageNumber: 1,
    renderPageImage: options.renderPageImage,
  });

  logger(JSON.stringify(result, null, 2));
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pdfPath = process.argv[2];
  const outputPath = process.argv[3] ?? DEFAULT_OUTPUT_PATH;

  if (!pdfPath) {
    console.error(
      "Usage: npx tsx src/app/projectPdf/arWindows/testExtractArWindowsSpecification.ts <pdf-path> [output-png-path]"
    );
    process.exit(1);
  }

  testExtractArWindowsSpecification(pdfPath, outputPath).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
