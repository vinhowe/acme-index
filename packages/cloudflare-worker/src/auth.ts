import { IRequest, json } from 'itty-router';
import { z } from 'zod';
import { WebCryptSession, createWebCryptSession } from 'webcrypt-session';
import { Env } from './types';

const sessionScheme = z.object({
  githubToken: z.string(),
  githubId: z.string(),
});

export const withWebCryptSession = async (request: IRequest, env: Env) => {
  const webCryptSession = await createWebCryptSession(sessionScheme, request, {
    password: env.WEBCRYPT_SESSION_SECRET,
  });
  request.session = webCryptSession;
};

export const withAuthenticatedRequest = async (request: IRequest, env: Env) => {
  await withWebCryptSession(request, env);
  if (!request.session.githubToken) {
    if (env.ENVIRONMENT !== "development") {
      return json({ error: "Unauthorized" }, {
        status: 401,
      });
    }
    request.session.githubToken = env.GITHUB_BOT_ACCESS_TOKEN;
    request.session.githubId = "development";
  }
};

export type AuthenticatedRequest = IRequest & { session: WebCryptSession<typeof sessionScheme> };
