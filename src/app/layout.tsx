import type { Metadata } from "next";

import "../index.css";

export const metadata: Metadata = {
  title: "Koubou Workbench",
  description: "Multi-tenant GPT-Image-2 image workbench",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
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
