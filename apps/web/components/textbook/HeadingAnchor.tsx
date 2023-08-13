const HeadingAnchor = ({ id }: { id: string }) => (
  <a
    href={`#${id}`}
    className="anchor-link text-transparent no-underline ml-[0.15em]"
  >
    #
  </a>
);

export default HeadingAnchor;
