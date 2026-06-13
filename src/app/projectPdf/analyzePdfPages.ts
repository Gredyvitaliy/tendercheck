import { findSpecificationPages } from "./findSpecificationPages";
import { extractPdfPageTexts } from "./pdfTextExtractor";

export const analyzePdfPages = async (fileBuffer: ArrayBuffer) => {
  const pages = await extractPdfPageTexts(fileBuffer);
  const specificationPages = findSpecificationPages(pages);

  return {
    totalPages: pages.length,
    specificationPages: specificationPages.map((page) => ({
      pageNumber: page.pageNumber,
      textPreview: page.text.slice(0, 500),
    })),
  };
};
