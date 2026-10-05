import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Avenlo — Talent intelligence. Human decisions.",
  description: "A private talent-intelligence and human-led matching platform.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
