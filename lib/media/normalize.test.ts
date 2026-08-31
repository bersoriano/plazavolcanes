import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MAX_IMAGE_EDGE,
  MAX_UPLOAD_BYTES,
  normalizeImage,
  normalizeImages,
  scaledSize,
  totalBytes,
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

describe("normalizeImage decode budget", () => {
  /** A PNG header is enough for the probe to report a size. */
  function pngOf(width: number, height: number) {
    const be32 = (value: number) => [
      (value >>> 24) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 8) & 0xff,
      value & 0xff,
    ];
    return new File(
      [
        new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
          ...be32(13), 0x49, 0x48, 0x44, 0x52,
          ...be32(width), ...be32(height),
        ]),
      ],
      "foto.png",
      { type: "image/png" },
    );
  }

  it("asks the decoder to downscale a phone photo as it reads it", async () => {
    // 24 megapixels is about 97 MB decoded at full size, which is what killed
    // the tab. Only one edge is constrained, so nothing can be distorted.
    stubBitmap(1600, 1067);
    stubCanvas(new Blob([new Uint8Array(10)]));

    await normalizeImage(pngOf(6048, 4032));

    expect(createImageBitmap).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ resizeWidth: MAX_IMAGE_EDGE, imageOrientation: "from-image" }),
    );
    expect(vi.mocked(createImageBitmap).mock.calls[0]![1]).not.toHaveProperty("resizeHeight");
  });

  it("constrains the tall edge of a portrait photo", async () => {
    stubBitmap(1200, 1600);
    stubCanvas(new Blob([new Uint8Array(10)]));

    await normalizeImage(pngOf(3024, 4032));

    expect(vi.mocked(createImageBitmap).mock.calls[0]![1]).toMatchObject({
      resizeHeight: MAX_IMAGE_EDGE,
    });
  });

  it("never asks for more pixels than the picture has", async () => {
    stubBitmap(800, 600);
    stubCanvas(new Blob([new Uint8Array(10)]));

    await normalizeImage(pngOf(800, 600));

    const options = vi.mocked(createImageBitmap).mock.calls[0]![1]!;
    expect(options).not.toHaveProperty("resizeWidth");
    expect(options).not.toHaveProperty("resizeHeight");
  });
});

describe("normalizeImage", () => {
  it("follows the type the encoder actually produced", async () => {
    stubBitmap(4000, 3000);
    // Browsers without WebP encoding fall back to PNG rather than failing.
    stubCanvas(new Blob([new Uint8Array(200)], { type: "image/png" }));

    const result = await normalizeImage(fileOf(5000));

    expect(result.type).toBe("image/png");
    expect(result.name).toBe("imagen.png");
  });

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

  it("never holds two decoded pictures at once", async () => {
    // A phone photo decodes to tens of megabytes. Decoding a whole gallery
    // selection together is what crashed the tab before anything uploaded.
    let live = 0;
    let peak = 0;
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockImplementation(async () => {
        live += 1;
        peak = Math.max(peak, live);
        return {
          width: 4000,
          height: 3000,
          close: () => {
            live -= 1;
          },
        } as unknown as ImageBitmap;
      }),
    );
    stubCanvas(new Blob([new Uint8Array(10)]));

    await normalizeImages([fileOf(5000), fileOf(5000), fileOf(5000), fileOf(5000)]);

    expect(peak).toBe(1);
    expect(live).toBe(0);
  });

  it("releases the picture before encoding it", async () => {
    const close = stubBitmap(4000, 3000);
    let closedBeforeEncode = false;
    vi.spyOn(document, "createElement").mockReturnValue({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toBlob: (callback: (result: Blob | null) => void) => {
        closedBeforeEncode = close.mock.calls.length > 0;
        callback(new Blob([new Uint8Array(10)]));
      },
    } as unknown as HTMLCanvasElement);

    await normalizeImage(fileOf(5000));

    expect(closedBeforeEncode).toBe(true);
  });
});

describe("upload budget", () => {
  it("adds up what a selection would send", () => {
    expect(totalBytes([fileOf(1000), fileOf(2000)])).toBe(3000);
    expect(totalBytes([])).toBe(0);
  });

  it("keeps the budget under the Server Action limit", () => {
    expect(MAX_UPLOAD_BYTES).toBeLessThan(12 * 1024 * 1024);
  });
});
