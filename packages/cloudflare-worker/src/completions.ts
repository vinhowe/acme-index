import Anthropic, { HUMAN_PROMPT } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { parseRef } from 'textref';
// @ts-expect-error
import { EventEmitter } from 'node:events';
import {
  BaseChapter,
  BodyItem,
  BodyItemWithReference,
  ChatTurn,
  ExercisesChapter,
  SectionItem,
  StructuredChatResponse,
  TextChapter,
  renderExerciseHelpContext,
  renderReferenceSuggestionsContext,
} from '@acme-index/common';
import { ChatAccess, ChatTurnAccess } from './data';
import { Tiktoken, TiktokenModel, encodingForModel } from 'js-tiktoken';
import claude from './claude.json';
import { ChatCompletionChunk, ChatCompletionMessage } from 'openai/resources/chat';

export interface CompletionOptions {
  maxTokens?: number;
  model?: string;
  functions?: OpenAI.Chat.Completions.CompletionCreateParams['functions'];
  function_call?: OpenAI.Chat.Completions.CompletionCreateParams['function_call'];
  signal?: AbortSignal;
}

export interface CompletionUpdate {
  completion?: string;
  error?: string;
  id: string;
}

interface ChatMessageFunctionCall {
  arguments: string;
  name: string;
}

interface ChatMessage {
  role: 'user' | 'model' | 'tool' | 'system';
  content: string | null;
  function_call?: ChatMessageFunctionCall;
}

interface BaseCompletionSource<T extends string> {
  generateCompletion(messages: ChatMessage[], options?: CompletionOptions): AsyncGenerator<string>;
  calculateTokenCount(messages: ChatMessage[], model?: string): Promise<number>;
}

type OpenAIChatModel = OpenAI.Chat.Completions.CompletionCreateParams.CompletionCreateParamsStreaming['model'];

type AnthropicChatModel = Anthropic.CompletionCreateParams['model'];

const DEFAULT_OPENAI_MODEL: OpenAIChatModel = 'gpt-3.5-turbo';

const OPENAI_ROLE_MAPPING: Record<string, OpenAI.Chat.Completions.CreateChatCompletionRequestMessage['role']> = {
  user: 'user',
  model: 'assistant',
  tool: 'function',
  system: 'system',
};

const AVAILABLE_FUNCTIONS = [
  {
    name: 'create_basic_flashcard',
    description: 'Create a basic flashcard with a front and a back',
    parameters: {
      type: 'object',
      properties: {
        front: {
          type: 'string',
          description: 'The content for the front of the flashcard',
        },
        back: {
          type: 'string',
          description: 'The content for the back of the flashcard',
        },
        reference: {
          type: 'string',
          description: 'Optional reference for the flashcard',
        },
      },
      required: ['front', 'back'],
    },
  },
  {
    name: 'create_worked_flashcard',
    description:
      'Create a worked problem flashcard with a series of steps to solve a problem. This format is more suited for homework-style problems than facts.',
    parameters: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              context: {
                type: 'string',
                description:
                  'This is a mental cue for the user to help them recall `content`, which is hidden until the user reveals it. This should only be enough information to help the user, not enough to solve the problem on its own.',
              },
              content: {
                type: 'string',
                description:
                  'One of the steps to solve the problem (or build up to a concept). Steps are hidden until the user reveals them, one at a time, in order. They should be statements, mathematical or otherwise, and not questions or otherwise open-ended.',
              },
            },
            required: ['content'],
          },
          description: 'A list of steps, each with optional context and a question',
        },
        reference: {
          type: 'string',
          description: 'Optional reference for the flashcard',
        },
      },
      required: ['steps'],
    },
  },
  {
    name: 'create_basic_flashcards',
    description: 'Create multiple basic flashcards, each with a front and a back',
    parameters: {
      type: 'object',
      properties: {
        cards: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              front: {
                type: 'string',
                description: 'The content for the front of the flashcard',
              },
              back: {
                type: 'string',
                description: 'The content for the back of the flashcard',
              },
              reference: {
                type: 'string',
                description: 'Optional reference for the flashcard (MUST BE IN FORMAT `acme:v1/result/1.2.3`)',
              },
            },
            required: ['front', 'back'],
          },
          description: 'An array of objects, each representing a basic flashcard',
        },
      },
      required: ['cards'],
    },
  },
  {
    name: 'create_worked_flashcards',
    description:
      'Create multiple worked problem flashcards, each with a series of steps to solve a problem. This format is more suited for homework-style problems than facts.',
    parameters: {
      type: 'object',
      properties: {
        cards: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              steps: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    context: {
                      type: 'string',
                      description:
                        'This is a mental cue for the user to help them recall `content`, which is hidden until the user reveals it. This should only be enough information to help the user, not enough to solve the problem on its own.',
                    },
                    content: {
                      type: 'string',
                      description:
                        'One of the steps to solve the problem (or build up to a concept). Steps are hidden until the user reveals them, one at a time, in order. They should be statements, mathematical or otherwise, and not questions or otherwise open-ended.',
                    },
                  },
                  required: ['content'],
                },
                description: 'A list of steps, each with optional context and content, for the flashcard',
              },
              reference: {
                type: 'string',
                description: 'Optional reference for the flashcard (MUST BE IN FORMAT `acme:v1/result/1.2.3`)',
              },
            },
            required: ['steps'],
          },
          description: 'An array of objects, each representing a worked problem flashcard',
        },
      },
      required: ['cards'],
    },
  },
];

