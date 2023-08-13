"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const WORKER_URL = "//localhost:8787/auth/callback";

const GitHubLogin = () => {
  const [error, setError] = useState<unknown | null>(null);
  const router = useRouter();

  const loginWithCode = useCallback(
    async (code: string) => {
      const path =
        window.location.pathname +
        window.location.search.replace(/\bcode=[^?&#]*/, "").replace(/\?$/, "");
      router.push(path);

      try {
        const response = await fetch(WORKER_URL, {
          method: "POST",
          mode: "cors",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ code }),
        });

        const result = await response.json();

        if (result.error) {
          // return alert(JSON.stringify(result, null, 2));
          console.error(result.error);
          return;
        }

        const getUserResponse = await fetch("https://api.github.com/user", {
          headers: {
            accept: "application/vnd.github.v3+json",
            authorization: `token ${result.token}`,
          },
        });
        const { login } = await getUserResponse.json();
        router.push("/read/v1/1");
      } catch (error) {
        console.error(error);
        // window.location.reload();
        setError(error);
      }
    },
    [router]
  );

  useEffect(() => {
    const code = new URL(window.location.href).searchParams.get("code");
    if (code) {
      loginWithCode(code);
    }
  }, [loginWithCode]);

  return (
    <div className="w-[100dvw] h-[100dvh] flex justify-center items-center font-button text-xl">
      {error ? "error logging in" : "logging in..."}
    </div>
  );
};

export default GitHubLogin;

export const dynamic = "force-dynamic";
