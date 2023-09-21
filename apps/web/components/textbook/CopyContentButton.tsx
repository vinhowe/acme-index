"use client";

export interface CopyContentButtonProps {
  content: string;
}

export const CopyContentButton: React.FC<CopyContentButtonProps> = ({
  content,
}) => {
  const copyToClipboard = () => {
    if (!content) {
      return;
    }

    navigator.clipboard.writeText(content);
  };
  return (
    <button
      className="material-symbols-rounded text-lg select-none text-neutral-700 dark:text-neutral-500"
      role="button"
      onClick={copyToClipboard}
    >
      content_copy
    </button>
  );
};
