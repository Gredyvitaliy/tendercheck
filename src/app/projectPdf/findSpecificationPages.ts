import { detectSpecificationPage } from "./extractSpecificationPages";

export type PdfPageText = {
  pageNumber: number;
  text: string;
};

export const findSpecificationPages = (
  pages: PdfPageText[]
): PdfPageText[] =>
  pages.filter((page) => detectSpecificationPage(page.text));
