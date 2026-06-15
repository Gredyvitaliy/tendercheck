import type { WorkItem } from "../types";

export interface SplitPdfWorkItem extends WorkItem {
  debugReason?: "split from composite PDF item";
  parentPosition?: string;
}

type SplitPart = {
  name: string;
  unit: string;
  projectVolume: number;
};

const quantityBoundaryPattern =
  /(?:^|\s)(шт|к-т|м|кг)\s+(\d+(?:[.,]\d+)?)\s*(?:[«"]?\s*или\s+аналог\s*[»"]?)?/giu;

const wholeAirnedInstallationPattern =
  /установка[^]*?\bAIRNED\s*-\s*[A-ZА-Я0-9.]+(?:\s*\/\s*[A-ZА-Я0-9.]+){3,}[^]*?\bNED\b/iu;

const cleanPartName = (name: string): string =>
  name
    .replace(/[«"]?\s*или\s+аналог\s*[»"]?/giu, " ")
    .replace(/\s+/g, " ")
    .replace(/^[,;:.\s]+|[,;:.\s]+$/g, "")
    .trim();

const removeParentPrefix = (name: string): string => {
  const performancePrefix =
    /^.{0,80}\((?=[^)]*(?:L\s*=|P[сc]\s*=|м3\/ч|Па))[^)]*\)\s*/iu;
  if (performancePrefix.test(name)) {
    return name.replace(performancePrefix, "");
  }

  return name.replace(/^\S+\s+\([^)]*\)\s*/u, "");
};

const parseSplitParts = (name: string): SplitPart[] => {
  const matches = [...name.matchAll(quantityBoundaryPattern)];
  const parts: SplitPart[] = [];
  let cursor = 0;

  for (const match of matches) {
    const matchIndex = match.index ?? 0;
    const partName = cleanPartName(name.slice(cursor, matchIndex));

    if (partName) {
      parts.push({
        name: partName,
        unit: match[1].toLowerCase(),
        projectVolume: Number.parseFloat(match[2].replace(",", ".")),
      });
    }

    cursor = matchIndex + match[0].length;
  }

  const trailingName = cleanPartName(name.slice(cursor));
  if (trailingName) {
    parts.push({
      name: trailingName,
      unit: "",
      projectVolume: 0,
    });
  }

  return parts;
};

const splitOneItem = (item: WorkItem): SplitPdfWorkItem[] => {
  if (wholeAirnedInstallationPattern.test(item.name)) {
    return [{ ...item }];
  }

  const parts = parseSplitParts(item.name);
  if (parts.length < 2) {
    return [{ ...item }];
  }

  const parentPosition = item.position;

  return parts.map((part, index) => ({
    ...item,
    name: index === 0 ? removeParentPrefix(part.name) : part.name,
    unit: part.unit,
    projectVolume: part.projectVolume,
    position: parentPosition
      ? `${parentPosition}.${index + 1}`
      : item.position,
    debugReason: "split from composite PDF item",
    ...(parentPosition ? { parentPosition } : {}),
  }));
};

export const splitPdfCompositeWorkItems = (
  items: WorkItem[]
): SplitPdfWorkItem[] =>
  items
    .flatMap(splitOneItem)
    .map((item, number) => ({ ...item, number }));
