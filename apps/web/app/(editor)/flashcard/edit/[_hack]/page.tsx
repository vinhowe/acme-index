import dynamic from "next/dynamic";

const FlashcardPage = dynamic(
  () => import("../../_components/FlashcardPageRouter"),
  {
    ssr: false,
  },
);

export default async function RootFlashcardPage({
  params: _,
}: {
  params: { id: string };
}) {
  return <FlashcardPage />;
}

export function generateStaticParams() {
  return [{ _hack: "hack" }];
}
