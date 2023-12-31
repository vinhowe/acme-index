import {
  Chat,
  ChatTurn,
  Document,
  DocumentCell,
  Flashcard,
  History,
  Reference,
  StructuredChatResponse,
  UniqueID,
  UniqueObject,
} from '@acme-index/common';
import { v4 as uuid } from 'uuid';

export type CreateChatTurnBody = Pick<ChatTurn, 'chatId' | 'parent' | 'additionalContextReferences' | 'query' | 'response' | 'error'>;

export interface ObjectTable<T extends UniqueObject> {
  get(id: string): Promise<T | null>;
  getAll(): Promise<T[]>;
}

export type MutableObjectTable<T extends UniqueObject> = ObjectTable<T> & {
  set(id: string, value: Omit<T, keyof UniqueObject>): Promise<T>;
  create(value: Omit<T, keyof UniqueObject>): Promise<T>;
  delete(id: string): Promise<void>;
};

export interface Database {
  chats: ChatAccess;
  chatTurns: ChatTurnAccess;
  documents: DocumentAccess;
  documentCells: DocumentCellAccess;
  references: ReferenceAccess;
  flashcards: FlashcardAccess;
}

export class HistoryAccess implements MutableObjectTable<History> {
  constructor(private table: MutableObjectTable<History>) {
    this.table = table;
  }

  async get(id: string): Promise<History | null> {
    return this.table.get(id);
  }

  async getAll(): Promise<History[]> {
    return this.table.getAll();
  }

  async set(id: string, value: Omit<History, keyof UniqueObject>): Promise<History> {
    return this.table.set(id, value);
  }

  async create(): Promise<History> {
    return this.table.create({ chats: [] });
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id);
  }
}

export class ReferenceAccess implements ObjectTable<Reference> {
  constructor(private table: MutableObjectTable<Reference>) {
    this.table = table;
  }

  private escapeId(id: string) {
    // We can't have dots in the KV key
    // (https://developers.cloudflare.com/kv/api/write-key-value-pairs/#parameters)
    // so we replace them with backticks, which seem uncommon enough to never
    // end up in the reference format.
    return id.replace('.', '`');
  }

  private unescapeId(id: string) {
    return id.replace('`', '.');
  }

  async get(id: string): Promise<Reference | null> {
    return this.table.get(this.escapeId(id));
  }
  async getAll(): Promise<Reference[]> {
    return this.table.getAll();
  }
  async set(id: string, value: Omit<Reference, 'id'>): Promise<Reference> {
    return this.table.set(this.escapeId(id), value);
  }
  async create(value: Omit<Reference, 'questionSuggestions' | 'createdAt' | 'updatedAt' | 'chats'>): Promise<Reference> {
    const createdAt = new Date().toISOString();
    return this.table.set(this.escapeId(value.id), {
      ...value,
      chats: [],
      createdAt,
      updatedAt: createdAt,
    });
  }
  async delete(id: string): Promise<void> {
    return this.table.delete(this.escapeId(id));
  }

  async update(id: string, value: Partial<Omit<Reference, 'id'>>): Promise<Reference> {
    const reference = await this.get(this.escapeId(id));
    if (!reference) {
      throw new Error('Reference not found');
    }
    const filteredValue: Partial<Reference> = Object.fromEntries(Object.entries(value).filter(([_, v]) => v !== undefined));
    return this.table.set(this.escapeId(id), {
      ...reference,
      ...filteredValue,
    });
  }
}

export class DocumentCellAccess implements ObjectTable<DocumentCell> {
  constructor(private table: MutableObjectTable<DocumentCell>) {
    this.table = table;
  }

  async get(id: string): Promise<DocumentCell | null> {
    return this.table.get(id);
  }

  async getAll(): Promise<DocumentCell[]> {
    return this.table.getAll();
  }

  async set(id: string, value: Omit<DocumentCell, keyof UniqueObject>): Promise<DocumentCell> {
    return this.table.set(id, value);
  }

  async create(value: Omit<DocumentCell, keyof UniqueObject | 'hidden'> & Partial<Pick<DocumentCell, 'hidden'>>): Promise<DocumentCell> {
    const createdAt = new Date().toISOString();
    return this.table.set(uuid(), {
      hidden: false,
      ...value,
      createdAt,
      updatedAt: createdAt,
    });
  }

  async update(id: string, value: Partial<Omit<DocumentCell, keyof UniqueObject | 'updatedAt'>>): Promise<DocumentCell> {
    const cell = await this.get(id);
    if (!cell) {
      throw new Error('Cell not found');
    }
    const filteredValue: Partial<DocumentCell> = Object.fromEntries(Object.entries(value).filter(([_, v]) => v !== undefined));
    return this.table.set(id, {
      ...cell,
      ...filteredValue,
      updatedAt: new Date().toISOString(),
    });
  }
}

export class DocumentAccess implements ObjectTable<Document> {
  constructor(private table: MutableObjectTable<Document>) {
    this.table = table;
  }

  async get(id: string): Promise<Document | null> {
    return this.table.get(id);
  }

  async getAll(): Promise<Document[]> {
    return this.table.getAll();
  }