export class OpenAICompletionSource implements BaseCompletionSource<OpenAIChatModel> {
  constructor(private client: OpenAI) {}

  async *generateCompletion(messages: ChatMessage[], options?: CompletionOptions): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create(
      {
        model: options?.model || DEFAULT_OPENAI_MODEL,
        // max_tokens: options?.maxTokens,
        messages: messages.map((message) => ({
          content: message.content || '',
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
      },
      {
        signal: options?.signal,
      },
    );

    for await (const part of stream) {
      const deltaContent = part.choices[0].delta.content;
      if (deltaContent) {
        yield deltaContent;
      }
    }
  }

  async generateFunctionCallingCompletion(
    messages: ChatMessage[],
    options?: CompletionOptions,
  ): Promise<ChatCompletionMessage.FunctionCall | null> {
    const mappedMessages = messages.map((message) => ({
      content: message.function_call
        ? 'User was shown the output of this operation and had the opportunity to act on it.'
        : message.content,
      name: message.function_call?.name,
      role: OPENAI_ROLE_MAPPING[message.role],
    }));
    const response = await this.client.chat.completions.create(
      {
        model: options?.model || DEFAULT_OPENAI_MODEL,
        // max_tokens: options?.maxTokens,
        messages: mappedMessages,
        logit_bias: {
          // " [["
          4416: 2,
          // " $"
          400: 2,
        },
        stream: false,
        functions: options?.functions,
        function_call: options?.function_call,
      },
      {
        signal: options?.signal,
      },
    );

    if (response.choices[0].message.function_call) {
      return response.choices[0].message.function_call;
    }

    return null;
  }

  async *generateStreamingFunctionCallingCompletion(
    messages: ChatMessage[],
    options?: CompletionOptions,
  ): AsyncGenerator<ChatCompletionChunk.Choice.Delta | null> {
    const mappedMessages = messages.map((message) => ({
      content: message.function_call ? message.function_call.arguments : message.content,
      name: message.function_call?.name,
      role: OPENAI_ROLE_MAPPING[message.role],
    }));
    const stream = await this.client.chat.completions.create(
      {
        model: options?.model || DEFAULT_OPENAI_MODEL,
        // max_tokens: options?.maxTokens,
        messages: mappedMessages,
        logit_bias: {
          // " [["
          4416: 2,
          // " $"
          400: 2,
          // " $$"
          27199: 2,
        },
        stream: true,
        functions: options?.functions,
        function_call: options?.function_call,
      },
      {
        signal: options?.signal,
      },
    );

    for await (const part of stream) {
      const deltaContent = part.choices[0].delta;
      if (deltaContent) {
        yield deltaContent;
      }
    }
    // Trying to get the last token through
    yield {};
    yield {};
  }

  async calculateTokenCount(messages: ChatMessage[], model: OpenAIChatModel = DEFAULT_OPENAI_MODEL) {
    const text = messages
      .map((message) => {
        return `<|im_start|>${OPENAI_ROLE_MAPPING[message.role]}\n${message.content}<|im_end|>`;
      })
      .join('\n');
    const tiktoken = await encodingForModel(model as TiktokenModel);
    const tokens = await tiktoken.encode(text);
    return tokens.length;
  }
}

const DEFAULT_ANTHROPIC_MODEL: AnthropicChatModel = 'claude-2';

const ANTHROPIC_ROLE_MAPPING: Record<string, string> = {
  user: 'Human',
  model: 'Assistant',
};

export class AnthropicCompletionSource implements BaseCompletionSource<AnthropicChatModel> {
  constructor(private client: Anthropic) {}

  private constructConversationPrompt(messages: ChatMessage[]): string {
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
    return prompt;
  }

  async *generateCompletion(messages: ChatMessage[], options?: CompletionOptions): AsyncGenerator<string> {
    const prompt = this.constructConversationPrompt(messages);

    const completionParams = {
      prompt,
      stop_sequences: [HUMAN_PROMPT],
      max_tokens_to_sample: options?.maxTokens || 2000,
      model: options?.model || DEFAULT_ANTHROPIC_MODEL,
    };
    const stream = await this.client.completions.create(
      {
        ...completionParams,
        stream: true,
      },
      {
        signal: options?.signal,
      },
    );

    for await (const part of stream) {
      const deltaContent = part.completion;
      // Update turn with completion
      if (deltaContent) {
        yield deltaContent;
      }
    }
  }

  async calculateTokenCount(messages: ChatMessage[], _model: AnthropicChatModel = DEFAULT_ANTHROPIC_MODEL) {
    const text = this.constructConversationPrompt(messages);
    const tiktoken = new Tiktoken(claude);
    const tokens = await tiktoken.encode(text);
    return tokens.length;
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
    private getTextbookFn: <T extends BaseChapter>(book: string, textbookName: string) => Promise<Record<string, T>>,
  ) {
    this.broadcasts = new Map();
  }

  async startInteractionCompletion(chatId: string, turnId: string, options?: CompletionOptions) {
    if (!this.broadcasts.has(turnId)) {
      throw new Error('No broadcast found');
    }

    await this.interactionCompletionGenerator(chatId, turnId, options);
  }

  removeBroadcast(turnId: string) {
    if (this.broadcasts.has(turnId)) {
      this.broadcasts.delete(turnId);
    }
  }

  async *interactionCompletionGenerator(chatId: string, turnId: string, options?: CompletionOptions) {
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

    const { namespace, book, type, chapter, section } = parsedReference;

    if (type !== 'exercise' || !namespace || !book) {
      throw new Error('Invalid reference type');
    }

    const textbookTextData = await this.getTextbookFn<TextChapter>(book, book);
    const textbookExercisesData = await this.getTextbookFn<ExercisesChapter>(book, `${book}-exercises`);
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
    const context = renderExerciseHelpContext(namespace, book, sectionId, exercise, chapterTextData);

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
            ? typeof turn.response === 'string'
              ? [
                  {
                    role: 'model' as ChatMessage['role'],
                    content: turn.response,
                  },
                ]
              : turn.response.map((response) => ({
                  role: (response.type === 'function_call' ? 'tool' : 'model') as ChatMessage['role'],
                  content: 'content' in response ? response?.content : null,
                  function_call:
                    response.type === 'function_call'
                      ? { arguments: (response as ChatMessageFunctionCall).arguments, name: (response as ChatMessageFunctionCall).name }
                      : undefined,
                }))
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

    let text = turn.response || [];
    let eventCount = 0;

    // if completionSource is not openai, throw error for now
    if (chat.provider !== 'openai') {
      throw new Error('Invalid completion source');
    }

    const generator = (completionSource as OpenAICompletionSource).generateStreamingFunctionCallingCompletion(messages, {
      ...options,
      model: chat.model,
      functions: AVAILABLE_FUNCTIONS,
    });

    let completingChunk: Partial<StructuredChatResponse> | null = null;

    for await (const delta of generator) {
      if (!completingChunk || (completingChunk.type === 'function_call') !== (delta?.function_call !== undefined)) {
        if (delta?.function_call) {
          completingChunk = {
            type: 'function_call',
            name: delta?.function_call?.name,
            arguments: delta?.function_call?.arguments || '',
          };
          text.push(completingChunk);
        } else {
          // TODO: This is bad
          if (delta?.content || delta?.role) {
            completingChunk = {
              type: 'completion',
              content: delta?.content || '',
            };
            text.push(completingChunk);
          }
        }
      }

      // Update turn with completion
      if (delta?.function_call) {
        if (!completingChunk || completingChunk.type !== 'function_call') {
          throw new Error('Invalid completion chunk');
        }
        if (delta?.function_call?.name) {
          completingChunk.name = delta?.function_call?.name;
        } else if (delta?.function_call?.arguments) {
          completingChunk.arguments += delta?.function_call?.arguments;
        }
      } else {
        if (!completingChunk || completingChunk.type !== 'completion') {
          throw new Error('Invalid completion chunk');
        }
        completingChunk.content += delta?.content || '';
      }

      // This reduces the number of write operations we do (which can get expensive)
      // if (eventCount % 10 === 0 || Object.entries(delta || {}).length === 0) {
      this.chatTurns.updateStreamingTurn(turn.id, text as StructuredChatResponse[]);
      // }
      eventCount += 1;

      yield { completion: delta };
    }

    const messagesWithCompletion: ChatMessage[] = [
      ...messages,
      ...text.map((chunk) =>
        chunk.type === 'function_call'
          ? {
              role: 'tool' as ChatMessage['role'],
              content: null,
              function_call: {
                name: chunk.name,
                arguments: chunk.arguments,
              } as ChatMessageFunctionCall,
            }
          : {
              role: 'model' as ChatMessage['role'],
              content: chunk.type === 'completion' ? chunk.content ?? null : null,
            },
      ),
    ];

    const tokenCount = await completionSource.calculateTokenCount(messagesWithCompletion);

    yield { tokenCount };

    await this.chatTurns.finishTurn(turn.id, { response: text as StructuredChatResponse[], tokenCount });
  }

  async generateReferenceSuggestions(reference: string) {
    // Parse reference string
    const parsedReference = parseRef(reference, { partial: true });

    // TODO: This should really all be validated when a chat is created, not
    // when coming up with a completion
    if (!parsedReference || !('type' in parsedReference) || parsedReference.chapter === undefined) {
      throw new Error('Invalid reference');
    }

    const { namespace, book, type, chapter, section } = parsedReference;

    if (!namespace || !book || !section) {
      throw new Error('Invalid reference type');
    }

    const textbookTextData = await this.getTextbookFn<TextChapter>(book, book);
    const chapterTextData = textbookTextData[chapter];
    if (!chapterTextData) {
      throw new Error('Chapter not found');
    }

    let item: BodyItem | SectionItem | TextChapter | null = null;
    if (type === 'exercise') {
      const textbookExercisesData = await this.getTextbookFn<ExercisesChapter>(book, `${book}-exercises`);
      const chapterExercisesData = textbookExercisesData[chapter];
      if (!chapterExercisesData) {
        throw new Error('Chapter not found');
      }
      // Find exercise in chapter (section doesn't mean chapter section)
      item = CompletionManager.findChildByReference(chapterExercisesData, reference);
    } else {
      item = CompletionManager.findChildByReference(chapterTextData, reference);
    }

    if (!item) {
      throw new Error('Item not found');
    }

    const context = renderReferenceSuggestionsContext(namespace, book, section, item as BodyItemWithReference, chapterTextData);

    // Hardcoding this for now
    const completionSource = this.completionSources['openai'];

    if (!completionSource) {
      throw new Error('Invalid completion source');
    }

    // Set up function calling
    const functions = [
      {
        name: 'submit_suggestions',
        description: 'Submit query suggestions for a reference',
        parameters: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
          required: ['suggestions'],
        },
      },
    ];

    const response = await completionSource.generateFunctionCallingCompletion(
      [
        {
          role: 'system',
          content: context,
        },
      ],
      {
        functions,
        function_call: { name: 'submit_suggestions' },
      },
    );

    if (response === null) {
      return null;
    }

    try {
      const functionResponse = JSON.parse(response.arguments);
      if (functionResponse.suggestions) {
        return functionResponse.suggestions;
      }
    } catch (e) {
      console.error('Error while attempting to parse suggestions');
      console.error(e);
      // Do nothing
    }
    return null;
  }

  private static findChildByReference(
    root: BodyItem | SectionItem | TextChapter,
    targetReference: string,
  ): BodyItem | SectionItem | TextChapter | null {
    // Check if the current item's reference matches the target reference
    if ('reference' in root && root.reference === targetReference) {
      return root;
    }

    if ('body' in root && root.body) {
      for (let child of root.body) {
        if (typeof child === 'string' || child.type === 'text') {
          continue;
        }
        let result = this.findChildByReference(child as BodyItem | SectionItem | TextChapter, targetReference);
        if (result) {
          return result;
        }
      }
    }

    if ('sections' in root && root.sections) {
      for (let child of root.sections) {
        if (typeof child === 'string') {
          continue;
        }
        let result = this.findChildByReference(child as BodyItem | SectionItem | TextChapter, targetReference);
        if (result) {
          return result;
        }
      }
    }

    // If we've gone through all children and haven't found the target reference, return null
    return null;
  }
}
