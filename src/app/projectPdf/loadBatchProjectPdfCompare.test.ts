import assert from "node:assert/strict";
import test from "node:test";

import type { CompareResult, WorkItem } from "../types";
import type {
  UnifiedPdfProjectCompareResult,
  UnifiedPdfProjectMode,
} from "./loadUnifiedProjectPdfCompare";
import {
  classifyOfferDiscipline,
  getSelectedBatchResult,
  loadBatchProjectPdfCompare,
} from "./loadBatchProjectPdfCompare";

const statusOk = "ОК" as CompareResult["status"];
const statusMissing = "Нет в КП" as CompareResult["status"];

const item = (name: string): WorkItem => ({
  number: 1,
  name,
  rate: "",
  unit: "шт",
  projectVolume: 1,
  rowType: "item",
});

const sourcedItem = (
  name: string,
  sourceDiscipline: NonNullable<WorkItem["sourceDiscipline"]>,
  sourceFileName: string
): WorkItem => ({
  ...item(name),
  sourceDiscipline,
  sourceFileName,
  extractionStrategy:
    sourceDiscipline === "ar_windows" ? "ar_windows_ocr" : "pdf_text",
});

const result = (
  status: CompareResult["status"],
  name = "Project item"
): CompareResult => ({
  name,
  rate: "",
  unit: "шт",
  specVolume: 1,
  offerName: name,
  offerRate: "",
  offerUnit: "шт",
  offerVolume: 1,
  status,
  similarity: status === statusOk ? 100 : 0,
  reason: "test",
});

const unifiedResult = (
  workItems: WorkItem[],
  results: CompareResult[]
): UnifiedPdfProjectCompareResult => ({
  workItems,
  results,
  statusCounts: results.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.status] = (counts[entry.status] ?? 0) + 1;
    return counts;
  }, {}),
  technicalInfo: {
    totalProjectWorkItemsCount: workItems.length,
    textPdfWorkItemsCount: workItems.length,
    arWindowsWorkItemsCount: 0,
    extractionStrategiesUsed: ["pdf_text"],
    fallbackUsed: false,
  },
});

test("multiple offers produce multiple summaries", async () => {
  const projectPdf = new File(["%PDF-1.7"], "project.pdf", {
    type: "application/pdf",
  });
  const offers = [
    { file: new File(["offer"], "kp-1.xlsx"), offerItems: [item("A")] },
    { file: new File(["offer"], "kp-2.xlsx"), offerItems: [item("B")] },
  ];

  const batch = await loadBatchProjectPdfCompare({
    mode: "auto",
    projectPdf,
    offers,
    runUnifiedCompare: async ({ offerItems }) =>
      unifiedResult([item("Project item")], [
        result(offerItems[0].name === "A" ? statusOk : statusMissing),
      ]),
  });

  assert.deepEqual(
    batch.results.map((entry) => entry.summary.offerFilename),
    ["kp-1.xlsx", "kp-2.xlsx"]
  );
  assert.equal(batch.results[0].summary.okCount, 1);
  assert.equal(batch.results[1].summary.missingCount, 1);
  assert.equal(batch.results[0].summary.excelOfferWorkItemsCount, 1);
  assert.equal(batch.results[0].summary.totalProjectWorkItemsCount, 1);
});

test("one failed offer does not break all batch", async () => {
  const projectPdf = new File(["%PDF-1.7"], "project.pdf", {
    type: "application/pdf",
  });
  const offers = [
    { file: new File(["offer"], "good.xlsx"), offerItems: [item("good")] },
    { file: new File(["offer"], "bad.xlsx"), offerItems: [item("bad")] },
  ];

  const batch = await loadBatchProjectPdfCompare({
    mode: "auto",
    projectPdf,
    offers,
    runUnifiedCompare: async ({ offerFile }) => {
      if (offerFile.name === "bad.xlsx") {
        throw new Error("bad offer");
      }

      return unifiedResult([item("Project item")], [result(statusOk)]);
    },
  });

  assert.equal(batch.results.length, 2);
  assert.equal(batch.results[0].status, "success");
  assert.equal(batch.results[1].status, "failed");
  assert.equal(batch.results[1].summary.error, "bad offer");
});

test("selected result can be displayed", async () => {
  const projectPdf = new File(["%PDF-1.7"], "project.pdf", {
    type: "application/pdf",
  });
  const mode: UnifiedPdfProjectMode = "auto";
  const batch = await loadBatchProjectPdfCompare({
    mode,
    projectPdf,
    offers: [
      { file: new File(["offer"], "first.xlsx"), offerItems: [item("A")] },
      { file: new File(["offer"], "second.xlsx"), offerItems: [item("B")] },
    ],
    runUnifiedCompare: async ({ offerFile }) =>
      unifiedResult([item("Project item")], [
        result(statusOk, offerFile.name),
      ]),
  });

  const selected = getSelectedBatchResult(batch, batch.results[1].id);

  assert.equal(selected?.summary.offerFilename, "second.xlsx");
  assert.equal(selected?.status, "success");
  assert.ok(selected && selected.status === "success");
  assert.equal(selected.compareResult.results[0].name, "second.xlsx");
});

