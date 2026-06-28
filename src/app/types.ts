export type WorkItem = {
  number: number;
  name: string;
  rate: string;
  unit: string;
  projectVolume: number;
  rowType: "item";
  position?: string;
  sourceDiscipline?: "text_pdf" | "ar_windows";
  extractionStrategy?: "pdf_text" | "ar_windows_ocr";
};

export type CompareResultStatus =
  | "ОК"
  | "Объем отличается"
  | "Размер отличается"
  | "Частичное совпадение"
  | "Агрегированная позиция"
  | "Количество в PDF не распознано"
  | "Нет в КП"
  | "Вне области КП"
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
