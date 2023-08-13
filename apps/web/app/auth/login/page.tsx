"use client";

import { useEffect } from "react";

const LOGIN_URL =
  `${process.env.NEXT_PUBLIC_WORKER_URL}/auth/login` ||
  "//localhost:8787/auth/login";

const RedirectComponent = () => {
  useEffect(() => {
    window.location.href = LOGIN_URL;
  }, []);

  return <>redirecting...</>;
};

export default RedirectComponent;
