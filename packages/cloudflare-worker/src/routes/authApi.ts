import { IRequest, Router, json } from 'itty-router';
import { AuthenticatedRequest, withAuthenticatedRequest } from '../auth';
import { Env } from '../types';
import {
  DocumentCellAccess,
  ChatAccess,
  ChatTurnAccess,
  Database,
  DocumentAccess,
  KVObjectTable,
  ReferenceAccess,
  FlashcardAccess,
} from '../data';
import { BotOctokitRequest, withBotOctokit } from '../github';
import { parseRef } from 'textref';
import { AnthropicCompletionSource, CompletionManager, CompletionSourceMap, OpenAICompletionSource } from '../completions';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { getTextbook } from '../textbook/util';
import { Chat, ChatTurn, DocumentCell, ExercisesChapter, TextChapter, UniqueID, Flashcard } from '@acme-index/common';
import { v4 as uuid } from 'uuid';

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
    documents: new DocumentAccess(new KVObjectTable(env.USER_DATA, `user:${request.session.githubId}:documents`)),
    documentCells: new DocumentCellAccess(new KVObjectTable(env.USER_DATA, `user:${request.session.githubId}:document-cells`)),
    references: new ReferenceAccess(new KVObjectTable(env.USER_DATA, `user:${request.session.githubId}:references`)),
    flashcards: new FlashcardAccess(new KVObjectTable(env.USER_DATA, `user:${request.session.githubId}:flashcards`)),
  };
};

const withCompletionManager = async (request: UserDataRequest, env: Env) => {
  const [openaiApiKey, openaiOrg, anthropicApiKey] = await Promise.all([
    env.USER_DATA.get(`user:${request.session.githubId}:openai-api-key`),
    env.USER_DATA.get(`user:${request.session.githubId}:openai-org`),
    env.USER_DATA.get(`user:${request.session.githubId}:anthropic-api-key`),
  ]);

  const completionSources: CompletionSourceMap = {};

  if (openaiApiKey) {
    const openaiClient = new OpenAI({ apiKey: openaiApiKey, organization: openaiOrg });
    completionSources.openai = new OpenAICompletionSource(openaiClient);
  }

  if (anthropicApiKey) {
    const anthropicClient = new Anthropic({ apiKey: anthropicApiKey });
    completionSources.anthropic = new AnthropicCompletionSource(anthropicClient);
  }

  // TODO: Figure out how to get this for free like everything else
  const completionManager = new CompletionManager(
    completionSources,
    request.database.chats,
    request.database.chatTurns,
    (book: string, name: string) => getTextbook(book, name, env, request.botOctokit),
  );

  request.completionManager = completionManager;
};

