import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solana Wallet Connect",
  description: "Solana devnet wallet connection sample.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
