export type WorkItem = {
  number: string | number;
  name: string;
  rate: string;
  unit: string;
  projectVolume: number | string;
  rowType: "group" | "item";
};

export type CompareResult = {
  name: string;
  rate: string;
  unit: string;
  specVolume: number | string;

  offerName: string;
  offerRate: string;
  offerUnit: string;
  offerVolume: number | string;

  status:
  | "ОК"
  | "Объем отличается"
  | "Частичное совпадение"
  | "Нет в КП"
  | "Есть в КП, нет в спецификации";
  similarity?: number;
};