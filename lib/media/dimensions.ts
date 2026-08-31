/**
 * Reads a picture's size from its header, without decoding it.
 *
 * Knowing the dimensions up front is what lets the decoder downscale as it
 * reads. A 24-megapixel phone photo is about 97 MB once decoded at full size,
 * which is enough on its own to have a mobile browser kill the tab, so the
 * full-size bitmap must never be allocated in the first place.
 */
const PREFIX_BYTES = 256 * 1024;

export type ImageSize = { width: number; height: number };

function readUint16(bytes: Uint8Array, offset: number, littleEndian = false) {
  return littleEndian
    ? bytes[offset]! | (bytes[offset + 1]! << 8)
    : (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...Array.from(bytes.slice(offset, offset + length)));
}

/** PNG carries its size in the IHDR chunk, always at a fixed offset. */
function pngSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 24) return null;

  return { width: readUint32(bytes, 16), height: readUint32(bytes, 20) };
}

/**
 * JPEG keeps its size in a start-of-frame segment, which sits after however
 * much EXIF the camera wrote, so the segments are walked rather than assumed.
 */
function jpegSize(bytes: Uint8Array): ImageSize | null {
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1]!;
    // Start-of-frame markers, minus the ones that mean something else.
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      return { height: readUint16(bytes, offset + 5), width: readUint16(bytes, offset + 7) };
    }

    // Standalone markers carry no length; everything else does.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }

    const length = readUint16(bytes, offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }

  return null;
}

function webpSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 30) return null;
  const chunk = ascii(bytes, 12, 4);

  if (chunk === "VP8X") {
    return {
      width: (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)) + 1,
      height: (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)) + 1,
    };
  }

  if (chunk === "VP8 ") {
    return {
      width: readUint16(bytes, 26, true) & 0x3fff,
      height: readUint16(bytes, 28, true) & 0x3fff,
    };
  }

  if (chunk === "VP8L") {
    // Little-endian bit packing after the signature byte: 14 bits of width,
    // then 14 of height, each stored one less than the real value.
    const packed =
      bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24);

    return { width: (packed & 0x3fff) + 1, height: ((packed >>> 14) & 0x3fff) + 1 };
  }

  return null;
}

/** The picture's size, or null when the header does not say. */
export async function probeImageSize(file: Blob): Promise<ImageSize | null> {
  const bytes = new Uint8Array(await file.slice(0, PREFIX_BYTES).arrayBuffer());
  if (bytes.length < 12) return null;

  const size =
    bytes[0] === 0x89 && bytes[1] === 0x50
      ? pngSize(bytes)
      : bytes[0] === 0xff && bytes[1] === 0xd8
        ? jpegSize(bytes)
        : ascii(bytes, 0, 4) === "RIFF"
          ? webpSize(bytes)
          : null;

  return size && size.width > 0 && size.height > 0 ? size : null;
}
