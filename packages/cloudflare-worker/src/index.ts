import { RouteHandler, Router, createCors, error, json } from 'itty-router';
import { ExecutionContext } from '@cloudflare/workers-types';
import { Env } from './types';
import { AuthenticatedRequest, withWebCryptSession } from './auth';
import { OctokitRequest, withBotOctokit, withOctokit } from './github';
import { router as apiRouter } from './routes/authApi';
import { Octokit } from '@octokit/rest';
import { parseRef } from 'textref';
import { getTextbook } from './textbook/util';
import { TextChapter } from '@acme-index/common';

export type Handler = RouteHandler<Request, [Env, ExecutionContext, { session: string }]>;

const corsConfig = {
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  origins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  headers: {
    'Access-Control-Allow-Credentials': 'true',
  },
};

const router = Router();

router.all('*', (request: Request, env: Env) => {
  const corsConfigWithPublicOrigin = {
    ...corsConfig,
    origins: [...corsConfig.origins, env.WEBSITE_URL],
  };
  const { preflight } = createCors(corsConfigWithPublicOrigin);
  return preflight(request);
});

router
  .get('/api/textbook/text/:reference+', withBotOctokit, async (req, env) => {
    const { reference } = req.params;
    const parsedReference = parseRef(reference, { partial: true });

    if (!parsedReference) {
      return json({ error: 'Invalid reference' }, { status: 400 });
    }

    // For now, we ignore the namespace and book
    // const { namespace, book } = parsedReference;

    let textbookData: Record<string, TextChapter> | TextChapter = await getTextbook<TextChapter>('v1', env, req.botOctokit);

    if ('chapter' in parsedReference && parsedReference.chapter !== undefined) {
      const { chapter } = parsedReference;
      // @ts-expect-error
      textbookData = textbookData[chapter];
    }

    return json(textbookData);
  })
  .get('/api/textbook/chapters/:reference+', withBotOctokit, async (req, env) => {
    const { reference } = req.params;
    const parsedReference = parseRef(reference, { partial: true });

    if (!parsedReference) {
      return json({ error: 'Invalid reference' }, { status: 400 });
    }

    // For now, we ignore the namespace and book
    // const { namespace, book } = parsedReference;

    let textbookData: Record<string, TextChapter> | TextChapter = await getTextbook<TextChapter>('v1', env, req.botOctokit);

    return json(Object.keys(textbookData));
  })
  .get('/api/textbook/exercises/:reference+', withBotOctokit, async (req, env) => {
    const { reference } = req.params;
    const parsedReference = parseRef(reference, { partial: true });

    if (!parsedReference) {
      return json({ error: 'Invalid reference' }, { status: 400 });
    }

    // For now, we ignore the namespace and book
    // const { namespace, book } = parsedReference;
    let textbookData: Record<string, TextChapter> | TextChapter = await getTextbook<TextChapter>('v1-exercises', env, req.botOctokit);
    if ('chapter' in parsedReference && parsedReference.chapter !== undefined) {
      const { chapter } = parsedReference;
      // @ts-expect-error
      textbookData = textbookData[chapter];
    }

    return json(textbookData);
  });

router.all('/api/*', apiRouter.handle);