router
  .all('*', withUserData)
  .get<UserDataRequest>('/chat', async (req, env) => {
    const chats = await req.database.chats.getAll();
    return json(chats);
  })
  .get<UserDataRequest>('/chat/history', async (req, env) => {
    const chatHistoryItems = await Promise.all(
      (await req.database.chats.getAll()).map(async (chat) => {
        const currentTurn = chat.currentTurn ? await req.database.chatTurns.get(chat.currentTurn) : null;
        const rootTurn = currentTurn?.root ? await req.database.chatTurns.get(currentTurn.root) : null;

        return {
          id: chat.id,
          chat: chat,
          currentTurn,
          rootTurn,
        };
      }),
    );
    return json(chatHistoryItems);
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

    const { namespace, book, type, chapter, section } = parsedReference;

    if (type !== 'exercise' || !namespace || !book) {
      // For now...
      return json({ error: 'Reference type must be exercise' }, { status: 400 });
    }

    const textbookTextData = await getTextbook<TextChapter>(book, book, env, request.botOctokit);
    const textbookExercisesData = await getTextbook<ExercisesChapter>(book, `${book}-exercises`, env, request.botOctokit);
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

    const chat = await request.database.chats.create({
      reference: reference,
      provider: 'openai',
      // model: 'gpt-4',
      model: 'gpt-4-1106-preview',
    });

    return json(chat);
  })
  .get<UserDataRequest>('/chat/:chatId/turns-to/:turnId', async (request) => {
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
    const abortController = new AbortController();

    const pipeStream = async () => {
      await writer.write(encoder.encode(`event: start\n`));
      await writer.write(encoder.encode(`data: ${JSON.stringify(turn)}\n\n`));
      await writer.releaseLock();

      const generator = await request.completionManager.interactionCompletionGenerator(chat.id, turn.id, {
        maxTokens,
        signal: abortController.signal,
      });

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
  .get<UserDataRequest>('/reference', async (req, env) => {
    const references = await req.database.references.getAll();
    return json(references);
  })
  .get<UserDataRequest>('/reference/:id', async (req, env) => {
    let { id } = req.params;
    // Url decode id
    id = decodeURIComponent(id);
    let reference = await req.database.references.get(id);

    if (!reference) {
      // Naively we just create a new reference if it doesn't exist
      reference = await req.database.references.create({
        id,
      });
    }

    return json(reference);
  })
  .post<UserDataRequest>('/reference/:id/generate-suggestions', withCompletionManager, async (req, env) => {
    let { id } = req.params;
    // Url decode id
    id = decodeURIComponent(id);
    let reference = await req.database.references.get(id);

    if (!reference) {
      return json({ error: 'Reference not found' }, { status: 404 });
    }

    let suggestions;
    try {
      suggestions = await req.completionManager.generateReferenceSuggestions(reference.id);
    } catch (e) {
      console.error(e);
      return json({ error: 'Error generating suggestions' }, { status: 500 });
    }

    await req.database.references.update(reference.id, {
      questionSuggestions: suggestions,
    });

    return json(suggestions);
  })
  .get<UserDataRequest>('/flashcard', async (req, env) => {
    const flashcards = await req.database.flashcards.getAll();
    return json(flashcards);
  })
  .get<UserDataRequest>('/flashcard/:id', async (req, env) => {
    const { id } = req.params;
    const flashcard = await req.database.flashcards.get(id);

    if (!flashcard) {
      return json({ error: 'Flashcard not found' }, { status: 404 });
    }

    return json(flashcard);
  })
  .post<UserDataRequest>('/flashcard', async (req, env) => {
    const { type, reference, content } = await req.json<{
      type: Flashcard['type'];
      reference: Flashcard['reference'];
      content: Flashcard['content'];
    }>();

    const flashcard = await req.database.flashcards.create({
      type,
      reference,
      content,
    });

    return json(flashcard);
  })
  .patch<UserDataRequest>('/flashcard/:id', async (req, env) => {
    const { id } = req.params;
    const { type, reference, content, suspended, special, deleted } = await req.json<{
      type: Flashcard['type'];
      reference: Flashcard['reference'];
      content: Flashcard['content'];
      suspended: Flashcard['suspended'];
      special: Flashcard['special'];
      deleted: Flashcard['deleted'];
    }>();

    const flashcard = await req.database.flashcards.update(id, {
      type,
      reference,
      content,
      suspended,
      special,
      deleted,
    });

    return json(flashcard);
  })
  .get<UserDataRequest>('/document', async (req, env) => {
    const documents = await req.database.documents.getAll();
    return json(documents);
  })
  .get<UserDataRequest>('/document/:id', withAuthenticatedRequest, async (request, env) => {
    const { id } = request.params;
    const document = await request.database.documents.get(id);

    if (!document) {
      return json({ error: 'Document not found' }, { status: 404 });
    }

    return json(document);
  })
  .post<UserDataRequest>('/document/:id', withAuthenticatedRequest, async (request, env) => {
    // Note that we do specify the ID here and cells is always empty
    const { id } = request.params;
    const { title } = await request.json<{ title?: string }>();

    const document = await request.database.documents.create({
      id,
      title,
    });

    return json(document);
  })
  .patch<UserDataRequest>('/document/:id', withAuthenticatedRequest, async (request, env) => {
    const { id } = request.params;
    const {
      id: newId,
      title,
      reference,
      cells,
    } = await request.json<{ id?: string; title?: string; reference?: string; cells?: Array<UniqueID | null> }>();

    const currentDocument = await request.database.documents.get(id);

    if (!currentDocument) {
      return json({ error: 'Document not found' }, { status: 404 });
    }

    let document;
    if (newId && newId !== id) {
      const [newDocument] = await Promise.all([
        request.database.documents.set(newId, {
          createdAt: currentDocument.createdAt,
          updatedAt: new Date().toISOString(),
          title: title || currentDocument.title,
          reference: reference || currentDocument.reference,
          cells: cells || currentDocument.cells,
        }),
        request.database.documents.delete(id),
        Promise.all(
          currentDocument.cells.map((cellId) => {
            if (cellId) {
              return request.database.documentCells.update(cellId, {
                documentId: newId,
              });
            }
          }),
        ),
      ]);
      document = newDocument;
    } else {
      document = await request.database.documents.update(id, {
        title,
        reference,
        cells,
      });
    }

    return json(document);
  })
  .get<UserDataRequest>('/document/:documentId/cell/:cellId', withAuthenticatedRequest, async (request, env) => {
    const { documentId, cellId } = request.params;
    const cell = await request.database.documentCells.get(cellId);

    if (!cell) {
      return json({ error: 'Cell not found' }, { status: 404 });
    }

    return json(cell);
  })
  .post<UserDataRequest>('/document/:documentId/cell', withAuthenticatedRequest, async (request, env) => {
    const cellBody = await request.json<Omit<DocumentCell, 'documentId' | 'id'>>();

    const createdAt = new Date().toISOString();
    const cell = await request.database.documentCells.create({
      ...cellBody,
      documentId: request.params.documentId,
      createdAt,
      updatedAt: createdAt,
    });

    return json(cell);
  })
  .patch<UserDataRequest>('/document/:documentId/cell/:cellId', withAuthenticatedRequest, async (request, env) => {
    const { documentId, cellId } = request.params;
    const cellBody = await request.json<Omit<DocumentCell, 'documentId' | 'id'>>();

    const cell = await request.database.documentCells.update(cellId, {
      ...cellBody,
      documentId,
    });

    return json(cell);
  })
  .get<UserDataRequest>('/user', withAuthenticatedRequest, async (request, env: Env) => {
    if (!request.session.githubToken) {
      return json(
        { error: 'Unauthorized' },
        {
          status: 401,
        },
      );
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
  })
  .post<UserDataRequest>('/file', withAuthenticatedRequest, async (request, env: Env) => {
    // Get image from form data
    const formData = await request.formData();
    const file = formData.get('file') as unknown as File;
    const imageBuffer = await file.arrayBuffer();

    // Generate uuid for image
    const fileId = uuid();

    try {
      // Upload image to cloudflare r2
      await env.DOCUMENT_MEDIA.put(fileId, imageBuffer, {
        httpMetadata: {
          contentType: file.type,
          cacheControl: 'public, max-age=604800, immutable',
        },
      });
    } catch (e) {
      return json({ error: 'Error uploading file' }, { status: 500 });
    }

    // Return image url
    return json({ id: fileId });
  })
  .get<UserDataRequest>('/file/:filename+', withAuthenticatedRequest, async (request, env: Env) => {
    const { filename } = request.params;

    // Split filename into id and extension, and then just ignore the extension
    const [id] = filename.split('.');

    // Get image from cloudflare r2
    const file = await env.DOCUMENT_MEDIA.get(id);

    if (file === null) {
      return new Response('File not found', { status: 404 });
    }

    const headers = new Headers();
    file.writeHttpMetadata(headers);
    headers.set('etag', file.httpEtag);
    headers.set('cache-control', 'public, max-age=604800, immutable');

    return new Response(file.body, {
      headers,
    });
  })
  .post<AuthenticatedRequest>('/util/math-ocr', withAuthenticatedRequest, async (request, env: Env) => {
    // Get image from form data
    const requestFormData = await request.formData();
    const file = requestFormData.get('file') as unknown as File;

    const formData = new FormData();
    formData.append('file', file);

    // Add the options_json to the FormData object
    const optionsJson = {
      math_inline_delimiters: ['$', '$'],
      math_block_delimiters: ['$$', '$$'],
      rm_spaces: true,
    };
    formData.append('options_json', JSON.stringify(optionsJson));

    // Perform the fetch request
    const response = await fetch('https://api.mathpix.com/v3/text', {
      method: 'POST',
      headers: {
        app_id: env.MATHPIX_APP_ID,
        app_key: env.MATHPIX_APP_KEY,
      },
      body: formData,
    });

    // Parse the response
    const result = await response.json();

    // Return the result
    return new Response(JSON.stringify(result), {
      status: 200,
    });
  });
