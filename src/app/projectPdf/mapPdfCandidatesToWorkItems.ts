import type { WorkItem } from "../types";
import type { PdfSpecificationRowCandidate } from "./extractSpecificationRows";

const minimumConfidence = 0.5;

const normalizeUnit = (unit?: string): string => {
  const normalizedUnit = unit?.trim() ?? "";
  return normalizedUnit === "-" ? "" : normalizedUnit;
};

const normalizeQuantity = (quantity?: number): number =>
  typeof quantity === "number" &&
  Number.isFinite(quantity) &&
  quantity > 0
    ? quantity
    : 0;

const normalizeName = (name: string): string => name.trim();

const isNormalName = (name: string): boolean =>
  name.length > 0 && name !== "-";

export function mapPdfCandidatesToWorkItems(
  candidates: PdfSpecificationRowCandidate[]
): WorkItem[] {
  const workItems: WorkItem[] = [];

  for (const candidate of candidates) {
    if (candidate.confidence < minimumConfidence) {
      continue;
    }

    const name = normalizeName(candidate.name);
    if (!isNormalName(name)) {
      continue;
    }

    const position = candidate.position?.trim();

    workItems.push({
      number: workItems.length,
      name,
      rate: "",
      unit: normalizeUnit(candidate.unit),
      projectVolume: normalizeQuantity(candidate.quantity),
      rowType: "item",
      ...(position ? { position } : {}),
    });
  }

  return workItems;
}
