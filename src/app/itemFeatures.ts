import type { WorkItem } from "./types";
import { normalizeText } from "./utils";

export type ItemFeatures = {
  text: string;
  itemType: string;
  marks: string[];
  dimensions: string[];
  gosts: string[];
};

const extractPositionMarks = (text: string) => {
  const normalized = String(text)
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/в/g, "b")
    .replace(/п/g, "p")
    .replace(/д/g, "d");

  const matches = Array.from(
    normalized.matchAll(/(?:^|[^a-zа-я0-9])((?:bp|b|pd)\s*[-]?\s*\d+)/gi)
  );

  return matches.map((match) => {
    let cleaned = match[1]
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[–—]/g, "-");

    if (cleaned.startsWith("bp") && !cleaned.startsWith("bp-")) {
      cleaned = cleaned.replace(/^bp/, "bp-");
    }

    if (cleaned.startsWith("pd") && !cleaned.startsWith("pd-")) {
      cleaned = cleaned.replace(/^pd/, "pd-");
    }

    if (
      cleaned.startsWith("b") &&
      !cleaned.startsWith("b-") &&
      !cleaned.startsWith("bp-")
    ) {
      cleaned = cleaned.replace(/^b/, "b-");
    }

    return cleaned;
  });
};

const extractDimensions = (text: string) => {
  const normalized = String(text)
    .toLowerCase()
    .replace(/[×х*]/g, "x")
    .replace(/[–—]/g, "-");

  const dimensions: string[] = [];
  const regex = /(\d{2,6})\s*x\s*(\d{2,6})/g;

  let match = regex.exec(normalized);

  while (match) {
    dimensions.push(`${match[1]}x${match[2]}`);
    match = regex.exec(normalized);
  }

  return dimensions;
};

const extractGosts = (text: string) => {
  const normalized = String(text).toLowerCase();

  const matches = normalized.match(/\d{4,5}-\d{4}/g) || [];

  return matches;
};

const detectItemType = (text: string) => {
  const normalized = normalizeText(text);

  if (normalized.includes("подоконник")) return "подоконник";
  if (normalized.includes("перегород")) return "перегородка";
  if (normalized.includes("витраж")) return "витраж";
  if (normalized.includes("двер")) return "дверь";
  if (normalized.includes("окн")) return "окно";
  if (normalized.includes("ворот")) return "ворота";

  return "прочее";
};

export const extractItemFeatures = (
  item: Pick<WorkItem, "name" | "rate"> | string
): ItemFeatures => {
  const text =
    typeof item === "string" ? item : `${item.name || ""} ${item.rate || ""}`;

  return {
    text: normalizeText(text),
    itemType: detectItemType(text),
    marks: extractPositionMarks(text),
    dimensions: extractDimensions(text),
    gosts: extractGosts(text),
  };
};