import type { SpecificationSection } from "./detectSpecificationSection";
import type { PdfPageText } from "./findSpecificationPages";
import { normalizePageText } from "./pageTextUtils";

export interface SpecificationPageDebug {
  pageNumber: number;
  rawText: string;
  normalizedText: string;
  firstLines: string[];
  lastLines: string[];
  positionLikeLines: string[];
}

export interface SpecificationSectionDebugOutput {
  section: SpecificationSection;
  pages: SpecificationPageDebug[];
}

const previewLineCount = 10;

const splitLines = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

const positionNumberPattern =
  /(?:^|\s)\d+(?:\.\d+)*[.)]?(?=\s|$)/u;

const unitPattern =
  /(?:^|\s)(?:шт|м[23²³]?|кг|к-т|комплект|м\.п\.)(?=\s|$)/iu;

const quantityPattern =
  /(?:^|\s)\d+(?:[.,]\d+)?(?=\s|$)/u;

const engineeringPattern =
  /вентилятор|клапан|воздуховод|шумоглушитель|реш[её]тка|диффузор|зонт|насос|фильтр|установка|изоляц|креплен/iu;

const looksLikePositionLine = (line: string): boolean => {
  const hasPosition = positionNumberPattern.test(line);
  const hasUnit = unitPattern.test(line);
  const hasQuantity = quantityPattern.test(line);
  const hasEngineeringTerm = engineeringPattern.test(line);

  return (
    (hasPosition && hasEngineeringTerm) ||
    (hasEngineeringTerm && hasUnit && hasQuantity) ||
    (hasPosition && hasUnit && hasQuantity)
  );
};

export function exportSpecificationSectionText(
  pages: PdfPageText[],
  specificationSection: SpecificationSection
): SpecificationSectionDebugOutput {
  const sectionPages = pages
    .filter(
      (page) =>
        page.pageNumber >= specificationSection.startPage &&
        page.pageNumber <= specificationSection.endPage
    )
    .map((page) => {
      const lines = splitLines(page.text);

      return {
        pageNumber: page.pageNumber,
        rawText: page.text,
        normalizedText: normalizePageText(page.text),
        firstLines: lines.slice(0, previewLineCount),
        lastLines: lines.slice(-previewLineCount),
        positionLikeLines: lines.filter(looksLikePositionLine),
      };
    });

  return {
    section: specificationSection,
    pages: sectionPages,
  };
}

const formatLines = (lines: string[]): string =>
  lines.length > 0 ? lines.join("\n") : "(none)";

export function formatSpecificationSectionDebugOutput(
  output: SpecificationSectionDebugOutput
): string {
  const header = [
    `Specification section: pages ${output.section.startPage}-` +
      `${output.section.endPage}, sheets ${output.section.sheetCount}`,
    `Reason: ${output.section.reason}`,
    `Exported pages: ${output.pages.length}`,
  ].join("\n");

  const pageBlocks = output.pages.map((page) =>
    [
      "=".repeat(80),
      `PAGE ${page.pageNumber}`,
      "=".repeat(80),
      "",
      "FIRST LINES",
      "-".repeat(80),
      formatLines(page.firstLines),
      "",
      "LAST LINES",
      "-".repeat(80),
      formatLines(page.lastLines),
      "",
      "POSITION-LIKE LINES",
      "-".repeat(80),
      formatLines(page.positionLikeLines),
      "",
      "RAW TEXT",
      "-".repeat(80),
      page.rawText || "(empty)",
      "",
      "NORMALIZED TEXT",
      "-".repeat(80),
      page.normalizedText || "(empty)",
    ].join("\n")
  );

  return [header, ...pageBlocks, ""].join("\n\n");
}
