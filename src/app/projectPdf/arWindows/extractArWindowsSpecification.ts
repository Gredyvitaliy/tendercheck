import { renderPdfPageToPng } from "./renderPdfPageToPng";
import type {
  ArWindowSpecificationColumn,
  ArWindowsExtractionResult,
} from "./types";

export const AR_WINDOW_SPECIFICATION_COLUMNS: ArWindowSpecificationColumn[] = [
  "mark",
  "designation",
  "name",
  "area",
  "quantity",
  "mass",
  "note",
];

export interface RenderArWindowsPageImageInput {
  pdfData: Uint8Array;
  outputPath: string;
  pageNumber: number;
}

export type RenderArWindowsPageImage = (
  input: RenderArWindowsPageImageInput
) => Promise<void>;

export interface ExtractArWindowsSpecificationDebugInput {
  pdfData: Uint8Array;
  outputPath: string;
  pageNumber?: number;
  renderPageImage?: RenderArWindowsPageImage;
}

export const extractArWindowsSpecificationDebug = async ({
  pdfData,
  outputPath,
  pageNumber = 1,
  renderPageImage = renderPdfPageToPng,
}: ExtractArWindowsSpecificationDebugInput): Promise<ArWindowsExtractionResult> => {
  await renderPageImage({
    pdfData,
    outputPath,
    pageNumber,
  });

  return {
    columns: AR_WINDOW_SPECIFICATION_COLUMNS,
    rows: [],
    extractionStatus: "debug-image-exported",
    debug: {
      pageNumber,
      imagePath: outputPath,
    },
  };
};
