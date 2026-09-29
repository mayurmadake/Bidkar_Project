import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Account Register",
  description: "Company, site, vendor and transaction register"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
