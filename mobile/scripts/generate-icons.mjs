import sharp from 'sharp';
import fs from 'node:fs/promises';
import { Buffer } from 'node:buffer';

// A code-native calendar mark; keep the source so future branding is easy to edit.
const mark = (color) =>
  `<rect x="280" y="310" width="464" height="450" rx="76" fill="${color}"/><path d="M280 444h464" stroke="#F5F4F0" stroke-width="24"/><path d="M385 263v104m254-104v104" stroke="${color}" stroke-width="46" stroke-linecap="round"/><path d="m417 593 65 65 131-141" stroke="#F5F4F0" stroke-width="38" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
const svg = (background = false, mono = false) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${background ? '<rect width="1024" height="1024" rx="210" fill="#F5F4F0"/>' : ''}${mark(mono ? '#000000' : '#B8523E')}</svg>`,
  );
await Promise.all([
  sharp(svg(true)).png().toFile('assets/icon.png'),
  sharp(svg()).png().toFile('assets/android-icon-foreground.png'),
  sharp(svg(false, true)).png().toFile('assets/android-icon-monochrome.png'),
  sharp(svg()).png().toFile('assets/splash-icon.png'),
  sharp(svg(true)).resize(64).png().toFile('assets/favicon.png'),
]);
await fs.writeFile('assets/icon.svg', svg(true));
