import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();
const logoPath = path.join(rootDir, "public", "branding", "expand-arabia-logo.png");
const iconsDir = path.join(rootDir, "public", "icons");

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

async function generateIcon({ size, safePaddingRatio = 0.15, outputPath }) {
  const innerSize = Math.round(size * (1 - safePaddingRatio * 2));
  
  // Resize logo maintaining aspect ratio to fit within inner bounds
  const resizedLogoBuffer = await sharp(logoPath)
    .resize({
      width: innerSize,
      height: innerSize,
      fit: "inside",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .toBuffer();

  const resizedMetadata = await sharp(resizedLogoBuffer).metadata();
  const left = Math.round((size - resizedMetadata.width) / 2);
  const top = Math.round((size - resizedMetadata.height) / 2);

  // Composite onto pure white square background
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      {
        input: resizedLogoBuffer,
        top,
        left,
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  console.log(`Generated: ${path.relative(rootDir, outputPath)} (${size}x${size})`);
}

async function main() {
  console.log("Generating PWA icons from official Expand Arabia logo...");
  
  // Standard Icons (padding ~15%)
  await generateIcon({
    size: 192,
    safePaddingRatio: 0.12,
    outputPath: path.join(iconsDir, "icon-192.png"),
  });

  await generateIcon({
    size: 512,
    safePaddingRatio: 0.12,
    outputPath: path.join(iconsDir, "icon-512.png"),
  });

  // Maskable Icons (safe padding ~22% so logo is fully within the central 60% circle)
  await generateIcon({
    size: 192,
    safePaddingRatio: 0.22,
    outputPath: path.join(iconsDir, "maskable-192.png"),
  });

  await generateIcon({
    size: 512,
    safePaddingRatio: 0.22,
    outputPath: path.join(iconsDir, "maskable-512.png"),
  });

  // Apple Touch Icon (180x180)
  await generateIcon({
    size: 180,
    safePaddingRatio: 0.12,
    outputPath: path.join(iconsDir, "apple-touch-icon.png"),
  });

  // Favicon (32x32 & 48x48)
  await generateIcon({
    size: 32,
    safePaddingRatio: 0.08,
    outputPath: path.join(iconsDir, "favicon-32x32.png"),
  });

  await generateIcon({
    size: 48,
    safePaddingRatio: 0.08,
    outputPath: path.join(iconsDir, "favicon.png"),
  });

  console.log("All PWA icons successfully generated with white background and official logo!");
}

main().catch((err) => {
  console.error("Error generating icons:", err);
  process.exit(1);
});
