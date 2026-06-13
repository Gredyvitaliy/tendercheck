import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import type { PdfPageText } from "./findSpecificationPages";

export const extractPdfPageTexts = async (
  fileBuffer: ArrayBuffer
): Promise<PdfPageText[]> => {
  const loadingTask = getDocument({
    data: new Uint8Array(fileBuffer),
  });
  const pdfDocument = await loadingTask.promise;

  try {
    const pages: PdfPageText[] = [];

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" ");

      pages.push({ pageNumber, text });
    }

    return pages;
  } finally {
    await loadingTask.destroy();
  }
};
