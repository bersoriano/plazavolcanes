import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MAX_IMAGE_EDGE,
  normalizeImage,
  normalizeImages,
  scaledSize,
} from "@/lib/media/normalize";

const originalCreateImageBitmap = globalThis.createImageBitmap;

function stubBitmap(width: number, height: number) {
  const close = vi.fn();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width, height, close } as unknown as ImageBitmap),
  );
  return close;
}

/** Stands in for the canvas encoder, which jsdom does not implement. */
function stubCanvas(blob: Blob | null) {
  const drawImage = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage }),
    toBlob: (callback: (result: Blob | null) => void) => callback(blob),
  };
  vi.spyOn(document, "createElement").mockReturnValue(canvas as unknown as HTMLCanvasElement);
  return { canvas, drawImage };
}

function fileOf(bytes: number, name = "foto.jpg", type = "image/jpeg") {
  return new File([new Uint8Array(bytes)], name, { type });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  globalThis.createImageBitmap = originalCreateImageBitmap;
});

describe("scaledSize", () => {
  it("caps the long edge and keeps the aspect ratio", () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(scaledSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it("leaves a picture already within the cap alone", () => {
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(scaledSize(MAX_IMAGE_EDGE, 900)).toEqual({ width: MAX_IMAGE_EDGE, height: 900 });
  });

  it("never scales an edge below one pixel", () => {
    expect(scaledSize(4000, 1)).toEqual({ width: 1600, height: 1 });
  });
});

describe("normalizeImage", () => {
  it("returns the re-encoded WebP when it is smaller", async () => {
    stubBitmap(4000, 3000);
    stubCanvas(new Blob([new Uint8Array(200)], { type: "image/webp" }));

    const result = await normalizeImage(fileOf(5000));

    expect(result.type).toBe("image/webp");
    expect(result.size).toBe(200);
  });

  it("draws at the capped size", async () => {
    stubBitmap(4000, 3000);
    const { canvas, drawImage } = stubCanvas(new Blob([new Uint8Array(10)]));

    await normalizeImage(fileOf(5000));

    expect([canvas.width, canvas.height]).toEqual([1600, 1200]);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1200);
  });

  it("keeps the original when re-encoding would make it bigger", async () => {
    stubBitmap(64, 64);
    stubCanvas(new Blob([new Uint8Array(900)], { type: "image/webp" }));
    const original = fileOf(500, "icono.png", "image/png");

    expect(await normalizeImage(original)).toBe(original);
  });

  it("keeps the original when the encoder returns nothing", async () => {
    stubBitmap(4000, 3000);
    stubCanvas(null);
    const original = fileOf(5000);

    expect(await normalizeImage(original)).toBe(original);
  });

  it("keeps the original when the file cannot be decoded", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("not an image")));
    const original = fileOf(5000);

    expect(await normalizeImage(original)).toBe(original);
  });

  it("keeps the original where the browser has no createImageBitmap", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    const original = fileOf(5000);

    expect(await normalizeImage(original)).toBe(original);
  });

  it("releases the decoded bitmap", async () => {
    const close = stubBitmap(4000, 3000);
    stubCanvas(new Blob([new Uint8Array(10)]));

    await normalizeImage(fileOf(5000));

    expect(close).toHaveBeenCalled();
  });

  it("reads the EXIF orientation so the re-encode keeps it", async () => {
    stubBitmap(4000, 3000);
    stubCanvas(new Blob([new Uint8Array(10)]));
    const file = fileOf(5000);

    await normalizeImage(file);

    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: "from-image" });
  });
});

describe("normalizeImages", () => {
  it("keeps the gallery in the order it was chosen", async () => {
    stubBitmap(4000, 3000);
    stubCanvas(new Blob([new Uint8Array(10)]));

    const result = await normalizeImages([fileOf(5000, "a.jpg"), fileOf(6000, "b.jpg")]);

    expect(result).toHaveLength(2);
    expect(result.every((file) => file.type === "image/webp")).toBe(true);
  });
});
