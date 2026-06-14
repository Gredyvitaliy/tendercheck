import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { detectSpecificationSection } from "./detectSpecificationSection";
import { extractSpecificationRowCandidates } from "./extractSpecificationRows";
import { extractPdfPageTexts } from "./pdfTextExtractor";

const defaultOutputPath =
  "debug/specification-row-candidates.json";

export const testExtractSpecificationRows = async (
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

  const candidates = extractSpecificationRowCandidates(
    pages,
    specificationSection
  );
  const resolvedOutputPath = resolve(outputPath);

  console.log(
    `Specification section: pages ${specificationSection.startPage}-` +
      `${specificationSection.endPage}, sheets ` +
      `${specificationSection.sheetCount}`
  );
  console.log(`Candidates: ${candidates.length}`);
  console.log("First 50 candidates:");
  console.log(JSON.stringify(candidates.slice(0, 50), null, 2));

  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(
    resolvedOutputPath,
    JSON.stringify(candidates, null, 2),
    "utf8"
  );

  return resolvedOutputPath;
};

const pdfPath = process.argv[2];
const outputPath = process.argv[3] ?? defaultOutputPath;

if (!pdfPath) {
  console.error(
    "Usage: npx tsx " +
      "src/app/projectPdf/testExtractSpecificationRows.ts " +
      "<pdf-path> [output-path]"
  );
  process.exit(1);
}

testExtractSpecificationRows(pdfPath, outputPath)
  .then((writtenPath) => {
    console.log(`Specification row candidates: ${writtenPath}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
