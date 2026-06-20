import type { ArWindowSpecificationRow } from "./types";
import { fixWindows1251Mojibake } from "./fixMojibake";

export type RawArWindowSpecificationRow = Partial<
  Record<keyof ArWindowSpecificationRow, unknown>
>;

const normalizeCell = (value: unknown): string =>
  value === null || value === undefined
    ? ""
    : fixWindows1251Mojibake(String(value).replace(/\s+/g, " ").trim());

export const normalizeArWindowsSpecificationRows = (
  rows: RawArWindowSpecificationRow[]
): ArWindowSpecificationRow[] =>
  rows.map((row) => ({
    mark: normalizeCell(row.mark),
    designation: normalizeCell(row.designation),
    name: normalizeCell(row.name),
    area: normalizeCell(row.area),
    quantity: normalizeCell(row.quantity),
    mass: normalizeCell(row.mass),
    note: normalizeCell(row.note),
  }));
