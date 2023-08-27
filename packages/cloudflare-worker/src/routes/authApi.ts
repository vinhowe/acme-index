import { IRequest, Router, json } from 'itty-router';
import { AuthenticatedRequest, withAuthenticatedRequest } from '../auth';
import { Env } from '../types';
import { ChatAccess, ChatTurnAccess, Database, KVObjectTable } from '../data';
import { BotOctokitRequest, withBotOctokit } from '../github';
import { parseRef } from 'textref';
import { AnthropicCompletionSource, CompletionManager, CompletionSourceMap, OpenAICompletionSource } from '../completions';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { getTextbook } from '../textbook/util';
import { Chat, ExercisesChapter, TextChapter } from '@acme-index/common';

type UserDataRequest = IRequest & AuthenticatedRequest & { database: Database };
type CompletionManagerRequest = UserDataRequest & { completionManager: CompletionManager };

export const router = Router({ base: '/api' });

const withUserData = async (request: IRequest & Partial<AuthenticatedRequest> & Partial<UserDataRequest>, env: Env) => {
  const authResponse = await withAuthenticatedRequest(request, env);
  // Cast request to AuthenticatedRequest:
  if (authResponse || !request.session) {
    return authResponse;
  }
  const chatAccess = new ChatAccess(new KVObjectTable<Chat>(env.USER_DATA, `user:${request.session.githubId}:chats`));
  request.database = {
    chats: chatAccess,
    chatTurns: new ChatTurnAccess(new KVObjectTable(env.USER_DATA, `user:${request.session.githubId}:chat-turns`), chatAccess),
  };
};

const withCompletionManager = async (request: UserDataRequest, env: Env) => {
  const [openaiApiKey, anthropicApiKey] = await Promise.all([
    env.USER_DATA.get(`user:${request.session.githubId}:openai-api-key`),
    env.USER_DATA.get(`user:${request.session.githubId}:anthropic-api-key`),
  ]);

  const completionSources: CompletionSourceMap = {};

  if (openaiApiKey) {
    const openaiClient = new OpenAI({ apiKey: openaiApiKey });
    completionSources.openai = new OpenAICompletionSource(openaiClient);
  }

  if (anthropicApiKey) {
    const anthropicClient = new Anthropic({ apiKey: anthropicApiKey });
    completionSources.anthropic = new AnthropicCompletionSource(anthropicClient);
  }

  // TODO: Figure out how to get this for free like everything else
  const completionManager = new CompletionManager(completionSources, request.database.chats, request.database.chatTurns, (name: string) =>
    getTextbook(name, env, request.botOctokit),
  );

  request.completionManager = completionManager;
};