  async set(id: string, value: Omit<Document, keyof UniqueObject>): Promise<Document> {
    return this.table.set(id, value);
  }

  async create(value: Pick<Document, 'id' | 'title' | 'reference'>): Promise<Document> {
    const createdAt = new Date().toISOString();
    return this.table.set(value.id, {
      ...value,
      cells: [],
      createdAt,
      updatedAt: createdAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id);
  }

  async update(id: string, value: Partial<Omit<Document, keyof UniqueObject | 'createdAt' | 'updatedAt'>>): Promise<Document> {
    const document = await this.get(id);
    if (!document) {
      throw new Error('Document not found');
    }
    const filteredValue: Partial<Document> = Object.fromEntries(Object.entries(value).filter(([_, v]) => v !== undefined));
    if (filteredValue.cells !== undefined) {
      if (document.deletedCells !== undefined) {
        // Remove restored cells from deleted cells
        document.deletedCells = document.deletedCells.filter((cell) => !filteredValue.cells?.includes(cell));
      }
      // Find deleted cells
      const cellsDeletedByUpdate = document.cells.filter((cell) => cell !== null && !filteredValue.cells?.includes(cell)) as UniqueID[];
      document.deletedCells = [...(document.deletedCells || []), ...cellsDeletedByUpdate];
    }
    return this.table.set(id, {
      ...document,
      ...filteredValue,
      updatedAt: new Date().toISOString(),
    });
  }
}

export class FlashcardAccess implements ObjectTable<Flashcard> {
  constructor(private table: MutableObjectTable<Flashcard>) {
    this.table = table;
  }

  async get(id: string): Promise<Flashcard | null> {
    return this.table.get(id);
  }

  async getAll(): Promise<Flashcard[]> {
    return this.table.getAll();
  }

  async set(id: string, value: Omit<Flashcard, keyof UniqueObject>): Promise<Flashcard> {
    return this.table.set(id, value);
  }

  async create(value: Pick<Flashcard, 'type' | 'reference' | 'content'>): Promise<Flashcard> {
    const createdAt = new Date().toISOString();
    return this.table.create({
      ...value,
      deleted: false,
      suspended: false,
      special: false,
      createdAt,
      updatedAt: createdAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id);
  }

  async update(id: string, value: Partial<Omit<Flashcard, keyof UniqueObject | 'createdAt' | 'updatedAt'>>): Promise<Flashcard> {
    const cell = await this.get(id);
    if (!cell) {
      throw new Error('Cell not found');
    }
    const filteredValue: Partial<Flashcard> = Object.fromEntries(Object.entries(value).filter(([_, v]) => v !== undefined));
    return this.table.set(id, {
      ...cell,
      ...filteredValue,
      updatedAt: new Date().toISOString(),
    });
  }
}

export class ChatAccess implements ObjectTable<Chat> {
  constructor(private table: MutableObjectTable<Chat>) {
    this.table = table;
  }

  async get(id: string): Promise<Chat | null> {
    return this.table.get(id);
  }

  async getAll(): Promise<Chat[]> {
    return this.table.getAll();
  }

  async create(body: Pick<Chat, 'reference' | 'provider' | 'model'>): Promise<Chat> {
    if (!body.reference) {
      throw new Error('Chat must have reference');
    }

    if (!body.model) {
      throw new Error('Chat must have model');
    }

    const createdAt = new Date().toISOString();
    const chat = await this.table.create({
      reference: body.reference,
      provider: body.provider,
      model: body.model,
      rootTurns: [],
      currentTurn: null,
      createdAt,
      updatedAt: createdAt,
    });
    return chat;
  }

  async addRootTurn(chatId: string, turnId: string): Promise<void> {
    const chat = await this.get(chatId);
    if (!chat) {
      throw new Error('Chat not found');
    }
    chat.rootTurns.push(turnId);
    await this.table.set(chatId, chat);
  }

  async updateCurrentTurn(chatId: string, turnId: string): Promise<void> {
    const chat = await this.get(chatId);
    if (!chat) {
      throw new Error('Chat not found');
    }
    chat.currentTurn = turnId;
    chat.updatedAt = new Date().toISOString();
    await this.table.set(chatId, chat);
  }
}

export class ChatTurnAccess implements ObjectTable<ChatTurn> {
  constructor(
    private table: MutableObjectTable<ChatTurn>,
    private chats: ChatAccess,
  ) {
    this.table = table;
    this.chats = chats;
  }

  async get(id: string): Promise<ChatTurn | null> {
    return this.table.get(id);
  }

  async getAll(): Promise<ChatTurn[]> {
    return this.table.getAll();
  }

  async getTurnsTo(id: string) {
    const turn = await this.get(id);
    if (!turn) {
      throw new Error('Turn not found');
    }
    let currentTurn = turn;
    const turns: ChatTurn[] = [currentTurn];
    while (currentTurn.parent) {
      const parent = await this.get(currentTurn.parent);
      if (!parent) {
        throw new Error('Parent not found');
      }
      turns.unshift(parent);
      currentTurn = parent;
    }
    return turns;
  }

