import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface StoredCard {
  id: string;
  name: string;
  desc: string;
  dateLastActivity: string;
  due: string | null;
  dueComplete: boolean;
  idBoard: string;
  idList: string;
  labels: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  url: string;
  idMembers: string[];
  closed: boolean;
  boardName?: string;
  createdDate?: string;
  completedDate?: string;
}

export interface StoredData {
  cards: StoredCard[];
  boards: Array<{
    id: string;
    name: string;
    url: string;
  }>;
  members: Array<{
    id: string;
    fullName: string;
    username: string;
  }>;
  lastSync: string;
}

export class DataStorage {
  private dataPath: string;
  private backupPath: string;

  constructor() {
    this.dataPath = join(process.cwd(), 'data', 'cards.json');
    this.backupPath = join(process.cwd(), 'data', 'cards_backup.json');
  }

  private ensureDataDirectory() {
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      require('fs').mkdirSync(dataDir, { recursive: true });
    }
  }

  async loadData(): Promise<StoredData> {
    this.ensureDataDirectory();
    
    if (!existsSync(this.dataPath)) {
      const emptyData: StoredData = {
        cards: [],
        boards: [],
        members: [],
        lastSync: ''
      };
      await this.saveData(emptyData);
      return emptyData;
    }

    try {
      const data = readFileSync(this.dataPath, 'utf-8');
      const parsedData = JSON.parse(data);
      // Ensure members array exists for backward compatibility
      if (!parsedData.members) {
        parsedData.members = [];
      }
      return parsedData;
    } catch (error) {
      console.error('Failed to load data:', error);
      
      // Try to load from backup
      if (existsSync(this.backupPath)) {
        try {
          const backupData = readFileSync(this.backupPath, 'utf-8');
          console.log('Loaded data from backup');
          const parsedBackupData = JSON.parse(backupData);
          // Ensure members array exists for backward compatibility
          if (!parsedBackupData.members) {
            parsedBackupData.members = [];
          }
          return parsedBackupData;
        } catch (backupError) {
          console.error('Failed to load backup data:', backupError);
        }
      }
      
      // Return empty data if all else fails
      return {
        cards: [],
        boards: [],
        members: [],
        lastSync: ''
      };
    }
  }

  async saveData(data: StoredData): Promise<void> {
    this.ensureDataDirectory();
    
    try {
      // Create backup before saving new data
      if (existsSync(this.dataPath)) {
        const currentData = readFileSync(this.dataPath);
        writeFileSync(this.backupPath, currentData);
      }
      
      // Save new data
      data.lastSync = new Date().toISOString();
      writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
      console.log('Data saved successfully');
    } catch (error) {
      console.error('Failed to save data:', error);
      throw error;
    }
  }

  async addCards(cards: StoredCard[], boards: any[], members: any[]): Promise<void> {
    const currentData = await this.loadData();
    
    // Update boards
    currentData.boards = boards;
    
    // Update members
    currentData.members = members;
    
    // Merge cards (update existing or add new)
    const cardMap = new Map();
    currentData.cards.forEach(card => cardMap.set(card.id, card));
    
    cards.forEach(card => {
      const existingCard = cardMap.get(card.id);
      if (existingCard) {
        // Update existing card while preserving any local data
        cardMap.set(card.id, { ...existingCard, ...card });
      } else {
        cardMap.set(card.id, card);
      }
    });
    
    currentData.cards = Array.from(cardMap.values());
    
    await this.saveData(currentData);
  }

  async getCards(filters?: {
    boardId?: string;
    boardIds?: string[];
    labels?: string[];
    tagNames?: string[];
    dateFrom?: string;
    dateTo?: string;
    completed?: boolean;
    memberId?: string;
  }): Promise<StoredCard[]> {
    const data = await this.loadData();
    let cards = data.cards;

    if (filters) {
      // Handle both single boardId (backwards compatibility) and multiple boardIds
      if (filters.boardId) {
        cards = cards.filter(card => card.idBoard === filters.boardId);
      } else if (filters.boardIds && filters.boardIds.length > 0) {
        cards = cards.filter(card => filters.boardIds!.includes(card.idBoard));
      }
      
      if (filters.labels && filters.labels.length > 0) {
        cards = cards.filter(card => 
          card.labels.some(label => filters.labels!.includes(label.name))
        );
      }
      
      if (filters.tagNames && filters.tagNames.length > 0) {
        cards = cards.filter(card => 
          card.labels.some(label => filters.tagNames!.includes(label.name))
        );
      }
      
      if (filters.dateFrom) {
        cards = cards.filter(card => 
          new Date(card.dateLastActivity) >= new Date(filters.dateFrom!)
        );
      }
      
      if (filters.dateTo) {
        cards = cards.filter(card => 
          new Date(card.dateLastActivity) <= new Date(filters.dateTo!)
        );
      }
      
      if (filters.completed !== undefined) {
        cards = cards.filter(card => card.dueComplete === filters.completed);
      }
      
      if (filters.memberId) {
        cards = cards.filter(card => card.idMembers.includes(filters.memberId!));
      }
    }

    return cards;
  }

  async getBoards() {
    const data = await this.loadData();
    return data.boards;
  }

  async getLastSyncDate(): Promise<string> {
    const data = await this.loadData();
    return data.lastSync;
  }

  async getMembers() {
    const data = await this.loadData();
    return data.members || [];
  }

  async getTags() {
    const data = await this.loadData();
    const tagSet = new Set<string>();
    
    data.cards.forEach(card => {
      card.labels.forEach(label => {
        if (label.name && label.name.trim()) {
          tagSet.add(label.name.trim());
        }
      });
    });
    
    return Array.from(tagSet).sort();
  }
}