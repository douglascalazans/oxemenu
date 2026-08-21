import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const IMAGE_PATHS = [
  "public/images/almoco.png",
  "public/images/cafe.png",
  "public/images/sobremesas.png",
] as const;

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

for (const imagePath of IMAGE_PATHS) {
  test(`${imagePath} is a complete, decodable PNG`, async () => {
    const png = await readFile(imagePath);
    assert.ok(png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE));

    const idatChunks: Buffer[] = [];
    let offset = PNG_SIGNATURE.length;
    let foundImageEnd = false;

    while (offset < png.length) {
      assert.ok(offset + 12 <= png.length, "truncated PNG chunk header");

      const length = png.readUInt32BE(offset);
      const typeStart = offset + 4;
      const dataStart = typeStart + 4;
      const dataEnd = dataStart + length;
      const crcEnd = dataEnd + 4;

      assert.ok(crcEnd <= png.length, "truncated PNG chunk data");

      const type = png.toString("ascii", typeStart, dataStart);
      const expectedCrc = png.readUInt32BE(dataEnd);
      const actualCrc = crc32(png.subarray(typeStart, dataEnd));

      assert.equal(actualCrc, expectedCrc, `invalid ${type} chunk checksum`);

      if (type === "IHDR") {
        assert.ok(png.readUInt32BE(dataStart) >= 800, "image width is unexpectedly small");
        assert.ok(png.readUInt32BE(dataStart + 4) >= 500, "image height is unexpectedly small");
      } else if (type === "IDAT") {
        idatChunks.push(png.subarray(dataStart, dataEnd));
      } else if (type === "IEND") {
        foundImageEnd = true;
      }

      offset = crcEnd;
    }

    assert.ok(foundImageEnd, "PNG is missing its IEND chunk");
    assert.ok(idatChunks.length > 0, "PNG has no image data");
    assert.doesNotThrow(() => inflateSync(Buffer.concat(idatChunks)));
  });
}
