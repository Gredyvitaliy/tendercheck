import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { assertPdfPageLimit } from "../pdfTextExtractor";

export interface RenderPdfPageToPngInput {
  pdfData: Uint8Array;
  outputPath: string;
  pageNumber: number;
  scale?: number;
}

export const renderPdfPageToPng = async ({
  pdfData,
  outputPath,
  pageNumber,
  scale = 2,
}: RenderPdfPageToPngInput): Promise<void> => {
  const loadingTask = getDocument({
    data: Uint8Array.from(pdfData),
  });
  const pdfDocument = await loadingTask.promise;

  try {
    assertPdfPageLimit(pdfDocument.numPages);

    if (pageNumber < 1 || pageNumber > pdfDocument.numPages) {
      throw new Error(
        `PDF page ${pageNumber} is outside the document page range 1-${pdfDocument.numPages}`
      );
    }

    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height)
    );
    const canvasContext = canvas.getContext("2d");

    await page.render({
      canvasContext: canvasContext as unknown as CanvasRenderingContext2D,
      canvas: canvas as unknown as HTMLCanvasElement,
      viewport,
    }).promise;

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, canvas.toBuffer("image/png"));
  } finally {
    await loadingTask.destroy();
  }
};
