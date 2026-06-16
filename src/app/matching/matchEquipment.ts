import type { WorkItem } from "../types";
import { normalizeText } from "../utils";
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

const equipmentCategories = [
  "корпус фильтра",
  "секция рекуператора",
  "вставка гибкая",
  "воздухонагреватель",
  "воздухоохладитель",
  "шумоглушитель",
  "вентилятор",
  "клапан",
  "фильтр",
] as const;

const getEquipmentCategory = (item: WorkItem) => {
  const text = ` ${normalizeText(`${item.name} ${item.rate}`)} `;

  return equipmentCategories.find((category) => text.includes(` ${category} `));
};

type EquipmentCategoryDefinition = {
  key: string;
  label: string;
  codes: string[];
  keywords: string[];
};

const equipmentCategoryDefinitions: EquipmentCategoryDefinition[] = [
  { key: "cooler", label: "RW/воздухоохладитель", codes: ["rw"], keywords: ["воздухоохладитель", "охладитель"] },
  { key: "heater", label: "WH/воздухонагреватель", codes: ["wh"], keywords: ["воздухонагреватель", "нагреватель"] },
  { key: "recuperator_supply", label: "RGP/рекуператор приточная", codes: ["rgp"], keywords: ["рекуператор приточная"] },
  { key: "recuperator_exhaust", label: "RGV/рекуператор вытяжная", codes: ["rgv"], keywords: ["рекуператор вытяжная"] },
  { key: "short_filter_housing", label: "FRUM/корпус фильтра укороченного", codes: ["frum"], keywords: ["корпус фильтра укороченного"] },
  { key: "short_filter_insert", label: "DFUM/вставка карманная укороченная", codes: ["dfum"], keywords: ["вставка карманная укороченная"] },
  { key: "damper", label: "CHR/заслонка", codes: ["chr"], keywords: ["заслонк"] },
  { key: "flexible_insert", label: "FH/вставка гибкая", codes: ["fh"], keywords: ["вставка гибкая"] },
  { key: "filter_housing", label: "FRPM/корпус фильтра", codes: ["frpm"], keywords: ["корпус фильтра"] },
  { key: "filter_insert", label: "DFPM/вставка карманная", codes: ["dfpm"], keywords: ["вставка карманная"] },
  { key: "silencer", label: "NKD/шумоглушитель", codes: ["nkd"], keywords: ["шумоглушитель"] },
  { key: "fan", label: "G1/REZ/вентилятор", codes: ["g1", "rez"], keywords: ["вентилятор"] },
  { key: "empty_section", label: "PSK/пустая секция", codes: ["psk"], keywords: ["пустая секция"] },
  { key: "roof", label: "крыша", codes: [], keywords: ["крыша", "крыш"] },
  { key: "grille", label: "решетка", codes: [], keywords: ["решетка", "решётка", "воздухозаборная решетка", "воздухозаборная решётка"] },
];

const getEquipmentSignature = (item: WorkItem) => {
  const normalized = normalizeText(`${item.name} ${item.rate}`);
  const tokens = normalized.split(" ");

  return equipmentCategoryDefinitions.find(
    (definition) =>
      definition.codes.some((code) => tokens.includes(code)) ||
      definition.keywords.some((keyword) =>
        normalized.includes(normalizeText(keyword))
      )
  );
};

const formatEquipmentSignature = (signature: EquipmentCategoryDefinition) =>
  signature.label;

export const getSideFeature = (item: WorkItem) => {
  const tokens = normalizeText(`${item.name} ${item.rate}`).split(" ");

  if (tokens.includes("левый") || tokens.includes("левая")) return "левый";
  if (tokens.includes("правый") || tokens.includes("правая")) return "правый";

  return "";
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

  const specCategory = getEquipmentCategory(spec);
  const offerCategory = getEquipmentCategory(offer);

  if (specCategory && offerCategory && specCategory !== offerCategory) {
    return {
      canCompare: false,
      reason: "Категории оборудования разные",
      isStrongMatch: false,
    };
  }

  const specEquipmentSignature = getEquipmentSignature(spec);
  const offerEquipmentSignature = getEquipmentSignature(offer);

  if (
    specEquipmentSignature &&
    offerEquipmentSignature &&
    specEquipmentSignature.key !== offerEquipmentSignature.key
  ) {
    return {
      canCompare: false,
      reason: `Явные категории оборудования разные: ${formatEquipmentSignature(
        specEquipmentSignature
      )} ≠ ${formatEquipmentSignature(offerEquipmentSignature)}`,
      isStrongMatch: false,
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

  const specSide = getSideFeature(spec);
  const offerSide = getSideFeature(offer);

  if (specSide && offerSide && specSide !== offerSide) {
    return {
      canCompare: false,
      reason: `Исполнение отличается: ${specSide} ≠ ${offerSide}`,
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
