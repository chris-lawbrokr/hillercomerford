import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hiller Comerford Injury & Disability Law | Get A Free Evaluation",
  description:
    "Personal Injury and Social Security Disability law firm in Western New York.",
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
