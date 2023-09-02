import "../globals.css";
import "katex/dist/katex.min.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/ixr7lrv.css" />
      </head>
      <body className="overscroll-x-none">{children}</body>
    </html>
  );
}

export const dynamic = "force-static";
