import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Minimal PNG generator using standard Node.js zlib
function createPngBuffer(width: number, height: number, drawFn: (x: number, y: number) => [number, number, number, number]): Buffer {
  const rowSize = width * 4;
  const rawData = Buffer.alloc((rowSize + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (rowSize + 1);
    rawData[rowOffset] = 0; // Filter byte: 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function createChunk(type: string, data: Buffer): Buffer {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);

    // CRC32
    let c = 0xffffffff;
    for (let i = 4; i < 8 + len; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
      }
    }
    buf.writeInt32BE((c ^ 0xffffffff) | 0, 8 + len);
    return buf;
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth: 8
  ihdr[9] = 6; // color type: 6 (RGBA)
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace: none
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT
  const idatChunk = createChunk('IDAT', deflated);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function generateIcons() {
  const publicDir = path.resolve(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const sizes = [
    { name: 'pwa-192x192.png', size: 192, maskable: false },
    { name: 'pwa-512x512.png', size: 512, maskable: false },
    { name: 'pwa-maskable-512x512.png', size: 512, maskable: true },
    { name: 'apple-touch-icon.png', size: 180, maskable: false },
    { name: 'favicon-32x32.png', size: 32, maskable: false },
    { name: 'favicon-16x16.png', size: 16, maskable: false },
  ];

  for (const { name, size, maskable } of sizes) {
    const radius = size * 0.44;
    const center = size / 2;

    const pngBuffer = createPngBuffer(size, size, (x, y) => {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Maskable icons need safe background filling the entire square or squircle
      if (maskable) {
        // Deep slate/dark background with golden/emerald radar circle
        if (dist <= radius) {
          // Inner icon
          const angle = Math.atan2(dy, dx);
          const ringDist1 = Math.abs(dist - radius * 0.65);
          const ringDist2 = Math.abs(dist - radius * 0.35);
          if (dist < radius * 0.15) {
            // Center radar bullseye (Gold/Emerald)
            return [240, 185, 11, 255];
          }
          if (ringDist1 < size * 0.03 || ringDist2 < size * 0.02) {
            return [16, 185, 129, 220]; // Emerald ring
          }
          if (Math.abs(dx) < size * 0.02 || Math.abs(dy) < size * 0.02) {
            return [52, 211, 153, 180]; // Crosshairs
          }
          return [15, 23, 42, 255]; // Deep Slate inside
        }
        return [2, 6, 23, 255]; // Deep dark space background
      }

      // Rounded app icon for standard non-maskable
      const cornerRadius = size * 0.22;
      const rx = Math.max(0, Math.abs(dx) - (size / 2 - cornerRadius));
      const ry = Math.max(0, Math.abs(dy) - (size / 2 - cornerRadius));
      const cornerDist = Math.sqrt(rx * rx + ry * ry);
      if (cornerDist > cornerRadius) {
        return [0, 0, 0, 0]; // Transparent outside rounded corner
      }

      // App icon background gradient
      if (dist <= radius * 0.85) {
        const ringDist1 = Math.abs(dist - radius * 0.6);
        const ringDist2 = Math.abs(dist - radius * 0.3);
        if (dist < radius * 0.14) {
          return [240, 185, 11, 255]; // Amber Gold center
        }
        if (ringDist1 < size * 0.035 || ringDist2 < size * 0.025) {
          return [16, 185, 129, 240]; // Emerald radar sweep
        }
        if (Math.abs(dx) < size * 0.02 || Math.abs(dy) < size * 0.02) {
          return [45, 212, 191, 200]; // Cyan crosshair
        }
        return [15, 23, 42, 255];
      }

      // Outer ring border
      if (dist <= radius * 0.95 && dist >= radius * 0.85) {
        return [240, 185, 11, 255]; // Gold accent ring
      }

      return [10, 15, 30, 255];
    });

    const targetFile = path.join(publicDir, name);
    fs.writeFileSync(targetFile, pngBuffer);
    console.log(`Generated ${targetFile} (${size}x${size})`);
  }

  // Also write an SVG icon
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#020617"/>
    </radialGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f0b90b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
    <linearGradient id="emerald" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="110" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="190" stroke="url(#gold)" stroke-width="8" fill="none" opacity="0.6"/>
  <circle cx="256" cy="256" r="130" stroke="url(#emerald)" stroke-width="6" fill="none" stroke-dasharray="8 8"/>
  <circle cx="256" cy="256" r="70" stroke="#38bdf8" stroke-width="5" fill="none"/>
  <line x1="256" y1="56" x2="256" y2="456" stroke="#334155" stroke-width="3"/>
  <line x1="56" y1="256" x2="456" y2="256" stroke="#334155" stroke-width="3"/>
  <path d="M 256 256 L 390 122 A 190 190 0 0 0 256 66 Z" fill="url(#gold)" opacity="0.25"/>
  <circle cx="256" cy="256" r="24" fill="url(#gold)"/>
  <polygon points="256,190 280,240 335,240 290,270 310,320 256,290 202,320 222,270 177,240 232,240" fill="#ffffff" opacity="0.9" transform="scale(0.35) translate(475, 475)"/>
</svg>`;

  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf-8');
  console.log('Generated /public/icon.svg');
}

generateIcons();
