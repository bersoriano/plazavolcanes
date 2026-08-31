import { describe, expect, it } from "vitest";

import { probeImageSize } from "@/lib/media/dimensions";

function blobOf(bytes: number[]) {
  return new Blob([new Uint8Array(bytes)]);
}

function be16(value: number) {
  return [(value >> 8) & 0xff, value & 0xff];
}

function be32(value: number) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function png(width: number, height: number) {
  return [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...be32(13), 0x49, 0x48, 0x44, 0x52,
    ...be32(width), ...be32(height),
  ];
}

/** A JPEG with an EXIF block in front of the frame header, as a camera writes. */
function jpeg(width: number, height: number, exifBytes = 0) {
  return [
    0xff, 0xd8,
    0xff, 0xe1, ...be16(exifBytes + 2), ...Array(exifBytes).fill(0),
    0xff, 0xc0, ...be16(17), 0x08, ...be16(height), ...be16(width), 0x03,
    ...Array(6).fill(0),
  ];
}

function webpVp8x(width: number, height: number) {
  const w = width - 1;
  const h = height - 1;
  return [
    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x58, ...Array(8).fill(0),
    w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff,
    h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff,
  ];
}

describe("probeImageSize", () => {
  it("reads a PNG header", async () => {
    expect(await probeImageSize(blobOf(png(4032, 3024)))).toEqual({
      width: 4032,
      height: 3024,
    });
  });

  it("walks past a camera's EXIF to reach the JPEG frame header", async () => {
    expect(await probeImageSize(blobOf(jpeg(6048, 4032, 2048)))).toEqual({
      width: 6048,
      height: 4032,
    });
  });

  it("reads a JPEG with no EXIF at all", async () => {
    expect(await probeImageSize(blobOf(jpeg(800, 600)))).toEqual({ width: 800, height: 600 });
  });

  it("reads an extended WebP header", async () => {
    expect(await probeImageSize(blobOf(webpVp8x(1600, 1200)))).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it("gives up rather than guessing on an unknown format", async () => {
    expect(await probeImageSize(blobOf([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, ...Array(20).fill(0)]))).toBeNull();
  });

  it("gives up on a truncated file", async () => {
    expect(await probeImageSize(blobOf([0x89, 0x50]))).toBeNull();
  });

  it("gives up on a JPEG whose frame header never arrives", async () => {
    expect(await probeImageSize(blobOf([0xff, 0xd8, ...Array(64).fill(0)]))).toBeNull();
  });
});
