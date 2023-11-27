import dynamic from "next/dynamic";

const TextPage = dynamic(() => import("../_components/TextDevPage"), {
  ssr: false,
});

export default async function RootDocumentPage({
  params: _,
}: {
  params: { id: string };
}) {
  return <TextPage />;
}

export function generateStaticParams() {
  return [{ _hack: ["hack"] }];
}
