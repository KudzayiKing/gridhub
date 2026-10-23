import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { Sha256, sha256Hex } from "@/lib/ai/sha256";

function nodeHash(bytes: Uint8Array): string {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

function pseudoRandom(len: number): Uint8Array {
  const bytes = new Uint8Array(len);
  let state = 0x9e3779b9;
  for (let i = 0; i < len; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    bytes[i] = state & 0xff;
  }
  return bytes;
}

describe("streaming SHA-256", () => {
  it("matches the standard test vectors", () => {
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("matches Node across arbitrary chunk boundaries", () => {
    const sizes = [0, 1, 3, 55, 56, 57, 63, 64, 65, 127, 128, 129, 1000, 65537];
    const chunkPattern = [1, 3, 7, 13, 64, 5, 100, 2];

    for (const len of sizes) {
      const bytes = pseudoRandom(len);
      const hasher = new Sha256();
      let offset = 0;
      let i = 0;
      while (offset < len) {
        const n = Math.min(chunkPattern[i++ % chunkPattern.length], len - offset);
        hasher.update(bytes.subarray(offset, offset + n));
        offset += n;
      }
      expect(hasher.hex(), `length ${len}`).toBe(nodeHash(bytes));
    }
  });

  it("refuses to digest twice", () => {
    const hasher = new Sha256().update(new TextEncoder().encode("x"));
    hasher.digest();
    expect(() => hasher.digest()).toThrow();
  });
});
