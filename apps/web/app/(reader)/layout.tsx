import "../globals.css";
import "katex/dist/katex.min.css";
import Script from "next/script";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        <link rel="stylesheet" href="https://use.typekit.net/ixr7lrv.css" />
      </head>
      <body className="overscroll-x-none">{children}</body>
    </html>
  );
}
