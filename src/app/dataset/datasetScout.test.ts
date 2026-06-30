import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import {
  buildCandidateCases,
  classifyExcelFile,
  classifyPdfFile,
  runDatasetScout,
} from "./datasetScout";

const withTempDir = async (fn: (dir: string) => Promise<void>) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "dataset-scout-"));

  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

test("classifies EOM PDF filename", () => {
  const result = classifyPdfFile({
    filePath: "C:/docs/ЭОМ/Проект ЭОМ электроснабжение.pdf",
    extractedText: "",
  });

  assert.equal(result.discipline, "eom");
  assert.equal(result.confidence > 0.5, true);
});

test("classifies VK PDF filename", () => {
  const result = classifyPdfFile({
    filePath: "C:/docs/ВК/водоснабжение канализация.pdf",
    extractedText: "",
  });

  assert.equal(result.discipline, "vk");
});

test("classifies KJ PDF filename", () => {
  const result = classifyPdfFile({
    filePath: "C:/docs/КЖ/фундамент армирование бетон.pdf",
    extractedText: "",
  });

  assert.equal(result.discipline, "kj");
});

test("classifies AR windows PDF filename", () => {
  const result = classifyPdfFile({
    filePath: "C:/docs/АР/спецификация окон витражей B-7(зерк).pdf",
    extractedText: "ГОСТ 22233 алюминиевый профиль",
  });

  assert.equal(result.discipline, "ar_windows");
});

test("classifies OViK PDF filename", () => {
  const result = classifyPdfFile({
    filePath: "C:/docs/ОВиК/вентиляция AIRNED воздуховод.pdf",
    extractedText: "",
  });

  assert.equal(result.discipline, "ovik");
});

test("classifies Excel as offer_excel by KP filename", () => {
  const result = classifyExcelFile({
    filePath: "C:/docs/КП поставщика вентиляция.xlsx",
    previewText: "",
  });

  assert.equal(result.excelType, "offer_excel");
});

test("classifies Excel as estimate_excel by estimate filename", () => {
  const result = classifyExcelFile({
    filePath: "C:/docs/локальная смета ЛСР.xlsx",
    previewText: "",
  });

  assert.equal(result.excelType, "estimate_excel");
});

test("classifies Excel as specification_excel by specification filename", () => {
  const result = classifyExcelFile({
    filePath: "C:/docs/спецификация оборудования.xlsx",
    previewText: "",
  });

  assert.equal(result.excelType, "specification_excel");
});

test("buildCandidateCases links PDF and Excel from the same folder", () => {
  const cases = buildCandidateCases({
    rootDir: "C:/dataset",
    pdfFiles: [
      {
        filePath: "C:/dataset/tender-1/ОВиК проект.pdf",
        discipline: "ovik",
        confidence: 0.8,
        reason: "PDF: вентиляция",
      },
    ],
    excelFiles: [
      {
        filePath: "C:/dataset/tender-1/КП подрядчика.xlsx",
        excelType: "offer_excel",
        confidence: 0.8,
        reason: "Excel: КП",
      },
    ],
  });

  assert.equal(cases.length, 1);
  assert.equal(cases[0].caseName, "tender-1");
  assert.equal(cases[0].discipline, "ovik");
  assert.equal(cases[0].offerFiles.length, 1);
  assert.equal(cases[0].confidence > 0.7, true);
});

test("scout does not fail on a broken file", async () => {
  await withTempDir(async (dir) => {
    const caseDir = path.join(dir, "case");
    await mkdir(caseDir);
    await writeFile(path.join(caseDir, "ОВиК проект.pdf"), "broken pdf");
    await writeFile(path.join(caseDir, "КП вентиляция.xlsx"), "broken excel");

    const result = await runDatasetScout(dir, {
      outputDir: path.join(dir, "debug"),
      extractPdfText: async () => {
        throw new Error("bad pdf");
      },
      readExcelPreview: async () => {
        throw new Error("bad excel");
      },
    });

    assert.equal(result.summary.pdfFound, 1);
    assert.equal(result.summary.excelFound, 1);
    assert.equal(result.summary.errors.length, 2);
  });
});

test("summary JSON is formed", async () => {
  await withTempDir(async (dir) => {
    const caseDir = path.join(dir, "case");
    await mkdir(caseDir);
    await writeFile(path.join(caseDir, "ОВиК проект.pdf"), "%PDF-1.7");
    await writeFile(path.join(caseDir, "КП вентиляция.xlsx"), "excel");

    const result = await runDatasetScout(dir, {
      outputDir: path.join(dir, "debug"),
      extractPdfText: async () => "вентиляция воздуховод AIRNED",
      readExcelPreview: async () => "КП поставщик цена количество",
    });

    assert.equal(result.summary.candidateCasesCount, 1);
    assert.equal(result.summary.disciplineCounts.ovik, 1);
    assert.equal(result.candidates[0].projectPdf.endsWith("ОВиК проект.pdf"), true);
  });
});
