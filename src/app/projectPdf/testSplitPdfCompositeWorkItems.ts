import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { detectSpecificationSection } from "./detectSpecificationSection";
import { extractSpecificationRowCandidates } from "./extractSpecificationRows";
import { mapPdfCandidatesToWorkItems } from "./mapPdfCandidatesToWorkItems";
import { extractPdfPageTexts } from "./pdfTextExtractor";
import { splitPdfCompositeWorkItems } from "./splitPdfCompositeWorkItems";

const defaultOutputPath = "debug/pdf-work-items-split.json";

export const testSplitPdfCompositeWorkItems = async (
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
  const beforeSplit = mapPdfCandidatesToWorkItems(candidates);
  const afterSplit = splitPdfCompositeWorkItems(beforeSplit);
  const resolvedOutputPath = resolve(outputPath);

  console.log(`Count before: ${beforeSplit.length}`);
  console.log(`Count after: ${afterSplit.length}`);
  console.log("First 50 split items:");
  console.log(JSON.stringify(afterSplit.slice(0, 50), null, 2));

  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(
    resolvedOutputPath,
    JSON.stringify(afterSplit, null, 2),
    "utf8"
  );

  return resolvedOutputPath;
};

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMainModule) {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.error(
      "Usage: npx tsx " +
        "src/app/projectPdf/testSplitPdfCompositeWorkItems.ts " +
        "<pdf-path>"
    );
    process.exitCode = 1;
  } else {
    testSplitPdfCompositeWorkItems(pdfPath)
      .then((writtenPath) => {
        console.log(`Split PDF WorkItems: ${writtenPath}`);
      })
      .catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
  }
}
