import type { PdfPageText } from "./findSpecificationPages";

type PdfTextItem = {
  str: string;
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getTextContent: () => Promise<{ items: unknown[] }>;
  }>;
  destroy: () => Promise<void>;
};

type PdfJsModule = {
  getDocument: (options: { data: Uint8Array }) => {
    promise: Promise<PdfDocument>;
  };
};

const isPdfTextItem = (item: unknown): item is PdfTextItem =>
  typeof item === "object" &&
  item !== null &&
  "str" in item &&
  typeof item.str === "string";

export const extractPdfPageTexts = async (
  fileBuffer: ArrayBuffer
): Promise<PdfPageText[]> => {
  // TODO: Install pdfjs-dist before using PDF text extraction.
  const pdfJsModuleName = "pdfjs-dist";
  const pdfJs = (await import(pdfJsModuleName)) as PdfJsModule;
  const pdfDocument = await pdfJs.getDocument({
    data: new Uint8Array(fileBuffer),
  }).promise;

  try {
    const pages: PdfPageText[] = [];

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .filter(isPdfTextItem)
        .map((item) => item.str)
        .join(" ");

      pages.push({ pageNumber, text });
    }

    return pages;
  } finally {
    await pdfDocument.destroy();
  }
};
