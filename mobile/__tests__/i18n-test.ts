import fs from "fs";
import path from "path";
import { ar } from "@/i18n/ar";
import { en } from "@/i18n/en";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

function values(obj: object): string[] {
  return Object.values(obj).flatMap((v) => (typeof v === "object" && v !== null ? values(v) : [String(v)]));
}

describe("translations", () => {
  it("Arabic and English have exactly the same keys", () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });

  it("Arabic strings are actually translated", () => {
    // Every Arabic string except a few brand/format ones should contain Arabic letters.
    const untranslated = values(ar).filter((s) => !/[؀-ۿ]/.test(s));
    expect(untranslated).toEqual([]);
  });

  it("keeps the same {{placeholders}} in both languages", () => {
    const placeholders = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort().join(",");
    const enKeys = keys(en);
    const get = (obj: object, key: string) => key.split(".").reduce<any>((o, k) => o[k], obj);
    for (const key of enKeys) {
      expect([key, placeholders(get(ar, key))]).toEqual([key, placeholders(get(en, key))]);
    }
  });

  // Contract test: every error code the API can send has a message in the app.
  it("translates every error code the server can return", () => {
    const serverSrc = path.resolve(__dirname, "../../server/src");
    if (!fs.existsSync(serverSrc)) return;

    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== "generated") walk(full);
        else if (entry.name.endsWith(".ts")) files.push(full);
      }
    };
    walk(serverSrc);

    const codes = new Set<string>();
    const pattern = /(?:badRequest|conflict|tooManyRequests)\(\s*"([A-Z_]+)"|AppError\(\s*\d+,\s*"([A-Z_]+)"|code: "([A-Z_]+)"/g;
    for (const file of files) {
      for (const m of fs.readFileSync(file, "utf8").matchAll(pattern)) codes.add(m[1] ?? m[2] ?? m[3]);
    }

    expect(codes.size).toBeGreaterThan(10);
    const missing = [...codes].filter((code) => !(code in en.errors));
    expect(missing).toEqual([]);
  });
});