test("window KP routes to arWindowsWorkItems", async () => {
  const projectPdf = new File(["%PDF-1.7"], "project.pdf", {
    type: "application/pdf",
  });
  const windowOffer = [
    item("B-7* окно алюминиевый профиль 3000 x 2380 ГОСТ 22233"),
  ];

  const batch = await loadBatchProjectPdfCompare({
    mode: "auto",
    projectPdf,
    offers: [{ file: new File(["offer"], "windows.xlsx"), offerItems: windowOffer }],
    projectWorkItems: [
      sourcedItem("B-7(зерк)", "ar_windows", "ar.pdf"),
      sourcedItem("Вентиляция В1", "text_pdf", "ovik.pdf"),
    ],
    runCompare: (projectItems, offerItems) =>
      projectItems.map((projectItem) => result(statusOk, projectItem.name)),
  });

  const entry = batch.results[0];
  assert.equal(entry.status, "success");
  assert.equal(entry.summary.detectedOfferDiscipline, "ar_windows");
  assert.equal(entry.summary.matchedProjectDiscipline, "ar_windows");
  assert.equal(entry.summary.projectWorkItemsUsedCount, 1);
  assert.equal(entry.summary.totalProjectWorkItemsCount, 2);
  assert.equal(entry.compareResult.workItems[0].name, "B-7(зерк)");
});

test("ovik KP routes to ovikWorkItems", async () => {
  const projectPdf = new File(["%PDF-1.7"], "project.pdf", {
    type: "application/pdf",
  });
  const ovikOffer = [
    item("LITENED-50 приточная вентиляция фильтр шумоглушитель"),
  ];

  const batch = await loadBatchProjectPdfCompare({
    mode: "auto",
    projectPdf,
    offers: [{ file: new File(["offer"], "ovik.xlsx"), offerItems: ovikOffer }],
    projectWorkItems: [
      sourcedItem("B-7(зерк)", "ar_windows", "ar.pdf"),
      sourcedItem("LITENED-50", "text_pdf", "ovik.pdf"),
    ],
    runCompare: (projectItems) =>
      projectItems.map((projectItem) => result(statusOk, projectItem.name)),
  });

  const entry = batch.results[0];
  assert.equal(entry.status, "success");
  assert.equal(entry.summary.detectedOfferDiscipline, "ovik");
  assert.equal(entry.summary.matchedProjectDiscipline, "ovik");
  assert.equal(entry.summary.projectWorkItemsUsedCount, 1);
  assert.equal(entry.compareResult.workItems[0].name, "LITENED-50");
});

test("unknown KP routes to allProjectWorkItems with warning", async () => {
  const projectPdf = new File(["%PDF-1.7"], "project.pdf", {
    type: "application/pdf",
  });

  const batch = await loadBatchProjectPdfCompare({
    mode: "auto",
    projectPdf,
    offers: [{ file: new File(["offer"], "unknown.xlsx"), offerItems: [item("Монтаж")]}],
    projectWorkItems: [
      sourcedItem("B-7(зерк)", "ar_windows", "ar.pdf"),
      sourcedItem("LITENED-50", "text_pdf", "ovik.pdf"),
    ],
    runCompare: (projectItems) =>
      projectItems.map((projectItem) => result(statusOk, projectItem.name)),
  });

  const entry = batch.results[0];
  assert.equal(entry.status, "success");
  assert.equal(entry.summary.detectedOfferDiscipline, "unknown");
  assert.equal(entry.summary.matchedProjectDiscipline, "all_project");
  assert.equal(entry.summary.projectWorkItemsUsedCount, 2);
  assert.equal(
    entry.summary.warning,
    "Offer discipline unknown; compared against all project work items"
  );
});

test("batch with 2 project PDFs and 3 offers produces routed comparisons", async () => {
  const projectPdfs = [
    new File(["%PDF-1.7"], "ovik.pdf", { type: "application/pdf" }),
    new File(["%PDF-1.7"], "ar.pdf", { type: "application/pdf" }),
  ];
  const offers = [
    {
      file: new File(["offer"], "windows-1.xlsx"),
      offerItems: [item("В-7(зерк) витраж 3000 x 2380")],
    },
    {
      file: new File(["offer"], "windows-2.xlsx"),
      offerItems: [item("B-9* окно 1200 x 1800")],
    },
    {
      file: new File(["offer"], "ovik.xlsx"),
      offerItems: [item("AIRNED вентиляция клапан")],
    },
  ];

  const batch = await loadBatchProjectPdfCompare({
    mode: "auto",
    projectPdfs,
    offers,
    loadProjectPdf: async ({ projectPdf }) =>
      unifiedResult(
        projectPdf.name === "ar.pdf"
          ? [sourcedItem("B-7(зерк)", "ar_windows", "ar.pdf"), sourcedItem("B-9*", "ar_windows", "ar.pdf")]
          : [sourcedItem("AIRNED", "text_pdf", "ovik.pdf")],
        []
      ),
    runCompare: (projectItems) =>
      projectItems.map((projectItem) => result(statusOk, projectItem.name)),
  });

  assert.deepEqual(
    batch.results.map((entry) => entry.summary.projectWorkItemsUsedCount),
    [2, 2, 1]
  );
  assert.deepEqual(
    batch.results.map((entry) => entry.summary.matchedProjectDiscipline),
    ["ar_windows", "ar_windows", "ovik"]
  );
});

test("single compare compatible input still works", async () => {
  assert.equal(
    classifyOfferDiscipline([item("LITENED вентиляция")], "ovik.xlsx"),
    "ovik"
  );

  const projectPdf = new File(["%PDF-1.7"], "project.pdf", {
    type: "application/pdf",
  });
  const batch = await loadBatchProjectPdfCompare({
    mode: "auto",
    projectPdf,
    offers: [{ file: new File(["offer"], "kp-1.xlsx"), offerItems: [item("A")] }],
    runUnifiedCompare: async () =>
      unifiedResult([item("Project item")], [result(statusOk)]),
  });

  assert.equal(batch.results.length, 1);
  assert.equal(batch.results[0].summary.projectWorkItemsUsedCount, 1);
});
