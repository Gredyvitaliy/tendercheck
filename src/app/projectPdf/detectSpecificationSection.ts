import { normalizePageText } from "./pageTextUtils";

export interface SpecificationSection {
  startPage: number;
  endPage: number;
  sheetCount: number;
  reason: string;
}

type PdfPageText = {
  pageNumber: number;
  text: string;
};

const specificationTitle =
  "спецификация оборудования, изделий и материалов";

const specificationCodePattern =
  /\.со(?=$|[^а-яёa-z0-9])/iu;

const firstSheetPattern =
  /(?:^|[^а-яёa-z0-9])лист\s*1(?=$|[^а-яёa-z0-9])/iu;

const sheetCountPattern =
  /(?:^|[^а-яёa-z0-9])листов\s*(\d+)(?=$|[^а-яёa-z0-9])/iu;

const stampColumnOrderPattern =
  /лист\s+листов[\s\S]{0,160}?\b1\s+(\d+)\b/iu;

const extractSheetCount = (text: string): number | null => {
  const directSheetCountMatch = text.match(sheetCountPattern);

  if (firstSheetPattern.test(text) && directSheetCountMatch) {
    return Number.parseInt(directSheetCountMatch[1], 10);
  }

  const stampColumnOrderMatch = text.match(stampColumnOrderPattern);
  return stampColumnOrderMatch
    ? Number.parseInt(stampColumnOrderMatch[1], 10)
    : null;
};

export function detectSpecificationSection(
  pages: PdfPageText[]
): SpecificationSection | null {
  for (const page of pages) {
    const normalizedText = normalizePageText(page.text);
    const hasSpecificationMarker =
      normalizedText.includes(specificationTitle) ||
      specificationCodePattern.test(normalizedText);
    const sheetCount = extractSheetCount(normalizedText);

    if (!hasSpecificationMarker || sheetCount === null) {
      continue;
    }

    if (!Number.isSafeInteger(sheetCount) || sheetCount <= 0) {
      continue;
    }

    return {
      startPage: page.pageNumber,
      endPage: page.pageNumber + sheetCount - 1,
      sheetCount,
      reason:
        `Найден титульный лист раздела спецификации: ` +
        `page ${page.pageNumber}, листов ${sheetCount}`,
    };
  }

  return null;
}
