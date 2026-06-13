import { readFile } from "node:fs/promises";

import { analyzePdfPages } from "./analyzePdfPages";

export const testPdfPipeline = async (pdfPath: string): Promise<void> => {
  const pdfFile = await readFile(pdfPath);
  const fileBuffer = pdfFile.buffer.slice(
    pdfFile.byteOffset,
    pdfFile.byteOffset + pdfFile.byteLength
  ) as ArrayBuffer;
  const result = await analyzePdfPages(fileBuffer);

  console.log("Total pages:", result.totalPages);
  console.log(
    "Detected specification page numbers:",
    result.specificationPages.map((page) => page.pageNumber)
  );

  for (const page of result.specificationPages) {
    console.log(
      `Page ${page.pageNumber}:`,
      page.textPreview.slice(0, 200)
    );
  }
};
