import Anthropic, { HUMAN_PROMPT } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ChatAccess, ChatTurn, ChatTurnAccess } from './data';
import { renderExerciseChapterContext } from './textbook/context';
import { parseRef } from 'textref';
import { BaseChapter, ExercisesChapter, TextChapter } from './textbook/types';
// @ts-expect-error
import { EventEmitter } from 'node:events';

export interface CompletionOptions {
  maxTokens?: number;
  model?: string;
}

export interface CompletionUpdate {
  completion?: string;
  error?: string;
  id: string;
}

interface ChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
}

interface BaseCompletionSource<T extends string> {
  generateCompletion(messages: ChatMessage[], options?: CompletionOptions): AsyncGenerator<string>;
}

type OpenAIChatModel = OpenAI.Chat.Completions.CompletionCreateParams.CreateChatCompletionRequestStreaming['model'];

type AnthropicChatModel = Anthropic.CompletionCreateParams['model'];

const DEFAULT_OPENAI_MODEL: OpenAIChatModel = 'gpt-3.5-turbo';

const OPENAI_ROLE_MAPPING: Record<string, OpenAI.Chat.Completions.CreateChatCompletionRequestMessage['role']> = {
  user: 'user',
  model: 'assistant',
  system: 'system',
};

export class OpenAICompletionSource implements BaseCompletionSource<OpenAIChatModel> {
  constructor(private client: OpenAI) {}

  async *generateCompletion(messages: ChatMessage[], options?: CompletionOptions): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create({
      model: options?.model || DEFAULT_OPENAI_MODEL,
      // max_tokens: options?.maxTokens,
      messages: messages.map((message) => ({
        content: message.content,
        role: OPENAI_ROLE_MAPPING[message.role],
      })),
      logit_bias: {
        // " [["
        4416: 2,
        // " $"
        400: 2,
        // " $$"
        27199: 2,
      },
      stream: true,
    });

    for await (const part of stream) {
      const deltaContent = part.choices[0].delta.content;
      if (deltaContent) {
        yield deltaContent;
      }
    }
  }
}

const DEFAULT_ANTHROPIC_MODEL: AnthropicChatModel = 'claude-2';

const ANTHROPIC_ROLE_MAPPING: Record<string, string> = {
  user: 'Human',
  model: 'Assistant',
};

export class AnthropicCompletionSource implements BaseCompletionSource<AnthropicChatModel> {
  constructor(private client: Anthropic) {}

  async *generateCompletion(messages: ChatMessage[], options?: CompletionOptions): AsyncGenerator<string> {
    let prompt = '';
    // If first turn is "system", we just dump it into the prompt
    if (messages[0].role === 'system') {
      prompt += messages[0].content;
      messages = messages.slice(1);
    }
    for (const message of messages.slice(0, -1)) {
      if (message.role === 'system') {
        throw new Error('System messages can only be the first message');
      }
      prompt += `${ANTHROPIC_ROLE_MAPPING[message.role]}: ${message.content}\n\n`;
    }
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
      throw new Error('Last message must be from the user');
    }
    prompt += `${ANTHROPIC_ROLE_MAPPING[lastMessage.role]}: ${lastMessage.content}${ANTHROPIC_ROLE_MAPPING['model']}:`;

    const completionParams = {
      prompt,
      stop_sequences: [HUMAN_PROMPT],
      max_tokens_to_sample: options?.maxTokens || 2000,
      model: options?.model || DEFAULT_ANTHROPIC_MODEL,
    };
    const stream = await this.client.completions.create({
      ...completionParams,
      stream: true,
    });

    for await (const part of stream) {
      const deltaContent = part.completion;
      // Update turn with completion
      if (deltaContent) {
        yield deltaContent;
      }
    }
  }
}

type CompletionSourceMapping = {
  openai: OpenAICompletionSource;
  anthropic: AnthropicCompletionSource;
};

