import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { TrelloService } from './trello';
import { DataStorage } from './storage';

// Load environment variables
const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const PORT = process.env.PORT || 3000;

if (!TRELLO_API_KEY || !TRELLO_TOKEN) {
  console.error('Please set TRELLO_API_KEY and TRELLO_TOKEN in your .env file');
  process.exit(1);
}

const trelloService = new TrelloService(TRELLO_API_KEY, TRELLO_TOKEN);
const storage = new DataStorage();

const app = new Elysia()
  .use(cors())
  
  // API Routes first
  .get('/api/last-sync', async () => {
    const lastSync = await storage.getLastSyncDate();
    return { lastSync };
  })

  .get('/api/boards', async () => {
    const boards = await storage.getBoards();
    return boards;
  })

  .get('/api/available-boards', async () => {
    try {
      console.log('Fetching available boards from Trello API...');
      const boards = await trelloService.getBoards();
      console.log(`Found ${boards.length} boards`);
      return boards;
    } catch (error: any) {
      console.error('Failed to fetch available boards:', error);
      return { error: error.message, boards: [] };
    }
  })

  .get('/api/cards', async ({ query }) => {
    const filters: any = {};
    
    if (query.boardId) filters.boardId = query.boardId;
    if (query.dateFrom) filters.dateFrom = query.dateFrom;
    if (query.dateTo) filters.dateTo = query.dateTo;
    if (query.completed) filters.completed = query.completed === 'true';
    
    const cards = await storage.getCards(filters);
    
    // Add board names to cards
    const boards = await storage.getBoards();
    const boardMap = new Map(boards.map(board => [board.id, board.name]));
    
    const cardsWithBoardNames = cards.map(card => ({
      ...card,
      boardName: boardMap.get(card.idBoard) || 'Unknown Board'
    }));
    
    return cardsWithBoardNames;
  })

  .post('/api/sync', async ({ body }) => {
    try {
      console.log('Starting Trello data sync...');
      
      // Parse request body to check for selective sync
      let boardIds: string[] | undefined;
      if (body && typeof body === 'object' && 'boardIds' in body) {
        boardIds = body.boardIds as string[];
        console.log(`Selective sync requested for ${boardIds.length} boards:`, boardIds);
      } else {
        console.log('Full sync requested for all boards');
      }
      
      // Fetch boards and cards
      let boards: any[];
      let allCards: any[];
      
      if (boardIds && boardIds.length > 0) {
        // Selective sync
        boards = await trelloService.getSpecificBoards(boardIds);
        allCards = await trelloService.getAllCards(boardIds);
      } else {
        // Full sync
        boards = await trelloService.getBoards();
        allCards = await trelloService.getAllCards();
      }
      
      console.log(`Fetched ${boards.length} boards and ${allCards.length} cards`);
      
      // Store data
      await storage.addCards(allCards, boards);
      console.log('Data stored successfully');
      
      const syncType = boardIds ? `選擇性同步 ${boards.length} 個 Board` : `同步所有 ${boards.length} 個 Board`;
      
      return { 
        success: true, 
        message: `${syncType}，共 ${allCards.length} 張卡片`,
        boardCount: boards.length,
        cardCount: allCards.length,
        syncType: boardIds ? 'selective' : 'full'
      };
    } catch (error: any) {
      console.error('Sync failed:', error);
      return { 
        success: false, 
        error: error.message || 'Unknown error occurred' 
      };
    }
  })

  // Static file routes (after API routes)
  .get('/app.js', () => Bun.file('public/app.js'))
  .get('/', () => Bun.file('public/index.html'))
  
  .listen(PORT);

console.log(`🦊 Trello Work List System is running at http://localhost:${PORT}`);