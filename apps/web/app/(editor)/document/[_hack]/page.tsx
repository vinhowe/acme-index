import dynamic from "next/dynamic";

const DocumentPage = dynamic(
  () => import("../_components/DocumentPageRouter"),
  {
    ssr: false,
  },
);

export default async function RootDocumentPage({
  params: _,
}: {
  params: { id: string };
}) {
  return <DocumentPage />;
}

export function generateStaticParams() {
  return [{ _hack: "hack" }];
}
