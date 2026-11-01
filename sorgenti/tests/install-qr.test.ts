import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import installation from "../apps/mobile/src/app-installation.json";

const qr = new URL(
  "../apps/mobile/assets/brand/maia-app-qr.png",
  import.meta.url,
);
test("the generated QR independently decodes to the exact public install page with no account or tracking parameters", async () => {
  const png = PNG.sync.read(await readFile(qr));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded?.data).toBe(installation.url);
  expect(decoded?.data).toBe("https://metimaia.com/installa");
  const url = new URL(decoded!.data);
  expect(url.search).toBe("");
  expect(url.hash).toBe("");
  expect(png.width).toBe(png.height);
  for (const [x, y] of [
    [0, 0],
    [png.width - 1, 0],
    [0, png.height - 1],
    [png.width - 1, png.height - 1],
  ]) {
    const i = (y * png.width + x) * 4;
    expect([...png.data.subarray(i, i + 4)]).toEqual([255, 255, 255, 255]);
  }
});
test("the QR remains decodable at its displayed 222 pixel size", async () => {
  const png = PNG.sync.read(await readFile(qr));
  const size = 222;
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const source =
        (Math.floor((y * png.height) / size) * png.width +
          Math.floor((x * png.width) / size)) *
        4;
      pixels.set(png.data.subarray(source, source + 4), (y * size + x) * 4);
    }
  expect(jsQR(pixels, size, size)?.data).toBe(installation.url);
});
