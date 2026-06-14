import { readFile } from "node:fs/promises";

import {
  classifyPdfPage,
  type PdfPageClass,
} from "./classifyPdfPage";
import { detectSpecificationSection } from "./detectSpecificationSection";
import { extractPdfPageTexts } from "./pdfTextExtractor";

const pageClasses: PdfPageClass[] = [
  "specification",
  "equipment-selection",
  "local-exhaust-table",
  "general-data",
  "commercial-letter",
  "unknown",
];

export const testClassifyPdfPages = async (
  pdfPath: string
): Promise<void> => {
  const pdfFile = await readFile(pdfPath);
  const pdfData = new Uint8Array(
    pdfFile.buffer,
    pdfFile.byteOffset,
    pdfFile.byteLength
  );
  const pages = await extractPdfPageTexts(pdfData);
  const specificationSection = detectSpecificationSection(pages);
  const counts = Object.fromEntries(
    pageClasses.map((type) => [type, 0])
  ) as Record<PdfPageClass, number>;

  if (specificationSection) {
    console.log(
      `Specification section: pages ${specificationSection.startPage}` +
        `-${specificationSection.endPage}, sheets ` +
        `${specificationSection.sheetCount}`
    );
    console.log();
  } else {
    console.log("Specification section: not found");
    console.log();
  }

  for (const page of pages) {
    const pageClassification = classifyPdfPage(page.pageNumber, page.text);
    const isInSpecificationSection =
      specificationSection !== null &&
      page.pageNumber >= specificationSection.startPage &&
      page.pageNumber <= specificationSection.endPage;
    const classification = isInSpecificationSection
      ? {
          ...pageClassification,
          type: "specification" as const,
          reasons: [
            ...pageClassification.reasons,
            `Страница входит в найденный раздел спецификации: pages ` +
              `${specificationSection.startPage}-` +
              `${specificationSection.endPage}`,
          ],
        }
      : pageClassification;
    counts[classification.type] += 1;

    console.log(
      `Page ${classification.pageNumber}: ${classification.type}, score ${classification.score}`
    );
    console.log("Reasons:");

    if (classification.reasons.length === 0) {
      console.log("- Классифицирующие признаки не найдены");
    } else {
      for (const reason of classification.reasons) {
        console.log(`- ${reason}`);
      }
    }

    console.log();
  }

  console.log("Aggregate:");
  for (const type of pageClasses) {
    console.log(`${type}: ${counts[type]}`);
  }
};

const pdfPath = process.argv[2];

if (!pdfPath) {
  console.error(
    "Usage: npx tsx src/app/projectPdf/testClassifyPdfPages.ts <pdf-path>"
  );
  process.exit(1);
}

testClassifyPdfPages(pdfPath).catch((error) => {
  console.error(error);
  process.exit(1);
});
