import type { WorkItem, CompareResult } from "./types";
import { normalizeText } from "./utils";

const groupWorkItems = (items: WorkItem[]) => {
  return Object.values(
    items.reduce((acc, item) => {
      const key = normalizeText(`${item.name} ${item.rate} ${item.unit}`);

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

    if (!bestMatch || bestSimilarity < 30) {
      return {
        name: spec.name,
        rate: spec.rate,
        unit: spec.unit,
        specVolume: spec.projectVolume,

        offerName: bestMatch ? bestMatch.name : "-",
        offerRate: bestMatch ? bestMatch.rate : "-",
        offerUnit: bestMatch ? bestMatch.unit : "-",
        offerVolume: bestMatch ? bestMatch.projectVolume : "-",

        status: "Нет в КП",
        similarity: bestSimilarity,
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
  return (
    String(text)
      .toLowerCase()
      .replace(/в/g, "b")
      .match(/b\s*[-–—]?\s*\d+[а-яa-z0-9()]*/gi)
      ?.map((mark) =>
        mark
          .replace(/\s+/g, "")
          .replace(/[–—]/g, "-")
          .replace(/^b(?!-)/, "b-")
      ) || []
  );
};