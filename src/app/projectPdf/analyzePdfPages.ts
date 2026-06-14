import { findSpecificationPages } from "./findSpecificationPages";
import {
  extractPdfPageTexts,
  type PdfBinaryData,
} from "./pdfTextExtractor";

export const analyzePdfPages = async (pdfData: PdfBinaryData) => {
  const pages = await extractPdfPageTexts(pdfData);
  const specificationPages = findSpecificationPages(pages);

  return {
    totalPages: pages.length,
    specificationPages: specificationPages.map((page) => ({
      pageNumber: page.pageNumber,
      textPreview: page.text.slice(0, 500),
    })),
  };
};
