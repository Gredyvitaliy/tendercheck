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

  return groupedSpecItems.map((spec) => {
    let bestMatch: WorkItem | undefined;
    let bestSimilarity = 0;

    groupedOfferItems.forEach((offer) => {
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
      }
    });

    if (!bestMatch || bestSimilarity < 30) {
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
        similarity: bestSimilarity,
      };
    }

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
};