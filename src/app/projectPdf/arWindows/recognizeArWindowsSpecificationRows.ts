import { access } from "node:fs/promises";

import { manualArWindowsVisionProvider } from "./manualArWindowsVisionProvider";
import {
  normalizeArWindowsSpecificationRows,
  type RawArWindowSpecificationRow,
} from "./normalizeArWindowsRows";
import type { ArWindowSpecificationRow } from "./types";

export interface ArWindowsRowsProvider {
  recognizeRows(imagePath: string): Promise<RawArWindowSpecificationRow[]>;
}

export interface RecognizeArWindowsSpecificationRowsInput {
  imagePath: string;
  provider?: ArWindowsRowsProvider;
}

export const recognizeArWindowsSpecificationRows = async ({
  imagePath,
  provider = manualArWindowsVisionProvider,
}: RecognizeArWindowsSpecificationRowsInput): Promise<
  ArWindowSpecificationRow[]
> => {
  await access(imagePath);

  const rawRows = await provider.recognizeRows(imagePath);

  return normalizeArWindowsSpecificationRows(rawRows);
};
