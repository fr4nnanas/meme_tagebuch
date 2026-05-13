import sharp from "sharp";

const COMPOSITE_WIDTH = 1024;
const COMPOSITE_HEIGHT = 1536;

/** Zwei Portrait-Referenzen nebeneinander für einen einzelnen KI-Bild-Edit-Aufruf. */
export async function compositeReferenceJpegs(
  left: Buffer,
  right: Buffer,
): Promise<Buffer> {
  const [leftBuf, rightBuf] = await Promise.all([
    sharp(left)
      .resize(COMPOSITE_WIDTH / 2, COMPOSITE_HEIGHT, {
        fit: "cover",
        position: "attention",
      })
      .toBuffer(),
    sharp(right)
      .resize(COMPOSITE_WIDTH / 2, COMPOSITE_HEIGHT, {
        fit: "cover",
        position: "attention",
      })
      .toBuffer(),
  ]);

  return sharp({
    create: {
      width: COMPOSITE_WIDTH,
      height: COMPOSITE_HEIGHT,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite([
      { input: leftBuf, left: 0, top: 0 },
      { input: rightBuf, left: COMPOSITE_WIDTH / 2, top: 0 },
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}
