import { Octokit } from '@octokit/rest';
import { Env } from '../types';
import { BaseChapter, parseTextbook } from '@acme-index/common';

export const getTextbook = async <T extends BaseChapter>(name: string, env: Env, botOctokit: Octokit) => {
  let textbookData: any;
  const kvValue = await env.TEXTBOOK.get(name, 'json');
  if (!kvValue) {
    const [owner, repo] = env.TEXT_REPOSITORY.split('/');
    const response = await botOctokit.repos.getContent({
      owner,
      repo,
      path: `${name}.md`,
    });
    const downloadUrl = (response.data as any).download_url;
    const downloadResponse = await fetch(downloadUrl);
    const text = await downloadResponse.text();
    textbookData = await parseTextbook<T>(text);
    await env.TEXTBOOK.put(name, JSON.stringify(textbookData));
  } else {
    textbookData = kvValue as Record<string, T>;
  }
  return textbookData;
};
