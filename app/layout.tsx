import type { Metadata } from "next";
import { Montserrat, Domine } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

const domine = Domine({
  variable: "--font-domine",
  subsets: ["latin"],
  display: "swap",
});

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
    <html lang="en" className={`${montserrat.variable} ${domine.variable}`}>
      <body>{children}</body>
    </html>
  );
}
