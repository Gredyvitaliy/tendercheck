export type WorkItem = {
  number: number;
  name: string;
  rate: string;
  unit: string;
  projectVolume: number;
  rowType: "item";
  position?: string;
};

export type CompareResultStatus =
  | "ОК"
  | "Объем отличается"
  | "Размер отличается"
  | "Частичное совпадение"
  | "Нет в КП"
  | "Есть в КП, нет в спецификации";

export type CompareResult = {
  name: string;
  rate: string;
  unit: string;
  specVolume: number | string;
  offerName: string;
  offerRate: string;
  offerUnit: string;
  offerVolume: number | string;
  status: CompareResultStatus;
  similarity: number;
  reason: string;
};
