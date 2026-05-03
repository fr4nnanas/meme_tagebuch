/**
 * Erzeugt maskable-512 (Safe Zone) und apple-touch-icon aus icon-512.png.
 * Ausführen: npm run gen:pwa-icons
 */
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "public", "icons");
const src = join(iconsDir, "icon-512.png");

const size = 512;
const inner = Math.round(size * 0.72);
/** zinc-900 – konsistent mit manifest.background_color */
const bg = { r: 24, g: 24, b: 27, alpha: 1 };

const resized = await sharp(src)
  .resize(inner, inner, { fit: "inside" })
  .toBuffer();

await sharp({
  create: {
    width: size,
    height: size,
    channels: 4,
    background: bg,
  },
})
  .composite([{ input: resized, gravity: "center" }])
  .png()
  .toFile(join(iconsDir, "icon-maskable-512.png"));

await sharp(src)
  .resize(180, 180, { fit: "cover" })
  .png()
  .toFile(join(iconsDir, "apple-touch-icon.png"));

console.log("gen-pwa-icons: icon-maskable-512.png, apple-touch-icon.png");
