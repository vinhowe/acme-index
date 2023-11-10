module.exports = (phase, { defaultConfig }) => {
  if (process.env.NODE_ENV === "production") {
    /** @type {import('next').NextConfig} */
    return {
      output: "export",
      // images: { unoptimized: true },
      // reactStrictMode: true,
      trailingSlash: true,
      skipTrailingSlashRedirect: true,
    };
  }

  return {
    // images: { unoptimized: true },
    // reactStrictMode: true,
    trailingSlash: true,
    skipTrailingSlashRedirect: true,
  };
};
