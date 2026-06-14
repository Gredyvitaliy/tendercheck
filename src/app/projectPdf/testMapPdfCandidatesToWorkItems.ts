import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { detectSpecificationSection } from "./detectSpecificationSection";
import { extractSpecificationRowCandidates } from "./extractSpecificationRows";
import { mapPdfCandidatesToWorkItems } from "./mapPdfCandidatesToWorkItems";
import { extractPdfPageTexts } from "./pdfTextExtractor";

const defaultOutputPath = "debug/pdf-work-items.json";

export const testMapPdfCandidatesToWorkItems = async (
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
  const workItems = mapPdfCandidatesToWorkItems(candidates);
  const resolvedOutputPath = resolve(outputPath);

  console.log(
    `Specification section: pages ${specificationSection.startPage}-` +
      `${specificationSection.endPage}, sheets ` +
      `${specificationSection.sheetCount}`
  );
  console.log(`Candidates: ${candidates.length}`);
  console.log(`WorkItems: ${workItems.length}`);
  console.log("First 50 WorkItems:");
  console.log(JSON.stringify(workItems.slice(0, 50), null, 2));

  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(
    resolvedOutputPath,
    JSON.stringify(workItems, null, 2),
    "utf8"
  );

  return resolvedOutputPath;
};

const pdfPath = process.argv[2];
const outputPath = process.argv[3] ?? defaultOutputPath;

if (!pdfPath) {
  console.error(
    "Usage: npx tsx " +
      "src/app/projectPdf/testMapPdfCandidatesToWorkItems.ts " +
      "<pdf-path> [output-path]"
  );
  process.exit(1);
}

testMapPdfCandidatesToWorkItems(pdfPath, outputPath)
  .then((writtenPath) => {
    console.log(`PDF WorkItems: ${writtenPath}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
