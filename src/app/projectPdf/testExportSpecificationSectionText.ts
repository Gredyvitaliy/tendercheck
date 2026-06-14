import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { detectSpecificationSection } from "./detectSpecificationSection";
import {
  exportSpecificationSectionText,
  formatSpecificationSectionDebugOutput,
} from "./exportSpecificationSectionText";
import { extractPdfPageTexts } from "./pdfTextExtractor";

const defaultOutputPath = "debug/specification-section.txt";

export const testExportSpecificationSectionText = async (
  pdfPath: string,
  outputPath = defaultOutputPath
): Promise<string> => {
  const pdfFile = await readFile(pdfPath);
  const pdfData = new Uint8Array(
    pdfFile.buffer,
    pdfFile.byteOffset,
    pdfFile.byteLength
  );
  const pages = await extractPdfPageTexts(pdfData);
  const specificationSection = detectSpecificationSection(pages);

  if (!specificationSection) {
    throw new Error("Specification section was not found");
  }

  const debugOutput = exportSpecificationSectionText(
    pages,
    specificationSection
  );
  const formattedOutput =
    formatSpecificationSectionDebugOutput(debugOutput);
  const resolvedOutputPath = resolve(outputPath);

  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, formattedOutput, "utf8");

  return resolvedOutputPath;
};

const pdfPath = process.argv[2];
const outputPath = process.argv[3] ?? defaultOutputPath;

if (!pdfPath) {
  console.error(
    "Usage: npx tsx " +
      "src/app/projectPdf/testExportSpecificationSectionText.ts " +
      "<pdf-path> [output-path]"
  );
  process.exit(1);
}

testExportSpecificationSectionText(pdfPath, outputPath)
  .then((writtenPath) => {
    console.log(`Specification section debug export: ${writtenPath}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
