import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Auto OCR Capture",
  description: "Hands-free OCR capture pipeline"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(8,17,44,0.5),_rgba(5,9,20,0.95))] text-slate-100">
        {children}
      </body>
    </html>
  );
}

