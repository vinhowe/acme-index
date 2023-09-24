import { Octokit } from '@octokit/rest';
import { Env } from '../types';
import { BaseChapter, parseTextbook } from '@acme-index/common';

const getTextbookLocal = async <T extends BaseChapter>(book: string, name: string, textRespositorySource: string) => {
  const response = await fetch(`${textRespositorySource}/${name}.md`);
  const text = await response.text();
  return await parseTextbook<T>('acme', book, text);
};

const getTextbookKV = async <T extends BaseChapter>(
  book: string,
  name: string,
  textRespositorySource: string,
  botOctokit: Octokit,
  env: Env,
) => {
  let textbookData: any;
  const kvValue = await env.TEXTBOOK.get(name, 'json');
  if (!kvValue) {
    const [owner, repo] = textRespositorySource.split('/');
    const response = await botOctokit.repos.getContent({
      owner,
      repo,
      path: `${name}.md`,
    });
    const downloadUrl = (response.data as any).download_url;
    const downloadResponse = await fetch(downloadUrl);
    const text = await downloadResponse.text();
    textbookData = await parseTextbook<T>('acme', book, text);
    await env.TEXTBOOK.put(name, JSON.stringify(textbookData));
  } else {
    textbookData = kvValue as Record<string, T>;
  }
  return textbookData;
};

export const getTextbook = async <T extends BaseChapter>(book: string, name: string, env: Env, botOctokit: Octokit) => {
  const textRespositorySource = env.TEXT_REPOSITORY;
  // Check if env.TEXT_REPOSITORY is a URL (for local development)
  if (textRespositorySource.startsWith('http://') || textRespositorySource.startsWith('https://')) {
    return await getTextbookLocal<T>(book, name, textRespositorySource);
  } else {
    return await getTextbookKV<T>(book, name, textRespositorySource, botOctokit, env);
  }
};
