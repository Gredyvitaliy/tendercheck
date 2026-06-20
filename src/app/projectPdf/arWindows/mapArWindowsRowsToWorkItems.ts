import type { WorkItem } from "../../types";
import { fixWindows1251Mojibake } from "./fixMojibake";
import type { ArWindowSpecificationRow } from "./types";

export const normalizeArWindowsQuantity = (quantity: string): number => {
  const normalized = Number(quantity.trim().replace(",", "."));

  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
};

const normalizeWorkItemNumber = (
  mark: string,
  fallbackNumber: number
): number => {
  const numericMark = Number.parseInt(mark.replace(/^[^\d]+/, ""), 10);

  return Number.isFinite(numericMark) ? numericMark : fallbackNumber;
};

const buildWorkItemName = (row: ArWindowSpecificationRow): string =>
  fixWindows1251Mojibake(
    [row.mark, row.designation, row.name].filter(Boolean).join(" ").trim()
  );

export const mapArWindowsRowsToWorkItems = (
  rows: ArWindowSpecificationRow[]
): WorkItem[] =>
  rows.map((row, index) => {
    const mark = fixWindows1251Mojibake(row.mark);

    return {
      number: normalizeWorkItemNumber(mark, index),
      name: buildWorkItemName(row),
      rate: "",
      unit: fixWindows1251Mojibake("С€С‚"),
      projectVolume: normalizeArWindowsQuantity(row.quantity),
      rowType: "item",
      ...(mark ? { position: mark } : {}),
    };
  });