export type CompletionSourceMap = Partial<{
  [K in keyof CompletionSourceMapping]: CompletionSourceMapping[K];
}>;

export class CompletionManager {
  broadcasts: Map<string, EventEmitter>;

  constructor(
    private completionSources: CompletionSourceMap,
    private chats: ChatAccess,
    private chatTurns: ChatTurnAccess,
    private getTextbookFn: <T extends BaseChapter>(textbook: string) => Promise<Record<string, T>>
  ) {
    this.broadcasts = new Map();
  }

  getCompletionBroadcast(id: string) {
    return this.broadcasts.get(id) || null;
  }

  // createCompletionBroadcast(turnId: string) {
  //   if (this.broadcasts.has(turnId)) {
  //     throw new Error('Broadcast already exists');
  //   }

  //   const emitter = new EventEmitter();
  //   this.broadcasts.set(turnId, emitter);
  //   return emitter;
  // }

  async startCompletion(chatId: string, turnId: string, options?: CompletionOptions) {
    if (!this.broadcasts.has(turnId)) {
      throw new Error('No broadcast found');
    }

    await this.completionGenerator(chatId, turnId, options);
  }

  removeBroadcast(turnId: string) {
    if (this.broadcasts.has(turnId)) {
      this.broadcasts.delete(turnId);
    }
  }

  async *completionGenerator(chatId: string, turnId: string, options?: CompletionOptions) {
    // const emitter = this.broadcasts.get(turnId);

    // if (!emitter) {
    //   throw new Error('No broadcast found');
    // }

    const turn = await this.chatTurns.get(turnId);

    if (!turn) {
      throw new Error('Turn not found');
    }

    const chat = await this.chats.get(chatId);

    if (!chat) {
      throw new Error('Chat not found');
    }

    const reference = chat?.reference;

    if (!reference) {
      throw new Error("Chat has no reference; can't create context");
    }

    // Parse reference string
    const parsedReference = parseRef(reference, { partial: true });

    // TODO: This should really all be validated when a chat is created, not
    // when coming up with a completion
    if (!parsedReference || !('type' in parsedReference) || parsedReference.chapter === undefined) {
      throw new Error('Invalid reference');
    }

    const { type, chapter, section } = parsedReference;

    if (type !== 'exercise') {
      throw new Error('Invalid reference type');
    }

    const textbookTextData = await this.getTextbookFn<TextChapter>('v1');
    const textbookExercisesData = await this.getTextbookFn<ExercisesChapter>('v1-exercises');
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
      throw new Error('Exercise not found');
    }
    const context = renderExerciseChapterContext(sectionId, exercise, chapterTextData);

    let turnHistory: ChatTurn[] = [];
    if (turnId) {
      turnHistory = await this.chatTurns.getTurnsTo(turnId);
    }

    const flattenedTurnHistory: ChatMessage[] = turnHistory
      .map((turn) => {
        return [
          {
            role: 'user' as ChatMessage['role'],
            content: turn.query,
          },
          ...(turn.response
            ? [
                {
                  role: 'model' as ChatMessage['role'],
                  content: turn.response,
                },
              ]
            : []),
        ];
      })
      .reduce((acc, val) => acc.concat(val), []);

    const messages: ChatMessage[] = [
      {
        role: 'system' as ChatMessage['role'],
        content: context,
      },
      ...flattenedTurnHistory,
    ];

    const completionSource = this.completionSources[chat.provider];

    if (!completionSource) {
      throw new Error('Invalid completion source');
    }

    const generator = completionSource.generateCompletion(messages, {
      ...options,
      model: chat.model,
    });

    let text = '';

    for await (const delta of generator) {
      yield { completion: delta };

      // Update turn with completion
      text += delta;
      await this.chatTurns.updateStreamingTurn(turn.id, text);
    }

    await this.chatTurns.finishTurn(turn.id, { response: text });
    // emitter.emit('end');

    // this.removeBroadcast(turnId);
  }
}
