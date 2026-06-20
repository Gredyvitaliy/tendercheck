import assert from "node:assert/strict";
import test from "node:test";

import { fixWindows1251Mojibake } from "./fixMojibake";

test("fixes common UTF-8 decoded as Windows-1251 mojibake", () => {
  assert.equal(
    fixWindows1251Mojibake("Р“РћРЎРў 22233-2001"),
    "ГОСТ 22233-2001"
  );
  assert.equal(fixWindows1251Mojibake("Р’РёС‚СЂР°Р¶"), "Витраж");
  assert.equal(fixWindows1251Mojibake("С€С‚"), "шт");
  assert.equal(fixWindows1251Mojibake("B-6(Р·РµСЂ)"), "B-6(зер)");
});

test("keeps normal text unchanged", () => {
  assert.equal(fixWindows1251Mojibake("B-16* ГОСТ"), "B-16* ГОСТ");
});
