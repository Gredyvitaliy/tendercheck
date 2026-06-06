import type { WorkItem } from "../types";
import { getPrimaryMark, haveDifferentDimensions } from "./matchUtils";

export type MarkMatchResult = {
  canCompare: boolean;
  reason: string;
  isStrongMatch: boolean;
  hasDifferentDimensions: boolean;
};

export const matchByMarks = (
  spec: WorkItem,
  offer: WorkItem
): MarkMatchResult => {
  const specMark = getPrimaryMark(spec);
  const offerMark = getPrimaryMark(offer);

  if (!specMark || !offerMark) {
    return {
      canCompare: false,
      reason: "Марка не найдена в одной из позиций",
      isStrongMatch: false,
      hasDifferentDimensions: false,
    };
  }

  if (specMark !== offerMark) {
    return {
      canCompare: false,
      reason: `Марки разные: ${specMark} ≠ ${offerMark}`,
      isStrongMatch: false,
      hasDifferentDimensions: false,
    };
  }

  const dimensionsAreDifferent = haveDifferentDimensions(spec, offer);

  if (dimensionsAreDifferent) {
    return {
      canCompare: true,
      reason: `Совпала марка ${specMark}, но размер отличается`,
      isStrongMatch: true,
      hasDifferentDimensions: true,
    };
  }

  return {
    canCompare: true,
    reason: `Совпала марка ${specMark}`,
    isStrongMatch: true,
    hasDifferentDimensions: false,
  };
};
