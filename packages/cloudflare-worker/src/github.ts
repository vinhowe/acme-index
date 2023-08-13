import { IRequest } from 'itty-router';
import { AuthenticatedRequest, withAuthenticatedRequest } from './auth';
import { Octokit } from '@octokit/rest';
import { Env } from './types';

export const withOctokit = async (request: IRequest, env: Env) => {
  const authResponse = await withAuthenticatedRequest(request, env);
  if (authResponse) {
    return authResponse;
  }
  const octokit = new Octokit({
    auth: request.session.githubToken,
  });
  request.octokit = octokit;
};

export const withBotOctokit = async (request: IRequest, env: Env) => {
  const octokit = new Octokit({
    auth: env.GITHUB_BOT_ACCESS_TOKEN,
  });
  request.botOctokit = octokit;
};

export type OctokitRequest = IRequest & AuthenticatedRequest & { octokit: Octokit };
export type BotOctokitRequest = IRequest & { botOctokit: Octokit };
