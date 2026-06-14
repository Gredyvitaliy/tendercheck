import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import type { PdfPageText } from "./findSpecificationPages";

export type PdfBinaryData = ArrayBuffer | Uint8Array;

export const toPdfData = (data: PdfBinaryData): Uint8Array =>
  data instanceof ArrayBuffer
    ? new Uint8Array(data)
    : Uint8Array.from(data);

export const extractPdfPageTexts = async (
  binaryData: PdfBinaryData
): Promise<PdfPageText[]> => {
  const pdfData = toPdfData(binaryData);
  const loadingTask = getDocument({
    data: pdfData,
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
