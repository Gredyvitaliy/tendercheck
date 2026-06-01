import type { WorkItem, CompareResult } from "./types";
import { normalizeText } from "./utils";

const groupWorkItems = (items: WorkItem[]) => {
  return Object.values(
    items.reduce((acc, item) => {
      const marks = extractPositionMarks(`${item.name} ${item.rate}`);

      const key =
  marks.length > 0
    ? marks[0]
    : normalizeText(`${item.name} ${item.rate} ${item.unit}`);

      if (!acc[key]) {
        acc[key] = { ...item };
        return acc;
      }

      acc[key].projectVolume =
        Number(acc[key].projectVolume || 0) + Number(item.projectVolume || 0);

      return acc;
    }, {} as Record<string, WorkItem>)
  );
};

export const compareWorkItems = (
  specItems: WorkItem[],
  offerItems: WorkItem[]
): CompareResult[] => {
  const groupedSpecItems = groupWorkItems(specItems);
  const groupedOfferItems = groupWorkItems(offerItems);

  const usedOfferIndexes = new Set<number>();

  const comparison: CompareResult[] = groupedSpecItems.map((spec) => {
    let bestMatch: WorkItem | undefined;
    let bestMatchIndex = -1;
    let bestSimilarity = 0;

    groupedOfferItems.forEach((offer, offerIndex) => {
      if (usedOfferIndexes.has(offerIndex)) {
  return;
}
      const specName = normalizeText(`${spec.name} ${spec.rate}`);
      const offerName = normalizeText(`${offer.name} ${offer.rate}`);

      const words = specName.split(" ").filter((word) => word.length > 2);
      const matchedWords = words.filter((word) => offerName.includes(word));

      let similarity =
        words.length > 0 ? (matchedWords.length / words.length) * 100 : 0;

      const specTokens = specName.split(" ");
      const offerTokens = offerName.split(" ");

      const importantTokens = specTokens.filter((token) =>
        /[a-z]+[0-9]+|[0-9]+[a-z]+|[0-9]+x[0-9]+/i.test(token)
      );

      const matchedImportantTokens = importantTokens.filter((token) =>
        offerTokens.includes(token)
      );

      similarity += matchedImportantTokens.length * 20;

      const specMarks = extractPositionMarks(`${spec.name} ${spec.rate}`);
      const offerMarks = extractPositionMarks(`${offer.name} ${offer.rate}`);

      if (specMarks.length && offerMarks.length) {
        const hasSameMark = specMarks.some((mark) => offerMarks.includes(mark));

        if (hasSameMark) {
          similarity += 40;
        } else {
          similarity -= 60;
        }
      }

      const dimensionsSpec = specName.match(/\d+\-\d+|\d+x\d+/g) || [];
      const dimensionsOffer = offerName.match(/\d+\-\d+|\d+x\d+/g) || [];

      if (
        dimensionsSpec.length &&
        dimensionsOffer.length &&
        dimensionsSpec.join() !== dimensionsOffer.join()
      ) {
        similarity -= 50;
      }

      if (similarity > 100) {
        similarity = 100;
      }

      if (similarity < 0) {
        similarity = 0;
      }

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = offer;
        bestMatchIndex = offerIndex;
      }
    });

   if (!bestMatch || bestSimilarity < 50) {
  return {
    name: spec.name,
    rate: spec.rate,
    unit: spec.unit,
    specVolume: spec.projectVolume,

    offerName: "-",
    offerRate: "-",
    offerUnit: "-",
    offerVolume: "-",

    status: "Нет в КП",
    similarity: 0,
  };
}

    usedOfferIndexes.add(bestMatchIndex);

    if (bestSimilarity < 80) {
      return {
        name: spec.name,
        rate: spec.rate,
        unit: spec.unit,
        specVolume: spec.projectVolume,

        offerName: bestMatch.name,
        offerRate: bestMatch.rate,
        offerUnit: bestMatch.unit,
        offerVolume: bestMatch.projectVolume,

        status: "Частичное совпадение",
        similarity: bestSimilarity,
      };
    }

    if (Number(spec.projectVolume) !== Number(bestMatch.projectVolume)) {
      return {
        name: spec.name,
        rate: spec.rate,
        unit: spec.unit,
        specVolume: spec.projectVolume,

        offerName: bestMatch.name,
        offerRate: bestMatch.rate,
        offerUnit: bestMatch.unit,
        offerVolume: bestMatch.projectVolume,

        status: "Объем отличается",
        similarity: bestSimilarity,
      };
    }

    return {
      name: spec.name,
      rate: spec.rate,
      unit: spec.unit,
      specVolume: spec.projectVolume,

      offerName: bestMatch.name,
      offerRate: bestMatch.rate,
      offerUnit: bestMatch.unit,
      offerVolume: bestMatch.projectVolume,

      status: "ОК",
      similarity: bestSimilarity,
    };
  });

  const extraOfferItems: CompareResult[] = groupedOfferItems
    .filter((_, offerIndex) => !usedOfferIndexes.has(offerIndex))
    .map((offer) => ({
      name: "-",
      rate: "-",
      unit: "-",
      specVolume: "-",

      offerName: offer.name,
      offerRate: offer.rate,
      offerUnit: offer.unit,
      offerVolume: offer.projectVolume,

      status: "Есть в КП, нет в спецификации",
      similarity: 0,
    }));

  return [...comparison, ...extraOfferItems];
};
const extractPositionMarks = (text: string) => {
  const normalized = String(text)
    .toLowerCase()
    .replace(/[–—]/g, "-");

  const matches =
    normalized.match(/(?:вп|bp|в|b)\s*[-]?\s*\d+/gi) || [];

  return matches.map((mark) => {
    let cleaned = mark
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[–—]/g, "-");

    cleaned = cleaned.replace(/^вп/, "bp");
    cleaned = cleaned.replace(/^в/, "b");

    if (cleaned.startsWith("bp") && !cleaned.startsWith("bp-")) {
      cleaned = cleaned.replace(/^bp/, "bp-");
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