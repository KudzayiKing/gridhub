/**
 * Incremental SHA-256.
 *
 * `crypto.subtle.digest` can only hash a complete buffer, which is unusable for a multi-gigabyte
 * model (it would have to be held in memory). This small streaming implementation hashes chunks as
 * they arrive, so integrity can be verified while downloading. It is covered by a test that
 * compares it to Node's `crypto` across chunk boundaries.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

export class Sha256 {
  private h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  private readonly block = new Uint8Array(64);
  private readonly w = new Uint32Array(64);
  private blockLen = 0;
  private totalLen = 0;
  private done = false;

  update(data: Uint8Array): this {
    if (this.done) throw new Error("SHA-256: digest already finalised");
    let offset = 0;

    // Top up a partial block first.
    if (this.blockLen > 0) {
      const need = 64 - this.blockLen;
      const take = Math.min(need, data.length);
      this.block.set(data.subarray(0, take), this.blockLen);
      this.blockLen += take;
      offset += take;
      this.totalLen += take;
      if (this.blockLen === 64) {
        this.compress(this.block);
        this.blockLen = 0;
      }
    }

    // Whole blocks straight from the input.
    while (offset + 64 <= data.length) {
      this.compress(data.subarray(offset, offset + 64));
      offset += 64;
      this.totalLen += 64;
    }

    // Buffer the remainder.
    if (offset < data.length) {
      const rest = data.subarray(offset);
      this.block.set(rest, 0);
      this.blockLen = rest.length;
      this.totalLen += rest.length;
    }
    return this;
  }

  digest(): Uint8Array {
    if (this.done) throw new Error("SHA-256: digest already finalised");
    this.done = true;

    const bitLenLo = (this.totalLen << 3) >>> 0;
    const bitLenHi = Math.floor(this.totalLen / 0x20000000) >>> 0;

    // Padding: 0x80, zeros, then the 64-bit big-endian bit length.
    const pad = new Uint8Array(this.blockLen < 56 ? 56 - this.blockLen : 120 - this.blockLen);
    pad[0] = 0x80;
    // Manual append to avoid re-entering update() after `done`.
    this.appendRaw(pad);

    const lenBytes = new Uint8Array(8);
    lenBytes[0] = (bitLenHi >>> 24) & 0xff;
    lenBytes[1] = (bitLenHi >>> 16) & 0xff;
    lenBytes[2] = (bitLenHi >>> 8) & 0xff;
    lenBytes[3] = bitLenHi & 0xff;
    lenBytes[4] = (bitLenLo >>> 24) & 0xff;
    lenBytes[5] = (bitLenLo >>> 16) & 0xff;
    lenBytes[6] = (bitLenLo >>> 8) & 0xff;
    lenBytes[7] = bitLenLo & 0xff;
    this.appendRaw(lenBytes);

    const out = new Uint8Array(32);
    for (let i = 0; i < 8; i++) {
      out[i * 4] = (this.h[i] >>> 24) & 0xff;
      out[i * 4 + 1] = (this.h[i] >>> 16) & 0xff;
      out[i * 4 + 2] = (this.h[i] >>> 8) & 0xff;
      out[i * 4 + 3] = this.h[i] & 0xff;
    }
    return out;
  }

  hex(): string {
    return toHex(this.digest());
  }

  /** Appends bytes without touching `totalLen` (padding is not message content). */
  private appendRaw(bytes: Uint8Array) {
    let offset = 0;
    if (this.blockLen > 0) {
      const take = Math.min(64 - this.blockLen, bytes.length);
      this.block.set(bytes.subarray(0, take), this.blockLen);
      this.blockLen += take;
      offset += take;
      if (this.blockLen === 64) {
        this.compress(this.block);
        this.blockLen = 0;
      }
    }
    while (offset + 64 <= bytes.length) {
      this.compress(bytes.subarray(offset, offset + 64));
      offset += 64;
    }
    if (offset < bytes.length) {
      const rest = bytes.subarray(offset);
      this.block.set(rest, 0);
      this.blockLen = rest.length;
    }
  }

  private compress(chunk: Uint8Array) {
    const w = this.w;
    for (let i = 0; i < 16; i++) {
      const o = i * 4;
      w[i] =
        (((chunk[o] << 24) | (chunk[o + 1] << 16) | (chunk[o + 2] << 8) | chunk[o + 3]) >>> 0);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
      const s1 = (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = this.h[0];
    let b = this.h[1];
    let c = this.h[2];
    let d = this.h[3];
    let e = this.h[4];
    let f = this.h[5];
    let g = this.h[6];
    let hh = this.h[7];

    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    this.h[0] = (this.h[0] + a) >>> 0;
    this.h[1] = (this.h[1] + b) >>> 0;
    this.h[2] = (this.h[2] + c) >>> 0;
    this.h[3] = (this.h[3] + d) >>> 0;
    this.h[4] = (this.h[4] + e) >>> 0;
    this.h[5] = (this.h[5] + f) >>> 0;
    this.h[6] = (this.h[6] + g) >>> 0;
    this.h[7] = (this.h[7] + hh) >>> 0;
  }
}

export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

/** One-shot convenience for small inputs. */
export function sha256Hex(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return new Sha256().update(bytes).hex();
}
