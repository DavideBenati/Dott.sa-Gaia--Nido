import { readFile, writeFile } from "node:fs/promises";
import QRCode from "qrcode";

const configuration = JSON.parse(
  await readFile(
    new URL("../apps/mobile/src/app-installation.json", import.meta.url),
    "utf8",
  ),
);
const destination = new URL(configuration.url);
if (destination.href !== "https://metimaia.com/installa")
  throw new Error(
    "The installation QR must contain only the public installation URL.",
  );
const png = await QRCode.toBuffer(destination.href, {
  type: "png",
  errorCorrectionLevel: "M",
  margin: 4,
  scale: 10,
  color: { dark: "#000000ff", light: "#ffffffff" },
});
await writeFile(
  new URL("../apps/mobile/assets/brand/maia-app-qr.png", import.meta.url),
  png,
);
console.log(
  "Installation QR generated for the public metiMaia installation page.",
);
