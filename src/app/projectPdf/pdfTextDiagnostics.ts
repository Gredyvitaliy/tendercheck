import type { PdfPageText } from "./findSpecificationPages";

export interface PdfTextLayerDiagnostics {
  extractedTextLength: number;
  pagesWithTextCount: number;
  likelyScannedOrDrawingPdf: boolean;
}

const MIN_EXTRACTED_TEXT_LENGTH = 50;

export const getPdfTextLayerDiagnostics = (
  pages: PdfPageText[]
): PdfTextLayerDiagnostics => {
  const pageTextLengths = pages.map((page) => page.text.trim().length);
  const extractedTextLength = pageTextLengths.reduce(
    (total, length) => total + length,
    0
  );
  const pagesWithTextCount = pageTextLengths.filter(
    (length) => length > 0
  ).length;

  return {
    extractedTextLength,
    pagesWithTextCount,
    likelyScannedOrDrawingPdf:
      pages.length > 0 && extractedTextLength < MIN_EXTRACTED_TEXT_LENGTH,
  };
};
