import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FACET CRM — Technopanel",
  description: "Customer Relationship Management — Technopanel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