router
  .all('*', withUserData)
  .get<UserDataRequest>('/chat', async (req, env) => {
    const chats = await req.database.chats.getAll();
    return json(chats);
  })
  .get<UserDataRequest>('/chat/:id', async (req, res) => {
    const { id } = req.params;
    const chat = await req.database.chats.get(id);

    if (!chat) {
      return json({ error: 'Chat not found' }, { status: 404 });
    }

    return json(chat);
  })
  .post<UserDataRequest & BotOctokitRequest, [env: Env]>('/chat', withBotOctokit, async (request, env) => {
    const { reference } = await request.json<{ reference: string }>();

    // Parse reference string
    const parsedReference = parseRef(reference, { partial: true });

    // TODO: This should really all be validated when a chat is created, not
    // when coming up with a completion
    if (!parsedReference || !('type' in parsedReference) || parsedReference.chapter === undefined) {
      return json({ error: 'Invalid reference' }, { status: 400 });
    }

    const { type, chapter, section } = parsedReference;

    if (type !== 'exercise') {
      // For now...
      return json({ error: 'Reference type must be exercise' }, { status: 400 });
    }

    const textbookTextData = await getTextbook<TextChapter>('v1', env, request.botOctokit);
    const textbookExercisesData = await getTextbook<ExercisesChapter>('v1-exercises', env, request.botOctokit);
    const chapterTextData = textbookTextData[chapter];
    const chapterExercisesData = textbookExercisesData[chapter];
    if (!chapterTextData || !chapterExercisesData) {
      throw new Error('Chapter not found');
    }
    // Find exercise in chapter (section doesn't mean chapter section)
    let exercise;
    let sectionId;
    for (let exercisesSection of chapterExercisesData.sections) {
      for (let sectionExercise of exercisesSection.body) {
        if (sectionExercise.type === 'exercise' && sectionExercise.id === `${chapter}.${section}`) {
          exercise = sectionExercise;
          sectionId = exercisesSection.id;
          break;
        }
      }
      if (exercise) {
        break;
      }
    }
    if (!exercise || !sectionId) {
      return json({ error: 'Exercise not found' }, { status: 400 });
    }

    const chat = await request.database.chats.createChat({
      reference: reference,
      provider: 'openai',
      model: 'gpt-4',
    });

    return json(chat);
  })
  .get('/chat/:chatId/turns-to/:turnId', async (request) => {
    // We just ignore the chat id for now because we expect turn ids to be unique
    const { turnId } = request.params;
    const turns = await request.database.chatTurns.getTurnsTo(turnId);

    return json(turns);
  })
  .post<CompletionManagerRequest, [env: Env]>('/chat/:id/turn', withCompletionManager, async (request, env) => {
    const { id } = request.params;
    const {
      query,
      parentId,
      streaming = false,
      maxTokens,
    } = await request.json<{
      query: string;
      parentId?: string;
      streaming?: boolean;
      maxTokens?: number;
    }>();

    if (!query) {
      return json({ error: 'No query' }, { status: 400 });
    }

    const chat = await request.database.chats.get(id);

    if (!chat) {
      return json({ error: 'Chat not found' }, { status: 404 });
    }

    let parentTurn = null;
    if (parentId) {
      parentTurn = await request.database.chatTurns.get(parentId);

      if (!parentTurn) {
        return json({ error: 'Parent turn not found' }, { status: 404 });
      }
    }

    const turn = await request.database.chatTurns.addTurn({
      chatId: id,
      parent: parentId,
      query,
    });

    // const emitter = request.completionManager.createCompletionBroadcast(turn.id);

    const { readable, writable } = new TransformStream();
    let writer = await writable.getWriter();
    let encoder = new TextEncoder();

    const pipeStream = async () => {
      await writer.write(encoder.encode(`event: start\n`));
      await writer.write(encoder.encode(`data: ${JSON.stringify(turn)}\n\n`));
      await writer.releaseLock();

      const generator = await request.completionManager.completionGenerator(chat.id, turn.id, { maxTokens });

      for await (const delta of generator) {
        writer = await writable.getWriter();
        await writer.write(encoder.encode(`event: update\n`));
        await writer.write(encoder.encode(`data: ${JSON.stringify(delta)}\n\n`));
        await writer.releaseLock();
      }

      writer = await writable.getWriter();
      await writer.write(encoder.encode('event: end\n\n'));
      await writer.releaseLock();

      await readable.cancel();
      await writer.close();
    };

    pipeStream();

    return new Response(readable, {
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
      },
    });
  })
  .get<CompletionManagerRequest, [env: Env]>('/chat/:chatId/turn/:turnId', withCompletionManager, async (request, env) => {
    const { chatId, turnId } = request.params;
    const { streaming } = request.query;
    // If streaming, we want to return a stream of updates, or just one update
    // if the turn is already finished—check using turn.status

    const turn = await request.database.chatTurns.get(turnId);

    if (!turn) {
      return json({ error: 'Turn not found' }, { status: 404 });
    }
    if (turn.chatId !== chatId) {
      return json({ error: "Turn doesn't belong to specified chat" }, { status: 400 });
    }

    return json(turn);
  })
  .get<AuthenticatedRequest>('/user', withAuthenticatedRequest, async (request, env: Env) => {
    if (!request.session.githubToken) {
      return new Response('Unauthorized', {
        status: 401,
      });
    }

    const response = await fetch('https://api.github.com/user', {
      headers: {
        'content-type': 'application/json',
        'user-agent': 'acme-index',
        accept: 'application/json',
        authorization: `token ${request.session.githubToken}`,
      },
    });
    const result = await response.json();
    return new Response(JSON.stringify(result), {
      status: 200,
    });
  });
