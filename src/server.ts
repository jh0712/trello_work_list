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

const server = new Elysia()
  .use(cors())
  
  // API Routes with /api prefix
  .group('/api', (app) => 
    app
      .get('/last-sync', async () => {
        const lastSync = await storage.getLastSyncDate();
        return { lastSync };
      })

      .get('/boards', async () => {
        const boards = await storage.getBoards();
        return boards;
      })

      .get('/members', async () => {
        const members = await storage.getMembers();
        return members;
      })

      .get('/tags', async () => {
        const tags = await storage.getTags();
        return tags;
      })

      .get('/available-boards', async () => {
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

      .get('/cards', async ({ query }) => {
        const filters: any = {};
        
        // Handle both single boardId (backwards compatibility) and multiple boardIds
        if (query.boardId) filters.boardIds = [query.boardId];
        if (query.boardIds) {
          const boardIdsStr = Array.isArray(query.boardIds) ? query.boardIds[0] : query.boardIds;
          filters.boardIds = boardIdsStr.split(',').map((id: string) => id.trim()).filter((id: string) => id.length > 0);
        }
        
        if (query.dateFrom) filters.dateFrom = query.dateFrom;
        if (query.dateTo) filters.dateTo = query.dateTo;
        if (query.completed) filters.completed = query.completed === 'true';
        if (query.memberId) filters.memberId = query.memberId;
        if (query.tagNames) {
          const tagNamesStr = Array.isArray(query.tagNames) ? query.tagNames[0] : query.tagNames;
          filters.tagNames = tagNamesStr.split(',').map((name: string) => name.trim()).filter((name: string) => name.length > 0);
        }
        
        const cards = await storage.getCards(filters);
        
        // Add board names to cards
        const boards = await storage.getBoards();
        const boardMap = new Map(boards.map(board => [board.id, board.name]));
        
        // Add member names to cards
        const members = await storage.getMembers();
        const memberMap = new Map(members.map(member => [member.id, member]));
        
        const cardsWithBoardNamesAndMembers = cards.map(card => ({
          ...card,
          boardName: boardMap.get(card.idBoard) || 'Unknown Board',
          members: card.idMembers ? card.idMembers.map(memberId => memberMap.get(memberId)).filter(member => member) : []
        }));
        
        return cardsWithBoardNamesAndMembers;
      })

      .post('/sync', async ({ body }) => {
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
          
          // Fetch boards, cards, and members
          let boards: any[];
          let allCards: any[];
          let allMembers: any[];
          
          if (boardIds && boardIds.length > 0) {
            // Selective sync
            boards = await trelloService.getSpecificBoards(boardIds);
            allCards = await trelloService.getAllCards(boardIds);
            allMembers = await trelloService.getAllMembers(boardIds);
          } else {
            // Full sync
            boards = await trelloService.getBoards();
            allCards = await trelloService.getAllCards();
            allMembers = await trelloService.getAllMembers();
          }
          
          console.log(`Fetched ${boards.length} boards, ${allCards.length} cards, and ${allMembers.length} members`);
          
          // Store data
          await storage.addCards(allCards, boards, allMembers);
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
  )
  
  // Static file routes
  .get('/app.js', () => Bun.file('public/app.js'))
  .get('/', () => Bun.file('public/index.html'))
  
  .listen(PORT);

console.log(`🦊 Trello Work List System is running at http://localhost:${PORT}`);