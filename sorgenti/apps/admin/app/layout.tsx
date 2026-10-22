import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Nido — Studio editoriale",
  description: "Lo spazio editoriale di Nido, insieme passo dopo passo.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