router
  .get('/auth/login', (request, env: Env) => {
    // const callbackUri = 'http://127.0.0.1:3000/auth/callback';
    const callbackUri = `${env.WEBSITE_URL}/auth/callback`;
    return Response.redirect(
      `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${callbackUri}&scope=repo`,
      302,
    );
  })
  .post<AuthenticatedRequest & Partial<OctokitRequest>>('/auth/callback', withWebCryptSession, async (request, env: Env) => {
    try {
      const { code } = await request.json<{ code: string }>();

      if (!code) {
        return json({ error: 'Missing code' }, { status: 400 });
      }

      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'acme-index',
          accept: 'application/json',
        },
        body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }),
      });
      const result = await response.json<{ error?: string; access_token?: string }>();

      if (result.error || !result.access_token) {
        return new Response(JSON.stringify(result), { status: 401 });
      }

      const octokit = new Octokit({
        auth: result.access_token,
      });

      const user = await octokit.users.getAuthenticated();

      await request.session.save({ githubToken: result.access_token, githubId: user.data.id.toString() });

      const sessionHeaderValue = request.session.toHeaderValue();

      if (!sessionHeaderValue) {
        throw new Error('Failed to create session header value');
      }

      return new Response(JSON.stringify({ token: result.access_token }), {
        status: 201,
        headers: {
          'content-type': 'application/json',
          'Set-Cookie': `${sessionHeaderValue}; Path=/; SameSite=None; Secure`,
        },
      });
    } catch (error) {
      console.error(error);
      return new Response((error as any).message, {
        status: 500,
      });
    }
  })

  // .post<OctokitRequest>('/create-repo', withOctokit, async (request, env: Env) => {
  //   const { name } = await request.json<{ name: string }>();
  //   const response = await request.octokit.repos.createForAuthenticatedUser({
  //     name,
  //     auto_init: true,
  //   });
  //   return new Response(JSON.stringify(response.data), {
  //     status: 201,
  //   });
  // })
  // .post<OctokitRequest & BotOctokitRequest>('/clean-repo', withOctokit, withBotOctokit, async (request, env: Env) => {
  //   const { name } = await request.json<{ name: string }>();
  //   const user = await request.octokit.users.getAuthenticated();
  //   // List refs
  //   const refsResponse = await request.octokit.git.listMatchingRefs({
  //     owner: user.data.login,
  //     repo: name,
  //     // List all refs
  //     ref: 'heads/',
  //   });
  //   // Delete all refs
  //   await Promise.all(
  //     refsResponse.data.map(async (ref) => {
  //       await request.botOctokit.git.deleteRef({
  //         owner: user.data.login,
  //         repo: name,
  //         ref: ref.ref.replace('refs/', ''),
  //       });
  //     })
  //   );
  //   // Remove collaborators
  //   const collaboratorsResponse = await request.octokit.repos.listCollaborators({
  //     owner: user.data.login,
  //     repo: name,
  //   });
  //   await Promise.all(
  //     collaboratorsResponse.data.map(async (collaborator) => {
  //       await request.octokit.repos.removeCollaborator({
  //         owner: user.data.login,
  //         repo: name,
  //         username: collaborator.login,
  //       });
  //     })
  //   );
  //   return json({
  //     refs: refsResponse.data,
  //     collaborators: collaboratorsResponse.data,
  //   });
  // })
  // .post<OctokitRequest & BotOctokitRequest>('/push-initial-commit', withBotOctokit, withOctokit, async (request, env: Env) => {
  //   const { name } = await request.json<{ name: string }>();
  //   const user = await request.octokit.users.getAuthenticated();
  //   const repo = await request.octokit.repos.get({
  //     owner: user.data.login,
  //     repo: name,
  //   });
  //   const default_branch = repo.data.default_branch;
  //   // Check if .initial exists
  //   const fileResponse = await request.octokit.repos.createOrUpdateFileContents({
  //     owner: user.data.login,
  //     repo: name,
  //     path: '.initial',
  //     message: 'Initial commit',
  //     content: bytesToBase64(new TextEncoder().encode(`# ${name}`)),
  //     branch: default_branch,
  //   });
  //   const fileSha = (fileResponse.data.content as any).sha;
  //   // delete .initial
  //   await request.octokit.repos.deleteFile({
  //     owner: user.data.login,
  //     repo: name,
  //     path: '.initial',
  //     message: 'Initial commit',
  //     branch: default_branch,
  //     sha: fileSha,
  //   });
  //   // Create empty commit using 4b825dc642cb6eb9a060e54bf8d69288fbee4904
  //   const firstCommitResponse = await request.octokit.git.createCommit({
  //     owner: user.data.login,
  //     repo: name,
  //     message: 'initial commit',
  //     tree: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
  //     parents: [],
  //   });
  //   // Update default branch to point to empty commit
  //   await request.octokit.git.updateRef({
  //     owner: user.data.login,
  //     repo: name,
  //     ref: `heads/${default_branch}`,
  //     force: true,
  //     sha: firstCommitResponse.data.sha,
  //   });
  //   const chatsTreeResponse = await request.octokit.git.createTree({
  //     owner: user.data.login,
  //     repo: name,
  //     tree: [
  //       {
  //         path: 'chats.json',
  //         mode: '100644',
  //         type: 'blob',
  //         content: JSON.stringify({}),
  //       },
  //     ],
  //   });
  //   // Create commit:
  //   const chatsCommitResponse = await request.octokit.git.createCommit({
  //     owner: user.data.login,
  //     repo: name,
  //     message: 'update chats',
  //     tree: chatsTreeResponse.data.sha,
  //     parents: [firstCommitResponse.data.sha],
  //   });
  //   // Create branch:
  //   await request.octokit.git.createRef({
  //     owner: user.data.login,
  //     repo: name,
  //     ref: `refs/heads/chats`,
  //     force: true,
  //     sha: chatsCommitResponse.data.sha,
  //   });
  //   const chatTurnsTreeResponse = await request.octokit.git.createTree({
  //     owner: user.data.login,
  //     repo: name,
  //     tree: [
  //       {
  //         path: 'chat-turns.json',
  //         mode: '100644',
  //         type: 'blob',
  //         content: JSON.stringify({}),
  //       },
  //     ],
  //   });
  //   // Create commit:
  //   const chatTurnsCommitResponse = await request.octokit.git.createCommit({
  //     owner: user.data.login,
  //     repo: name,
  //     message: 'update chat turns',
  //     tree: chatTurnsTreeResponse.data.sha,
  //     parents: [firstCommitResponse.data.sha],
  //   });
  //   // Create branch:
  //   await request.octokit.git.createRef({
  //     owner: user.data.login,
  //     repo: name,
  //     ref: `refs/heads/chat-turns`,
  //     force: true,
  //     sha: chatTurnsCommitResponse.data.sha,
  //   });

  //   // Get tree of chats branch
  //   const afterChatsTreeResponse = await request.octokit.git.getTree({
  //     owner: user.data.login,
  //     repo: name,
  //     tree_sha: chatsCommitResponse.data.sha,
  //   });
  //   // Get tree of chat-turns branch
  //   const afterChatTurnsTreeResponse = await request.octokit.git.getTree({
  //     owner: user.data.login,
  //     repo: name,
  //     tree_sha: chatTurnsCommitResponse.data.sha,
  //   });

  //   // Create new tree by combining the two trees
  //   const newTreeResponse = await request.octokit.git.createTree({
  //     owner: user.data.login,
  //     repo: name,
  //     tree: [...(afterChatsTreeResponse.data.tree as any[]), ...(afterChatTurnsTreeResponse.data.tree as any[])],
  //   });
  //   const newCommitResponse = await request.octokit.git.createCommit({
  //     owner: user.data.login,
  //     repo: name,
  //     message: 'Merge data',
  //     tree: newTreeResponse.data.sha,
  //     parents: [firstCommitResponse.data.sha],
  //   });

  //   // Update the main branch to point to the new chat turns commit
  //   await request.octokit.git.updateRef({
  //     owner: user.data.login,
  //     repo: name,
  //     ref: `heads/${default_branch}`,
  //     force: true,
  //     sha: newCommitResponse.data.sha,
  //   });

  //   return json({});
  // })
  // .post<AuthenticatedRequest>('/invite-bot', withOctokit, withBotOctokit, async (request, env: Env) => {
  //   const { name } = await request.json<{ name: string }>();
  //   const user = await request.octokit.users.getAuthenticated();
  //   const invitation = await request.octokit.repos.addCollaborator({
  //     owner: user.data.login,
  //     repo: name,
  //     username: 'acme-index-bot',
  //     permission: 'admin',
  //   });
  //   await request.botOctokit.repos.acceptInvitationForAuthenticatedUser({
  //     invitation_id: invitation.data.id,
  //   });
  //   return json({ invitation });
  // })
  // // .post<OctokitRequest>('/delete-repo', withOctokit, async (request, env: Env) => {
  // // 	const { name } = await request.json<{ name: string }>();
  // // 	const user = await request.octokit.users.getAuthenticated();
  // // 	const response = await request.octokit.repos.delete({
  // // 		owner: user.data.login,
  // // 		repo: name,
  // // 	});
  // // 	return new Response(JSON.stringify(response.data), {
  // // 		status: 204,
  // // 	});
  // // })
  // .get<AuthenticatedRequest>('/signout', withWebCryptSession, async (request, env: Env) => {
  //   return new Response(null, {
  //     status: 200,
  //     headers: {
  //       'Set-Cookie': 'session=delete; expires=Thu, 01 Jan 1970 00:00:00 GMT',
  //     },
  //   });
  // })
  // // we can chain definitions to reduce boilerplate
  .get('*', () => error(404));

// function bytesToBase64(bytes: Uint8Array) {
//   const binString = Array.from(bytes, (x) => String.fromCodePoint(x)).join('');
//   return btoa(binString);
// }

// const credentialCorsify = (response: Response) => {
//   const headers = new Headers(response.headers);
//   headers.set('Access-Control-Allow-Credentials', 'true');
//   return new Response(response.body, {
//     ...response,
//     headers,
//   });
// };

const wrappedCorsify = async (request: Request, response: Response, env: Env) => {
  const corsConfigWithPublicOrigin = {
    ...corsConfig,
    origins: [...corsConfig.origins, env.WEBSITE_URL],
  };
  const { preflight, corsify } = createCors(corsConfigWithPublicOrigin);
  // Need to get the side effects of preflight to add allow origin header
  await preflight(request);
  return corsify(response);
};

export default {
  fetch: (request, ...args) =>
    router
      .handle(request, ...args)
      .then(json)
      .then((response: Response) => wrappedCorsify(request, response, ...args))
      .catch(error),
  // .then(credentialCorsify),
} satisfies ExportedHandler;
