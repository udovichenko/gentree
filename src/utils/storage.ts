// Хранилище данных на основе IndexedDB (Dexie)
import Dexie, { type Table } from 'dexie';
import type { FamilyTree, FamilyTreeData } from '../types';
import { defaultTreeSettings } from '../types';

// Конвертация FamilyTree в FamilyTreeData для хранения
export function serializeTree(tree: FamilyTree): FamilyTreeData {
  return {
    id: tree.id,
    name: tree.name,
    description: tree.description,
    persons: Object.fromEntries(tree.persons),
    families: Object.fromEntries(tree.families),
    places: Object.fromEntries(tree.places),
    sources: Object.fromEntries(tree.sources),
    settings: tree.settings,
    createdAt: tree.createdAt.toISOString(),
    updatedAt: tree.updatedAt.toISOString(),
  };
}

// Конвертация FamilyTreeData обратно в FamilyTree
export function deserializeTree(data: FamilyTreeData): FamilyTree {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    persons: new Map(Object.entries(data.persons)),
    families: new Map(Object.entries(data.families)),
    places: new Map(Object.entries(data.places)),
    sources: new Map(Object.entries(data.sources)),
    settings: data.settings,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

// Dexie база данных
class GenTreeDatabase extends Dexie {
  trees!: Table<FamilyTreeData, string>;
  
  constructor() {
    super('GenTreeDB');
    
    this.version(1).stores({
      trees: 'id, name, createdAt, updatedAt',
    });
  }
}

const db = new GenTreeDatabase();

// API для работы с хранилищем
export const storage = {
  // Получить все деревья
  async getAllTrees(): Promise<FamilyTree[]> {
    const data = await db.trees.toArray();
    return data.map(deserializeTree);
  },
  
  // Получить дерево по ID
  async getTree(id: string): Promise<FamilyTree | undefined> {
    const data = await db.trees.get(id);
    return data ? deserializeTree(data) : undefined;
  },
  
  // Сохранить дерево
  async saveTree(tree: FamilyTree): Promise<void> {
    tree.updatedAt = new Date();
    const data = serializeTree(tree);
    await db.trees.put(data);
  },
  
  // Удалить дерево
  async deleteTree(id: string): Promise<void> {
    await db.trees.delete(id);
  },
  
  // Создать новое пустое дерево
  createEmptyTree(name: string): FamilyTree {
    return {
      id: crypto.randomUUID(),
      name,
      persons: new Map(),
      families: new Map(),
      places: new Map(),
      sources: new Map(),
      settings: { ...defaultTreeSettings },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },
};

// Экспорт в JSON файл
export function exportToJson(tree: FamilyTree): string {
  return JSON.stringify(serializeTree(tree), null, 2);
}

// Импорт из JSON файла
export function importFromJson(jsonString: string): FamilyTree {
  const data = JSON.parse(jsonString) as FamilyTreeData;
  return deserializeTree(data);
}
