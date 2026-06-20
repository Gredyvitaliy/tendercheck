import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import type { CompareResult, WorkItem } from "../../types";
import {
  buildArWindowsExcelCompareDebugResult,
  countCompareStatuses,
  readExcelFileAsBrowserArrayBuffer,
} from "./testCompareArWindowsWithExcelOffer";

const workItem = (name: string): WorkItem => ({
  number: 1,
  name,
  rate: "",
  unit: "С€С‚",
  projectVolume: 1,
  rowType: "item",
});

const result = (status: string): CompareResult => ({
  name: "B-1 Р’РёС‚СЂР°Р¶",
  rate: "",
  unit: "С€С‚",
  specVolume: 1,
  offerName: "B-1 Р’РёС‚СЂР°Р¶",
  offerRate: "",
  offerUnit: "С€С‚",
  offerVolume: 1,
  status: status as CompareResult["status"],
  similarity: 100,
  reason: "test",
});

test("counts comparison statuses for AR windows diagnostics", () => {
  assert.deepEqual(
    countCompareStatuses([
      result("РћРљ"),
      result("РћРљ"),
      result("РќРµС‚ РІ РљРџ"),
      result("РћР±СЉРµРј РѕС‚Р»РёС‡Р°РµС‚СЃСЏ"),
    ]),
    {
      "РћРљ": 2,
      "РќРµС‚ РІ РљРџ": 1,
      "РћР±СЉРµРј РѕС‚Р»РёС‡Р°РµС‚СЃСЏ": 1,
    }
  );
});

test("builds AR windows vs Excel diagnostic payload", () => {
  const arWorkItems = [workItem("B-1 Р’РёС‚СЂР°Р¶")];
  const excelWorkItems = [
    workItem("B-1 Р’РёС‚СЂР°Р¶"),
    workItem("B-2 Р’РёС‚СЂР°Р¶"),
  ];
  const results = [
    result("РћРљ"),
    result("Р•СЃС‚СЊ РІ РљРџ, РЅРµС‚ РІ СЃРїРµС†РёС„РёРєР°С†РёРё"),
  ];

  const payload = buildArWindowsExcelCompareDebugResult(
    arWorkItems,
    excelWorkItems,
    results
  );

  assert.deepEqual(payload.summary, {
    arWorkItems: 1,
    excelWorkItems: 2,
    totalResults: 2,
    excelParser: {
      functionName: "parseOfferExcelData",
      moduleName: "src/app/parsers.ts",
      browserEntryPoint: "parseOfferExcel",
    },
    excelOfferPreview: [
      {
        name: "B-1 Р’РёС‚СЂР°Р¶",
        unit: "С€С‚",
        projectVolume: 1,
        position: undefined,
      },
      {
        name: "B-2 Р’РёС‚СЂР°Р¶",
        unit: "С€С‚",
        projectVolume: 1,
        position: undefined,
      },
    ],
    statusCounts: {
      "РћРљ": 1,
      "Р•СЃС‚СЊ РІ РљРџ, РЅРµС‚ РІ СЃРїРµС†РёС„РёРєР°С†РёРё": 1,
    },
  });
  assert.deepEqual(payload.pdfWorkItems, arWorkItems);
  assert.deepEqual(payload.excelWorkItems, excelWorkItems);
  assert.deepEqual(payload.results, results);
});

test("reads Excel bytes as a standalone ArrayBuffer like browser FileReader", async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "ar-windows-excel-"));
  const filePath = path.join(tempDir, "offer.xlsx");

  try {
    await writeFile(filePath, Buffer.from([0x50, 0x4b, 0x03, 0x04]));

    const data = await readExcelFileAsBrowserArrayBuffer(filePath);
    const bytes = new Uint8Array(data);

    assert.equal(data.byteLength, 4);
    assert.deepEqual([...bytes], [0x50, 0x4b, 0x03, 0x04]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