  async addTurn(body: CreateChatTurnBody): Promise<ChatTurn> {
    const chat = await this.chats.get(body.chatId);
    if (!chat) {
      throw new Error('Chat not found');
    }

    const turn = body as Omit<ChatTurn, keyof UniqueID | 'createdAt'>;

    if (!turn.query) {
      throw new Error('Turn must have query');
    }

    let parent;

    if (turn.parent) {
      parent = await this.get(turn.parent);
      if (!parent) {
        throw new Error('Turn parent not found');
      }
      if (parent.error) {
        throw new Error("Can't add turn to parent with error");
      }
      turn.parents = [parent.id, ...(parent.parents || [])];
      turn.root = parent.root || parent.id;
    }

    const tableTurn = await this.table.create({
      ...turn,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    if (parent) {
      parent.child = tableTurn.id;
      await this.table.set(parent.id, parent);
    } else {
      await this.chats.addRootTurn(chat.id, tableTurn.id);
    }

    await this.chats.updateCurrentTurn(chat.id, tableTurn.id);

    return tableTurn;
  }

  async finishTurn(id: string, body: Pick<ChatTurn, 'response' | 'error'> & Partial<Pick<ChatTurn, 'tokenCount'>>) {
    const turn = await this.get(id);
    if (!turn) {
      throw new Error('Turn not found');
    }
    if (turn.status === 'finished') {
      throw new Error('Turn already finished');
    }
    if (!body.response && !body.error) {
      throw new Error('Must provide response or error');
    }
    if (body.response && body.error) {
      throw new Error("Can't provide both response and error");
    }
    if (body.response) {
      turn.response = body.response;
      turn.status = 'finished';
      if (body.tokenCount) {
        turn.tokenCount = body.tokenCount;
      }
    }
    if (body.error) {
      turn.error = body.error;
      turn.status = 'error';
    }
    await this.table.set(id, turn);
  }

  async updateStreamingTurn(id: UniqueID, updatedResponse: string | StructuredChatResponse[]) {
    const turn = await this.get(id);
    if (!turn) {
      throw new Error('Turn not found');
    }
    turn.response = updatedResponse;
    await this.table.set(id, turn);
  }
}

export class KVObjectTable<T extends UniqueObject = any & UniqueObject> implements MutableObjectTable<T> {
  constructor(
    private kv: KVNamespace,
    private prefix: string,
  ) {}

  async get(id: string): Promise<T | null> {
    const value = await this.kv.get<T>(`${this.prefix}:${id}`, 'json');
    if (!value) {
      return null;
    }
    return value;
  }

  async getAll(): Promise<T[]> {
    const keys = await this.kv.list({ prefix: this.prefix });
    const values = await Promise.all(keys.keys.map((key) => this.kv.get<T>(key.name, 'json')));
    return values.filter((value) => value !== null) as T[];
  }

  async set(id: string, value: Omit<T, keyof UniqueObject>): Promise<T> {
    const body = { id, ...value } as T;
    await this.kv.put(`${this.prefix}:${id}`, JSON.stringify(body));
    return body;
  }

  async create(value: Omit<T, keyof UniqueObject>): Promise<T> {
    const id = uuid();
    const body = { ...value, id } as T;
    await this.set(id, body);
    return body;
  }

  async delete(id: string): Promise<void> {
    await this.kv.delete(`${this.prefix}:${id}`);
  }
}

export class InMemoryObjectTable<T extends UniqueObject = any & UniqueObject> implements MutableObjectTable<T> {
  table: { [key: string]: any } = {};

  constructor(data?: { [key: string]: any }) {
    this.table = data || {};
  }

  async get(id: string): Promise<T | null> {
    return this.table[id];
  }

  async getAll(): Promise<T[]> {
    return Object.values(this.table);
  }

  async set(id: string, value: Omit<T, keyof UniqueObject>): Promise<T> {
    const body = { ...value, id } as T;
    this.table[id] = value;
    return body;
  }

  async create(value: Omit<T, keyof UniqueObject>): Promise<T> {
    const id = uuid();
    const body = { ...value, id } as T;
    await this.set(id, body);
    return body;
  }

  async delete(id: string): Promise<void> {
    delete this.table[id];
  }
}

export class CachedObjectTable<T extends UniqueObject = any & UniqueObject> implements MutableObjectTable<T> {
  private cache: { [key: string]: T } = {};

  constructor(private table: MutableObjectTable<T>) {}

  async get(id: string): Promise<T | null> {
    if (this.cache[id]) {
      return this.cache[id];
    }
    const value = await this.table.get(id);
    if (value) {
      this.cache[id] = value;
    }
    return value;
  }

  async getAll(): Promise<T[]> {
    return this.table.getAll();
  }

  async set(id: string, value: Omit<T, keyof UniqueObject>): Promise<T> {
    const body = await this.table.set(id, value);
    this.cache[id] = body;
    return body;
  }

  async create(value: Omit<T, keyof UniqueObject>): Promise<T> {
    const body = await this.table.create(value);
    this.cache[body.id] = body;
    return body;
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id);
    delete this.cache[id];
  }
}
