import { describe, expect, it } from "vitest";

import { inspectImage, sniffImageType } from "@/lib/media/signature";

function fileOf(bytes: number[], type: string) {
  return new File([new Uint8Array([...bytes, ...Array(32).fill(0)])], "archivo", { type });
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

/** An ISO base media header: a size, the `ftyp` box, then the brand. */
function heifOf(brand: string) {
  return [
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    ...[...brand].map((character) => character.charCodeAt(0)),
  ];
}

describe("sniffImageType", () => {
  it("reads the format from the bytes", async () => {
    expect(await sniffImageType(fileOf(JPEG, "image/jpeg"))).toBe("image/jpeg");
    expect(await sniffImageType(fileOf(PNG, "image/png"))).toBe("image/png");
    expect(await sniffImageType(fileOf(WEBP, "image/webp"))).toBe("image/webp");
  });

  it("ignores the declared type and believes the bytes", async () => {
    // A PNG mislabelled as JPEG is still stored as the PNG it is.
    expect(await sniffImageType(fileOf(PNG, "image/jpeg"))).toBe("image/png");
  });

  it("rejects a non-image wearing an image label", async () => {
    const zip = fileOf([0x50, 0x4b, 0x03, 0x04], "image/jpeg");
    expect(await sniffImageType(zip)).toBeNull();
  });

  it("rejects a format outside the allowlist", async () => {
    const gif = fileOf([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], "image/gif");
    expect(await sniffImageType(gif)).toBeNull();
  });

  it("rejects RIFF containers that are not WebP", async () => {
    const wav = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45];
    expect(await sniffImageType(fileOf(wav, "image/webp"))).toBeNull();
  });

  it("rejects a file too short to carry a signature", async () => {
    expect(await sniffImageType(new File([new Uint8Array([0xff])], "x"))).toBeNull();
  });

  it("rejects an empty file", async () => {
    expect(await sniffImageType(new File([], "x"))).toBeNull();
  });
});

describe("inspectImage", () => {
  it("names an iPhone photo so the message can say what to do", async () => {
    for (const brand of ["heic", "heix", "mif1", "msf1", "hevc"]) {
      expect(await inspectImage(fileOf(heifOf(brand), "IMG_0001.HEIC"))).toEqual({
        supported: false,
        reason: "heif",
      });
    }
  });

  it("does not mistake another ISO container for an iPhone photo", async () => {
    // mp42 is an ordinary MP4 brand, not a still image.
    expect(await inspectImage(fileOf(heifOf("mp42"), "clip.mp4"))).toEqual({
      supported: false,
      reason: "unsupported",
    });
  });

  it("reports a supported picture with its real type", async () => {
    expect(await inspectImage(fileOf(PNG, "foto.png"))).toEqual({
      supported: true,
      type: "image/png",
    });
  });

  it("falls back to unsupported for anything unrecognised", async () => {
    expect(await inspectImage(fileOf([0x50, 0x4b, 0x03, 0x04], "archivo.zip"))).toEqual({
      supported: false,
      reason: "unsupported",
    });
  });

  it("keeps sniffImageType refusing HEIC", async () => {
    expect(await sniffImageType(fileOf(heifOf("heic"), "IMG_0001.HEIC"))).toBeNull();
  });
});
