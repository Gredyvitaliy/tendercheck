import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { recognizeArWindowsSpecificationRows } from "./recognizeArWindowsSpecificationRows";

const DEFAULT_IMAGE_PATH = path.join(
  process.cwd(),
  "debug",
  "ar-windows-page-1.png"
);
const DEFAULT_OUTPUT_PATH = path.join(
  process.cwd(),
  "debug",
  "ar-windows-specification-rows.json"
);

export interface TestRecognizeArWindowsSpecificationRowsOptions {
  outputPath?: string;
  logger?: (message: string) => void;
}

export const testRecognizeArWindowsSpecificationRows = async (
  imagePath = DEFAULT_IMAGE_PATH,
  options: TestRecognizeArWindowsSpecificationRowsOptions = {}
): Promise<void> => {
  const outputPath = options.outputPath ?? DEFAULT_OUTPUT_PATH;
  const logger = options.logger ?? console.log;
  const resolvedImagePath = path.resolve(imagePath);
  const resolvedOutputPath = path.resolve(outputPath);
  const rows = await recognizeArWindowsSpecificationRows({
    imagePath: resolvedImagePath,
  });

  await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, `${JSON.stringify(rows, null, 2)}\n`);

  logger(`AR windows image: ${resolvedImagePath}`);
  logger(`Rows count: ${rows.length}`);
  logger(`First 10 rows:\n${JSON.stringify(rows.slice(0, 10), null, 2)}`);
  logger(`Rows JSON: ${resolvedOutputPath}`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const imagePath = process.argv[2] ?? DEFAULT_IMAGE_PATH;
  const outputPath = process.argv[3] ?? DEFAULT_OUTPUT_PATH;

  testRecognizeArWindowsSpecificationRows(imagePath, { outputPath }).catch(
    (error) => {
      console.error(error);
      process.exit(1);
    }
  );
}
