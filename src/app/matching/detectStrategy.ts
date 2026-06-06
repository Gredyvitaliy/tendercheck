import type { WorkItem } from "../types";
import { normalizeText } from "../utils";
import { extractItemFeatures } from "../itemFeatures";

export type MatchStrategy = "mark-based" | "equipment" | "text";

const hasEquipmentKeywords = (item: WorkItem) => {
  const text = normalizeText(`${item.name} ${item.rate}`);

  return (
    text.includes("airned") ||
    text.includes("litened") ||
    text.includes("вентилятор") ||
    text.includes("шумоглушитель") ||
    text.includes("воздухонагреватель") ||
    text.includes("воздухоохладитель") ||
    text.includes("заслонка") ||
    text.includes("клапан") ||
    text.includes("вставка") ||
    text.includes("решетка") ||
    text.includes("решётка") ||
    text.includes("фильтр") ||
    text.includes("блок кондиционера") ||
    text.includes("кондиционер") ||
    text.includes("адаптер") ||
    text.includes("кабель")
  );
};

export const detectItemStrategy = (item: WorkItem): MatchStrategy => {
  const features = extractItemFeatures(item);
  const text = normalizeText(`${item.name} ${item.rate}`);

  if (
    features.marks.length > 0 ||
    text.includes("витраж") ||
    text.includes("светопрозрач") ||
    text.includes("перегород") ||
    text.includes("подоконник")
  ) {
    return "mark-based";
  }

  if (hasEquipmentKeywords(item)) {
    return "equipment";
  }

  return "text";
};

