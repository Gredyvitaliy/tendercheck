import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { mapArWindowsRowsToWorkItems } from "./mapArWindowsRowsToWorkItems";
import type { ArWindowSpecificationRow } from "./types";

const DEFAULT_ROWS_PATH = path.join(
  process.cwd(),
  "debug",
  "ar-windows-specification-rows.json"
);
const DEFAULT_OUTPUT_PATH = path.join(
  process.cwd(),
  "debug",
  "ar-windows-work-items.json"
);

interface TestMapArWindowsRowsToWorkItemsOptions {
  outputPath?: string;
  logger?: (message: string) => void;
}

export const testMapArWindowsRowsToWorkItems = async (
  rowsPath = DEFAULT_ROWS_PATH,
  options: TestMapArWindowsRowsToWorkItemsOptions = {}
): Promise<void> => {
  const outputPath = options.outputPath ?? DEFAULT_OUTPUT_PATH;
  const logger = options.logger ?? console.log;
  const resolvedRowsPath = path.resolve(rowsPath);
  const resolvedOutputPath = path.resolve(outputPath);
  const rows = JSON.parse(
    await readFile(resolvedRowsPath, "utf8")
  ) as ArWindowSpecificationRow[];
  const workItems = mapArWindowsRowsToWorkItems(rows);

  await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await writeFile(
    resolvedOutputPath,
    `${JSON.stringify(workItems, null, 2)}\n`
  );

  logger(`Rows count: ${rows.length}`);
  logger(`WorkItems count: ${workItems.length}`);
  logger(`First 10 WorkItems:\n${JSON.stringify(workItems.slice(0, 10), null, 2)}`);
  logger(`WorkItems JSON: ${resolvedOutputPath}`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rowsPath = process.argv[2] ?? DEFAULT_ROWS_PATH;
  const outputPath = process.argv[3] ?? DEFAULT_OUTPUT_PATH;

  testMapArWindowsRowsToWorkItems(rowsPath, { outputPath }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
