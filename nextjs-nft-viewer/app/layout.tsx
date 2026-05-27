import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Multi-chain NFT Viewer",
  description: "A multi-chain wallet NFT viewer powered by Alchemy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
