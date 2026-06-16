import * as XLSX from "xlsx-js-style";
import type { CompareResult } from "./types";

const getStatusComment = (item: CompareResult) => {
  if (item.status === "ОК") {
    return "Позиция найдена в КП, объем совпадает.";
  }

  if (item.status === "Объем отличается") {
    return "Позиция найдена, но объем по спецификации отличается от объема в КП.";
  }

  if (item.status === "Размер отличается") {
  return "Позиция найдена в КП, но размер отличается. Требуется проверить габариты/характеристики.";
}

  if (item.status === "Частичное совпадение") {
    return "Найдена похожая позиция. Требуется ручная проверка наименования, модели или характеристик.";
  }
  if (item.status === "Агрегированная позиция") {
    return "Позиция является агрегированной строкой установки; дочерние комплектующие найдены в КП.";
  }
  if (item.status === "Количество в PDF не распознано") {
    return "Позиция найдена в КП, но количество или единица измерения в PDF не распознаны. Требуется ручная проверка количества.";
  }
  if (item.status === "Вне области КП") {
    return "Позиция спецификации не относится к определенной области этого КП.";
  }
if (item.status === "Есть в КП, нет в спецификации") {
  return "В КП есть дополнительная позиция, которой нет в спецификации. Требуется проверить: это допработа, лишняя строка или ошибка подрядчика.";
}
  return "Позиция из спецификации не найдена в КП.";
};
export const exportResultsToExcel = (results: CompareResult[]) => {
  const summaryData = [
    {
      Статус: "ОК",
      Количество: results.filter((item) => item.status === "ОК").length,
    },
    {
      Статус: "Объем отличается",
      Количество: results.filter((item) => item.status === "Объем отличается")
        .length,
    },
    {
  Статус: "Размер отличается",
  Количество: results.filter((item) => item.status === "Размер отличается").length,
},
    {
      Статус: "Частичное совпадение",
      Количество: results.filter(
        (item) => item.status === "Частичное совпадение"
      ).length,
    },
    {
      Статус: "Агрегированная позиция",
      Количество: results.filter((item) => item.status === "Агрегированная позиция")
        .length,
    },
    {
      Статус: "Количество в PDF не распознано",
      Количество: results.filter(
        (item) => item.status === "Количество в PDF не распознано"
      ).length,
    },
    {
      Статус: "Нет в КП",
      Количество: results.filter((item) => item.status === "Нет в КП").length,
    },
    {
      Статус: "Вне области КП",
      Количество: results.filter((item) => item.status === "Вне области КП")
        .length,
    },
    {
  Статус: "Есть в КП, нет в спецификации",
  Количество: results.filter(
    (item) => item.status === "Есть в КП, нет в спецификации"
  ).length,
},
  ];

  const exportData = results.map((item) => ({
    "Позиция по спецификации": item.name,
    "Модель / артикул спецификации": item.rate,
    "Ед. изм. спецификации": item.unit,
    "Объем по спецификации": item.specVolume,

    "Позиция в КП": item.offerName,
    "Модель / артикул КП": item.offerRate,
    "Ед. изм. КП": item.offerUnit,
    "Объем по КП": item.offerVolume,

    Совпадение: item.similarity ? `${Math.round(item.similarity)}%` : "-",
    Статус: item.status,
    Комментарий: getStatusComment(item),
  }));

  const workbook = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 25 }, { wch: 15 }];

  const summaryRange = XLSX.utils.decode_range(summarySheet["!ref"] || "A1:B1");

  for (let col = summaryRange.s.c; col <= summaryRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });

    if (summarySheet[cellAddress]) {
      summarySheet[cellAddress].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "374151" } },
        alignment: { horizontal: "center", vertical: "center" },
      };
    }
  }

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Сводка");

  const worksheet = XLSX.utils.json_to_sheet(exportData);

  worksheet["!cols"] = [
    { wch: 55 },
    { wch: 30 },
    { wch: 18 },
    { wch: 22 },
    { wch: 55 },
    { wch: 30 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 25 },
    { wch: 45 },
  ];

  worksheet["!autofilter"] = {
    ref: worksheet["!ref"] || "A1:K1",
  };

  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:K1");

  const borderStyle = {
    top: { style: "thin", color: { rgb: "D1D5DB" } },
    bottom: { style: "thin", color: { rgb: "D1D5DB" } },
    left: { style: "thin", color: { rgb: "D1D5DB" } },
    right: { style: "thin", color: { rgb: "D1D5DB" } },
  };

  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "374151" } },
    alignment: {
      horizontal: "center",
      vertical: "center",
      wrapText: true,
    },
    border: borderStyle,
  };

  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });

    if (worksheet[cellAddress]) {
      worksheet[cellAddress].s = headerStyle;
    }
  }

  for (let row = 1; row <= range.e.r; row++) {
    const statusCellAddress = XLSX.utils.encode_cell({ r: row, c: 9 });
    const statusCell = worksheet[statusCellAddress];

    if (!statusCell) continue;

    const status = String(statusCell.v);

    let fillColor = "FEE2E2";
    let fontColor = "991B1B";

    if (status === "ОК") {
      fillColor = "DCFCE7";
      fontColor = "166534";
    }

    if (status === "Объем отличается") {
      fillColor = "FFEDD5";
      fontColor = "9A3412";
    }
    if (status === "Размер отличается") {
  fillColor = "EDE9FE";
  fontColor = "6D28D9";
}

    if (status === "Частичное совпадение") {
      fillColor = "FEF9C3";
      fontColor = "854D0E";
    }
    if (status === "Агрегированная позиция") {
      fillColor = "E0F2FE";
      fontColor = "075985";
    }
    if (status === "Количество в PDF не распознано") {
      fillColor = "F5F3FF";
      fontColor = "5B21B6";
    }

    if (status === "Нет в КП") {
      fillColor = "FEE2E2";
      fontColor = "991B1B";
    }
    if (status === "Вне области КП") {
      fillColor = "F3F4F6";
      fontColor = "4B5563";
    }
    if (status === "Есть в КП, нет в спецификации") {
  fillColor = "DBEAFE";
  fontColor = "1D4ED8";
}

    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];

      if (!cell) continue;

      cell.s = {
        fill: { fgColor: { rgb: fillColor } },
        alignment: {
          vertical: "top",
          wrapText: true,
        },
        border: borderStyle,
        font:
          col === 9
            ? { bold: true, color: { rgb: fontColor } }
            : { color: { rgb: "111827" } },
      };
    }
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, "Детальный отчет");

  XLSX.writeFile(workbook, "tendercheck-report.xlsx");
};
