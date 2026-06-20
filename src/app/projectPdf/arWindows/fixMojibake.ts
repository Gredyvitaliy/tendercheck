const windows1251Decoder = new TextDecoder("windows-1251");
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

const windows1251BytesByChar = new Map<string, number>(
  Array.from({ length: 256 }, (_, byte) => [
    windows1251Decoder.decode(Uint8Array.of(byte)),
    byte,
  ])
);

const mojibakePattern = /[РС][\u0080-\uFFFF]/;

const tryDecodeAsUtf8Bytes = (value: string): string | null => {
  const bytes: number[] = [];

  for (const char of value) {
    const byte = windows1251BytesByChar.get(char);

    if (byte === undefined) {
      return null;
    }

    bytes.push(byte);
  }

  try {
    return utf8Decoder.decode(Uint8Array.from(bytes));
  } catch {
    return null;
  }
};

export const fixWindows1251Mojibake = (value: string): string => {
  if (!mojibakePattern.test(value)) {
    return value;
  }

  let result = "";
  let index = 0;

  while (index < value.length) {
    let decoded: string | null = null;
    let decodedEnd = index;

    for (let end = value.length; end > index; end--) {
      const candidate = value.slice(index, end);
      const fixedCandidate = tryDecodeAsUtf8Bytes(candidate);

      if (fixedCandidate !== null) {
        decoded = fixedCandidate;
        decodedEnd = end;
        break;
      }
    }

    if (decoded !== null) {
      result += decoded;
      index = decodedEnd;
    } else {
      result += value[index];
      index++;
    }
  }

  return result;
};
