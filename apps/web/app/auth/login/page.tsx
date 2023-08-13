"use client";

import { useEffect } from "react";

const LOGIN_URL =
  `${process.env.NEXT_PUBLIC_WORKER_URL}/auth/login` ||
  "//localhost:8787/auth/login";

const RedirectComponent = () => {
  useEffect(() => {
    document.requestStorageAccess().then(
      () => {
        console.log("storage access granted");
        window.location.href = LOGIN_URL;
      },
      () => {
        console.log("storage access denied");
      },
    );
  }, []);

  return <>redirecting and checking storage access...</>;
};

export default RedirectComponent;
