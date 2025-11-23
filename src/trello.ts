interface TrelloCard {
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
}

interface TrelloBoard {
  id: string;
  name: string;
  url: string;
}

interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
}

export class TrelloService {
  private apiKey: string;
  private token: string;
  private baseUrl = 'https://api.trello.com/1';

  constructor(apiKey: string, token: string) {
    this.apiKey = apiKey;
    this.token = token;
  }

  private async makeRequest(endpoint: string): Promise<any> {
    const url = `${this.baseUrl}${endpoint}?key=${this.apiKey}&token=${this.token}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Trello API error: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Trello API request failed:', error);
      throw error;
    }
  }

  async getBoards(): Promise<TrelloBoard[]> {
    const boards = await this.makeRequest('/members/me/boards');
    return boards.map((board: any) => ({
      id: board.id,
      name: board.name,
      url: board.url
    }));
  }

  async getCardsFromBoard(boardId: string): Promise<TrelloCard[]> {
    const cards = await this.makeRequest(`/boards/${boardId}/cards/all`);
    return cards.map((card: any) => ({
      id: card.id,
      name: card.name,
      desc: card.desc,
      dateLastActivity: card.dateLastActivity,
      due: card.due,
      dueComplete: card.dueComplete,
      idBoard: card.idBoard,
      idList: card.idList,
      labels: card.labels,
      url: card.url,
      idMembers: card.idMembers,
      closed: card.closed
    }));
  }

  async getAllCards(boardIds?: string[]): Promise<TrelloCard[]> {
    let boards: TrelloBoard[];
    
    if (boardIds && boardIds.length > 0) {
      // Get only specified boards
      const allBoards = await this.getBoards();
      boards = allBoards.filter(board => boardIds.includes(board.id));
      console.log(`Syncing ${boards.length} selected boards out of ${allBoards.length} total boards`);
    } else {
      // Get all boards
      boards = await this.getBoards();
      console.log(`Syncing all ${boards.length} boards`);
    }

    const allCards: TrelloCard[] = [];

    for (const board of boards) {
      try {
        const cards = await this.getCardsFromBoard(board.id);
        console.log(`Fetched ${cards.length} cards from board: ${board.name}`);
        allCards.push(...cards);
      } catch (error) {
        console.error(`Failed to fetch cards from board ${board.name}:`, error);
      }
    }

    return allCards;
  }

  async getSpecificBoards(boardIds: string[]): Promise<TrelloBoard[]> {
    const allBoards = await this.getBoards();
    return allBoards.filter(board => boardIds.includes(board.id));
  }

  async getAllMembers(boardIds?: string[]): Promise<TrelloMember[]> {
    let boards: TrelloBoard[];
    
    if (boardIds && boardIds.length > 0) {
      boards = await this.getSpecificBoards(boardIds);
    } else {
      boards = await this.getBoards();
    }

    const allMembers = new Map<string, TrelloMember>();

    for (const board of boards) {
      try {
        const members = await this.makeRequest(`/boards/${board.id}/members`);
        members.forEach((member: any) => {
          if (!allMembers.has(member.id)) {
            allMembers.set(member.id, {
              id: member.id,
              fullName: member.fullName,
              username: member.username
            });
          }
        });
      } catch (error) {
        console.error(`Failed to fetch members from board ${board.name}:`, error);
      }
    }

    return Array.from(allMembers.values());
  }
}