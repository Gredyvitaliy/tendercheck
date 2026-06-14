import {
  classifyPdfPage,
  type PdfPageClass,
  type PdfPageClassification,
} from "./classifyPdfPage";
import {
  detectSpecificationSection,
  type SpecificationSection,
} from "./detectSpecificationSection";
import type { PdfPageText } from "./findSpecificationPages";
import {
  extractPdfPageTexts,
  type PdfBinaryData,
} from "./pdfTextExtractor";

const pageClasses: PdfPageClass[] = [
  "specification",
  "equipment-selection",
  "local-exhaust-table",
  "general-data",
  "commercial-letter",
  "unknown",
];

export interface PdfClassificationSummary {
  totalPages: number;
  specificationSection: SpecificationSection | null;
  aggregate: Record<PdfPageClass, number>;
  specificationPages: number[];
  selectedPages: {
    page41: PdfPageClassification | null;
    page118: PdfPageClassification | null;
  };
  pages: PdfPageClassification[];
}

export const summarizePdfPageClassifications = (
  pages: PdfPageText[]
): PdfClassificationSummary => {
  const specificationSection = detectSpecificationSection(pages);
  const aggregate = Object.fromEntries(
    pageClasses.map((type) => [type, 0])
  ) as Record<PdfPageClass, number>;

  const classifications = pages.map((page) => {
    const classification = classifyPdfPage(page.pageNumber, page.text);
    const isInSpecificationSection =
      specificationSection !== null &&
      page.pageNumber >= specificationSection.startPage &&
      page.pageNumber <= specificationSection.endPage;

    const finalClassification: PdfPageClassification =
      isInSpecificationSection
        ? {
            ...classification,
            type: "specification",
            reasons: [
              ...classification.reasons,
              `Страница входит в найденный раздел спецификации: pages ` +
                `${specificationSection.startPage}-` +
                `${specificationSection.endPage}`,
            ],
          }
        : classification;

    aggregate[finalClassification.type] += 1;
    return finalClassification;
  });

  return {
    totalPages: pages.length,
    specificationSection,
    aggregate,
    specificationPages: classifications
      .filter((page) => page.type === "specification")
      .map((page) => page.pageNumber),
    selectedPages: {
      page41:
        classifications.find((page) => page.pageNumber === 41) ?? null,
      page118:
        classifications.find((page) => page.pageNumber === 118) ?? null,
    },
    pages: classifications,
  };
};

export const analyzePdfClassification = async (
  pdfData: PdfBinaryData
): Promise<PdfClassificationSummary> => {
  const pages = await extractPdfPageTexts(pdfData);
  return summarizePdfPageClassifications(pages);
};
