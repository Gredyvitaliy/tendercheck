import type { WorkItem } from "../types";
import {
  codesMatch,
  extractModelCodes,
  getAirnedCode,
  getPlainItemKind,
  getStrictModelKey,
  isAirnedInstallation,
} from "./matchUtils";

export type EquipmentMatchResult = {
  canCompare: boolean;
  reason: string;
  isStrongMatch: boolean;
};

export const matchEquipment = (
  spec: WorkItem,
  offer: WorkItem
): EquipmentMatchResult => {
  const specIsAirned = isAirnedInstallation(spec);
  const offerIsAirned = isAirnedInstallation(offer);

  if (specIsAirned || offerIsAirned) {
    if (!specIsAirned || !offerIsAirned) {
      return {
        canCompare: false,
        reason: "AIRNED найден только в одной из позиций",
        isStrongMatch: false,
      };
    }

    const specAirnedCode = getAirnedCode(spec);
    const offerAirnedCode = getAirnedCode(offer);

    if (!specAirnedCode || !offerAirnedCode) {
      return {
        canCompare: false,
        reason: "Код AIRNED не найден в одной из позиций",
        isStrongMatch: false,
      };
    }

    if (specAirnedCode !== offerAirnedCode) {
      return {
        canCompare: false,
        reason: `Коды AIRNED разные: ${specAirnedCode} ≠ ${offerAirnedCode}`,
        isStrongMatch: false,
      };
    }

    return {
      canCompare: true,
      reason: `Совпал код AIRNED ${specAirnedCode}`,
      isStrongMatch: true,
    };
  }

  const specPlainKind = getPlainItemKind(spec);
  const offerPlainKind = getPlainItemKind(offer);

  if (specPlainKind && offerPlainKind && specPlainKind !== offerPlainKind) {
    return {
      canCompare: false,
      reason: `Типы позиций разные: ${specPlainKind} ≠ ${offerPlainKind}`,
      isStrongMatch: false,
    };
  }

  const specStrictModelKey = getStrictModelKey(spec);
  const offerStrictModelKey = getStrictModelKey(offer);

  if (
    specStrictModelKey &&
    offerStrictModelKey &&
    specStrictModelKey !== offerStrictModelKey
  ) {
    return {
      canCompare: false,
      reason: `Модели разные: ${specStrictModelKey} ≠ ${offerStrictModelKey}`,
      isStrongMatch: false,
    };
  }

  const specCodes = extractModelCodes(`${spec.name} ${spec.rate}`);
  const offerCodes = extractModelCodes(`${offer.name} ${offer.rate}`);

  if (specCodes.length > 0 && offerCodes.length > 0) {
    if (!codesMatch(specCodes, offerCodes)) {
      return {
        canCompare: false,
        reason: "Модельные коды не совпали",
        isStrongMatch: false,
      };
    }

    return {
      canCompare: true,
      reason: "Совпал тип позиции и модельный код",
      isStrongMatch: true,
    };
  }

  return {
    canCompare: true,
    reason: "Оборудование можно сравнивать",
    isStrongMatch: false,
  };
};
