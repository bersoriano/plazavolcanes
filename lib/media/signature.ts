import type { MediaContentType } from "@/lib/media/keys";

/**
 * A file's declared MIME type is a claim made by whoever uploaded it, not a
 * fact about its bytes, and the bucket's own allowlist checks that same claim.
 * These are the byte signatures the real formats start with, so the content
 * type the rest of the upload path uses is read from the file itself.
 */
const SIGNATURES: { type: MediaContentType; parts: { offset: number; bytes: number[] }[] }[] = [
  { type: "image/jpeg", parts: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }] },
  {
    type: "image/png",
    parts: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  },
  {
    // RIFF....WEBP — the four bytes between the two markers are the file size.
    type: "image/webp",
    parts: [
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
      { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
    ],
  },
];

const HEADER_BYTES = 12;

function matches(header: Uint8Array, parts: { offset: number; bytes: number[] }[]) {
  return parts.every((part) =>
    part.bytes.every((byte, index) => header[part.offset + index] === byte),
  );
}

/** The content type the bytes actually are, or null when they are not an image we take. */
export async function sniffImageType(file: Blob): Promise<MediaContentType | null> {
  const header = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  if (header.length < 3) return null;

  return SIGNATURES.find((signature) => matches(header, signature.parts))?.type ?? null;
}
