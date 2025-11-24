class TrelloApp {
    constructor() {
        this.currentFilters = {};
        this.currentTab = 'cards';
        this.charts = {};
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.currentSort = { field: 'dateLastActivity', direction: 'desc' };
        this.allCards = [];
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadLastSync();
        await this.loadBoards();
        await this.loadMembers();
        await this.loadTags();
        await this.loadAvailableBoards();
        await this.loadCards();
    }

    bindEvents() {
        document.getElementById('syncBtn').addEventListener('click', () => this.syncData());
        document.getElementById('applyFilters').addEventListener('click', () => this.applyFilters());
        document.getElementById('refreshBoardsBtn').addEventListener('click', () => this.loadAvailableBoards());
        document.getElementById('selectAllBtn').addEventListener('click', () => this.selectAllBoards());
        document.getElementById('clearSelectionBtn').addEventListener('click', () => this.clearBoardSelection());
        document.getElementById('filterSelectAllBtn').addEventListener('click', () => this.filterSelectAllBoards());
        document.getElementById('filterClearSelectionBtn').addEventListener('click', () => this.filterClearBoardSelection());
        document.getElementById('tagSelectAllBtn').addEventListener('click', () => this.tagSelectAllTags());
        document.getElementById('tagClearSelectionBtn').addEventListener('click', () => this.tagClearTagSelection());
        
        // Sync type radio buttons
        document.querySelectorAll('input[name="syncType"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.toggleBoardSelection(e.target.value));
        });
        
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Filter change events  
        ['dateFromFilter', 'dateToFilter', 'statusFilter', 'memberFilter'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.applyFilters());
        });
    }

    async loadLastSync() {
        try {
            const response = await fetch('/api/last-sync');
            const data = await response.json();
            const lastSyncElement = document.getElementById('lastSync');
            
            if (data.lastSync) {
                const date = new Date(data.lastSync);
                lastSyncElement.textContent = `上次同步：${date.toLocaleString('zh-TW')}`;
            } else {
                lastSyncElement.textContent = '尚未同步';
            }
        } catch (error) {
            console.error('Failed to load last sync:', error);
        }
    }

    async loadBoards() {
        try {
            const response = await fetch('/api/boards');
            const boards = await response.json();
            const boardCheckboxes = document.getElementById('boardCheckboxes');
            
            // Clear existing content
            boardCheckboxes.innerHTML = '';
            
            boards.forEach(board => {
                const checkboxItem = document.createElement('div');
                checkboxItem.className = 'board-checkbox-item';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `board-${board.id}`;
                checkbox.value = board.id;
                checkbox.addEventListener('change', () => {
                    this.updateFilterSelectedBoardsText();
                    this.applyFilters();
                });
                
                const label = document.createElement('label');
                label.htmlFor = `board-${board.id}`;
                label.textContent = board.name;
                
                checkboxItem.appendChild(checkbox);
                checkboxItem.appendChild(label);
                boardCheckboxes.appendChild(checkboxItem);
            });
            
            // Update the display text
            this.updateFilterSelectedBoardsText();
        } catch (error) {
            console.error('Failed to load boards:', error);
            const boardCheckboxes = document.getElementById('boardCheckboxes');
            boardCheckboxes.innerHTML = '<div class="error">載入 Board 失敗</div>';
        }
    }

    async loadMembers() {
        try {
            const response = await fetch('/api/members');
            const members = await response.json();
            const memberFilter = document.getElementById('memberFilter');
            
            // Clear existing options except first one
            memberFilter.innerHTML = '<option value="">所有成員</option>';
            
            members.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = member.fullName || member.username;
                memberFilter.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load members:', error);
        }
    }

    async loadTags() {
        try {
            const response = await fetch('/api/tags');
            const tags = await response.json();
            const tagCheckboxes = document.getElementById('tagCheckboxes');
            
            // Clear existing content
            tagCheckboxes.innerHTML = '';
            
            if (tags.length === 0) {
                tagCheckboxes.innerHTML = '<div class="loading">暫無標籤</div>';
            } else {
                tags.forEach(tag => {
                    const checkboxItem = document.createElement('div');
                    checkboxItem.className = 'board-checkbox-item';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `tag-${tag}`;
                    checkbox.value = tag;
                    checkbox.addEventListener('change', () => {
                        this.updateSelectedTagsText();
                        this.applyFilters();
                    });
                    
                    const label = document.createElement('label');
                    label.htmlFor = `tag-${tag}`;
                    label.textContent = tag;
                    
                    checkboxItem.appendChild(checkbox);
                    checkboxItem.appendChild(label);
                    tagCheckboxes.appendChild(checkboxItem);
                });
            }
            
            // Update the display text
            this.updateSelectedTagsText();
        } catch (error) {
            console.error('Failed to load tags:', error);
            const tagCheckboxes = document.getElementById('tagCheckboxes');
            tagCheckboxes.innerHTML = '<div class="error">載入標籤失敗</div>';
        }
    }

    async loadAvailableBoards() {
        try {
            const response = await fetch('/api/available-boards');
            const boards = await response.json();
            this.renderAvailableBoards(boards);
        } catch (error) {
            console.error('Failed to load available boards:', error);
        }
    }

    renderAvailableBoards(boards) {
        const select = document.getElementById('boardMultiSelect');
        
        // Handle error response
        if (boards && boards.error) {
            select.innerHTML = `<option disabled style="color: #e74c3c; font-style: italic;">錯誤：${boards.error}</option>`;
            this.updateSelectedBoardsText();
            return;
        }
        
        // Handle array of boards
        const boardArray = Array.isArray(boards) ? boards : (boards.boards || []);
        
        if (boardArray.length === 0) {
            select.innerHTML = '<option disabled style="color: #6c757d; font-style: italic;">無法獲取 Board 列表，請檢查 API 憑證設定</option>';
            this.updateSelectedBoardsText();
            return;
        }

        // Clear and populate select
        select.innerHTML = boardArray.map(board => 
            `<option value="${board.id}">${board.name}</option>`
        ).join('');

        // Add change event listener
        select.addEventListener('change', () => this.updateSelectedBoardsText());
        
        // Update display
        this.updateSelectedBoardsText();
    }

    toggleBoardSelection(syncType) {
        const boardSelection = document.getElementById('boardSelection');
        boardSelection.style.display = syncType === 'selective' ? 'block' : 'none';
    }

    selectAllBoards() {
        const select = document.getElementById('boardMultiSelect');
        for (let option of select.options) {
            if (!option.disabled) {
                option.selected = true;
            }
        }
        this.updateSelectedBoardsText();
    }

    clearBoardSelection() {
        const select = document.getElementById('boardMultiSelect');
        for (let option of select.options) {
            option.selected = false;
        }
        this.updateSelectedBoardsText();
    }

    filterSelectAllBoards() {
        const checkboxes = document.querySelectorAll('#boardCheckboxes input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
        this.updateFilterSelectedBoardsText();
        this.applyFilters();
    }

    filterClearBoardSelection() {
        const checkboxes = document.querySelectorAll('#boardCheckboxes input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        this.updateFilterSelectedBoardsText();
        this.applyFilters();
    }

    updateFilterSelectedBoardsText() {
        const checkboxes = document.querySelectorAll('#boardCheckboxes input[type="checkbox"]:checked');
        const textElement = document.getElementById('selectedFilterBoardsText');
        const count = checkboxes.length;
        
        if (count === 0) {
            textElement.textContent = '未選擇任何 Board';
        } else if (count === 1) {
            const boardName = checkboxes[0].nextElementSibling.textContent;
            textElement.textContent = `已選擇 1 個 Board: ${boardName}`;
        } else if (count <= 3) {
            const names = Array.from(checkboxes).map(checkbox => checkbox.nextElementSibling.textContent).join(', ');
            textElement.textContent = `已選擇 ${count} 個 Board: ${names}`;
        } else {
            textElement.textContent = `已選擇 ${count} 個 Board`;
        }
    }

    updateSelectedTagsText() {
        const checkboxes = document.querySelectorAll('#tagCheckboxes input[type="checkbox"]:checked');
        const textElement = document.getElementById('selectedTagsText');
        const count = checkboxes.length;
        
        if (count === 0) {
            textElement.textContent = '未選擇任何標籤';
        } else if (count === 1) {
            const tagName = checkboxes[0].nextElementSibling.textContent;
            textElement.textContent = `已選擇 1 個標籤: ${tagName}`;
        } else if (count <= 3) {
            const names = Array.from(checkboxes).map(checkbox => checkbox.nextElementSibling.textContent).join(', ');
            textElement.textContent = `已選擇 ${count} 個標籤: ${names}`;
        } else {
            textElement.textContent = `已選擇 ${count} 個標籤`;
        }
    }

    tagSelectAllTags() {
        const checkboxes = document.querySelectorAll('#tagCheckboxes input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
        this.updateSelectedTagsText();
        this.applyFilters();
    }

    tagClearTagSelection() {
        const checkboxes = document.querySelectorAll('#tagCheckboxes input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        this.updateSelectedTagsText();
        this.applyFilters();
    }

    updateSelectedBoardsText() {
        const select = document.getElementById('boardMultiSelect');
        const textElement = document.getElementById('selectedBoardsText');
        
        const selectedOptions = Array.from(select.selectedOptions);
        const count = selectedOptions.length;
        
        if (count === 0) {
            textElement.textContent = '未選擇任何 Board';
        } else if (count === 1) {
            textElement.textContent = `已選擇 1 個 Board: ${selectedOptions[0].textContent}`;
        } else if (count <= 3) {
            const names = selectedOptions.map(option => option.textContent).join(', ');
            textElement.textContent = `已選擇 ${count} 個 Board: ${names}`;
        } else {
            textElement.textContent = `已選擇 ${count} 個 Board`;
        }
    }

    getSelectedBoards() {
        const syncType = document.querySelector('input[name="syncType"]:checked').value;
        if (syncType === 'all') {
            return null; // null means sync all boards
        }
        
        const select = document.getElementById('boardMultiSelect');
        const selectedValues = Array.from(select.selectedOptions).map(option => option.value);
        return selectedValues.length > 0 ? selectedValues : [];
    }

    async syncData() {
        const syncBtn = document.getElementById('syncBtn');
        const originalText = syncBtn.textContent;
        
        syncBtn.disabled = true;
        syncBtn.textContent = '同步中...';
        
        try {
            const selectedBoards = this.getSelectedBoards();
            const body = selectedBoards ? JSON.stringify({ boardIds: selectedBoards }) : JSON.stringify({});
            
            const response = await fetch('/api/sync', { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: body
            });
            const result = await response.json();
            
            if (response.ok) {
                const syncType = selectedBoards ? `選擇性同步 ${selectedBoards.length} 個 Board` : '同步所有 Board';
                this.showMessage(`${syncType} 成功！`, 'success');
                await this.loadLastSync();
                await this.loadBoards();
                await this.loadMembers();
                await this.loadTags();
                await this.loadCards();
            } else {
                this.showMessage(`同步失敗：${result.error}`, 'error');
            }
        } catch (error) {
            this.showMessage(`同步失敗：${error.message}`, 'error');
        } finally {
            syncBtn.disabled = false;
            syncBtn.textContent = originalText;
        }
    }

    async loadCards() {
        const container = document.getElementById('cardsContainer');
        container.innerHTML = '<div class="loading">載入中...</div>';

        try {
            const queryParams = new URLSearchParams(this.currentFilters);
            const response = await fetch(`/api/cards?${queryParams}`);
            const cards = await response.json();
            
            this.allCards = cards;
            this.currentPage = 1; // Reset to first page when loading new data
            this.renderCardsTable();
            
            if (this.currentTab === 'analytics') {
                this.renderAnalytics(cards);
            }
        } catch (error) {
            container.innerHTML = '<div class="error">載入失敗</div>';
            console.error('Failed to load cards:', error);
        }
    }

    renderCardsTable() {
        const container = document.getElementById('cardsContainer');
        
        if (this.allCards.length === 0) {
            container.innerHTML = '<div class="loading">沒有找到符合條件的卡片</div>';
            return;
        }

        // Sort cards
        const sortedCards = this.sortCards([...this.allCards]);
        
        // Paginate cards
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedCards = sortedCards.slice(startIndex, endIndex);
        
        const totalPages = Math.ceil(sortedCards.length / this.itemsPerPage);

        container.innerHTML = `
            <div class="cards-table-container">
                <table class="cards-table">
                    <thead>
                        <tr>
                            <th class="sortable" data-field="name">卡片標題</th>
                            <th class="sortable" data-field="boardName">Board</th>
                            <th>標籤</th>
                            <th class="sortable" data-field="dueComplete">狀態</th>
                            <th class="sortable" data-field="due">截止日期</th>
                            <th class="sortable" data-field="dateLastActivity">最後活動</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paginatedCards.map(card => this.renderTableRow(card)).join('')}
                    </tbody>
                </table>
                ${this.renderPagination(totalPages, sortedCards.length)}
            </div>
        `;

        // Add sorting event listeners
        this.bindTableSortingEvents();
    }

    renderTableRow(card) {
        const labels = card.labels.map(label => 
            `<span class="label" style="background-color: ${this.getLabelColor(label.color)}">${label.name || label.color}</span>`
        ).join('');

        const dueDate = card.due ? new Date(card.due).toLocaleDateString('zh-TW') : '-';
        const lastActivity = new Date(card.dateLastActivity).toLocaleDateString('zh-TW');
        const status = card.dueComplete ? '已完成' : '進行中';
        const statusClass = card.dueComplete ? 'status-completed' : 'status-pending';

        return `
            <tr>
                <td class="card-title-cell">
                    <a href="${card.url}" target="_blank" class="card-title-link">${card.name}</a>
                    ${card.desc ? `<div class="card-description">${card.desc}</div>` : ''}
                </td>
                <td>
                    <div class="board-name">${card.boardName || 'Unknown'}</div>
                </td>
                <td class="card-labels-cell">
                    <div class="card-labels">${labels}</div>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">${status}</span>
                </td>
                <td class="date-cell">${dueDate}</td>
                <td class="date-cell">${lastActivity}</td>
            </tr>
        `;
    }

    renderPagination(totalPages, totalItems) {
        if (totalPages <= 1) return '';

        const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endItem = Math.min(this.currentPage * this.itemsPerPage, totalItems);

        const pages = [];
        const maxVisiblePages = 5;
        
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(`
                <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" 
                        data-page="${i}">${i}</button>
            `);
        }

        return `
            <div class="table-pagination">
                <div class="pagination-info">
                    顯示 ${startItem}-${endItem} 共 ${totalItems} 筆
                </div>
                <div class="pagination-controls">
                    <button class="pagination-btn" data-page="1" ${this.currentPage === 1 ? 'disabled' : ''}>首頁</button>
                    <button class="pagination-btn" data-page="${this.currentPage - 1}" ${this.currentPage === 1 ? 'disabled' : ''}>上一頁</button>
                    ${pages.join('')}
                    <button class="pagination-btn" data-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? 'disabled' : ''}>下一頁</button>
                    <button class="pagination-btn" data-page="${totalPages}" ${this.currentPage === totalPages ? 'disabled' : ''}>末頁</button>
                </div>
            </div>
        `;
    }

    bindTableSortingEvents() {
        // Bind sorting events
        document.querySelectorAll('.cards-table th.sortable').forEach(th => {
            th.addEventListener('click', (e) => {
                const field = e.target.dataset.field;
                this.sortTable(field);
            });
        });

        // Bind pagination events
        document.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(e.target.dataset.page);
                if (!isNaN(page) && !e.target.disabled) {
                    this.currentPage = page;
                    this.renderCardsTable();
                }
            });
        });

        // Update sort indicators
        this.updateSortIndicators();
    }

    sortTable(field) {
        if (this.currentSort.field === field) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.field = field;
            this.currentSort.direction = 'asc';
        }
        this.currentPage = 1; // Reset to first page
        this.renderCardsTable();
    }

    updateSortIndicators() {
        // Remove all sort classes
        document.querySelectorAll('.cards-table th').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
        });

        // Add current sort class
        const currentTh = document.querySelector(`[data-field="${this.currentSort.field}"]`);
        if (currentTh) {
            currentTh.classList.add(`sort-${this.currentSort.direction}`);
        }
    }

    sortCards(cards) {
        return cards.sort((a, b) => {
            let aVal = a[this.currentSort.field];
            let bVal = b[this.currentSort.field];

            // Handle different data types
            if (this.currentSort.field === 'dateLastActivity' || this.currentSort.field === 'due') {
                aVal = aVal ? new Date(aVal) : new Date(0);
                bVal = bVal ? new Date(bVal) : new Date(0);
            } else if (this.currentSort.field === 'dueComplete') {
                aVal = aVal ? 1 : 0;
                bVal = bVal ? 1 : 0;
            } else if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal ? bVal.toLowerCase() : '';
            }

            if (aVal < bVal) return this.currentSort.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    getLabelColor(color) {
        const colorMap = {
            'green': '#61bd4f',
            'yellow': '#f2d600',
            'orange': '#ff9f1a',
            'red': '#eb5a46',
            'purple': '#c377e0',
            'blue': '#0079bf',
            'sky': '#00c2e0',
            'lime': '#51e898',
            'pink': '#ff78cb',
            'black': '#344563',
            'light_green': '#51e898',
            'light_yellow': '#f2d600',
            'light_orange': '#ff9f1a',
            'light_red': '#eb5a46',
            'light_purple': '#c377e0',
            'light_blue': '#0079bf'
        };
        return colorMap[color] || '#bdc3c7';
    }

    async applyFilters() {
        this.currentFilters = {};
        
        const selectedCheckboxes = document.querySelectorAll('#boardCheckboxes input[type="checkbox"]:checked');
        const selectedBoards = Array.from(selectedCheckboxes).map(checkbox => checkbox.value);
        const selectedTagCheckboxes = document.querySelectorAll('#tagCheckboxes input[type="checkbox"]:checked');
        const selectedTags = Array.from(selectedTagCheckboxes).map(checkbox => checkbox.value);
        const dateFrom = document.getElementById('dateFromFilter').value;
        const dateTo = document.getElementById('dateToFilter').value;
        const status = document.getElementById('statusFilter').value;
        const memberId = document.getElementById('memberFilter').value;
        
        if (selectedBoards.length > 0) this.currentFilters.boardIds = selectedBoards.join(',');
        if (selectedTags.length > 0) this.currentFilters.tagNames = selectedTags.join(',');
        if (dateFrom) this.currentFilters.dateFrom = dateFrom;
        if (dateTo) this.currentFilters.dateTo = dateTo;
        if (status === 'completed') this.currentFilters.completed = 'true';
        if (status === 'pending') this.currentFilters.completed = 'false';
        if (memberId) this.currentFilters.memberId = memberId;
        
        await this.loadCards();
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            }
        });
        
        // Show/hide tab content
        document.getElementById('cardsTab').style.display = tabName === 'cards' ? 'block' : 'none';
        document.getElementById('analyticsTab').style.display = tabName === 'analytics' ? 'block' : 'none';
        
        if (tabName === 'analytics') {
            this.loadAnalyticsData();
        }
    }

    async loadAnalyticsData() {
        try {
            const queryParams = new URLSearchParams(this.currentFilters);
            const response = await fetch(`/api/cards?${queryParams}`);
            const cards = await response.json();
            this.renderAnalytics(cards);
        } catch (error) {
            console.error('Failed to load analytics data:', error);
        }
    }

    renderAnalytics(cards) {
        this.renderStats(cards);
        this.renderMonthlyCompletionTable(cards);
        this.renderCharts(cards);
    }

    renderStats(cards) {
        const totalCards = cards.length;
        const completedCards = cards.filter(card => card.dueComplete).length;
        const pendingCards = totalCards - completedCards;
        const completionRate = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0;

        document.getElementById('stats').innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${totalCards}</div>
                <div class="stat-label">總卡片數</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${completedCards}</div>
                <div class="stat-label">已完成</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${pendingCards}</div>
                <div class="stat-label">進行中</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${completionRate}%</div>
                <div class="stat-label">完成率</div>
            </div>
        `;
    }

    renderMonthlyCompletionTable(cards) {
        const monthlyData = this.groupCardsByMonth(cards);
        const tableContainer = document.getElementById('monthlyCompletionTable');
        
        if (Object.keys(monthlyData).length === 0) {
            tableContainer.innerHTML = '<p class="loading">暫無完成任務數據</p>';
            return;
        }
        
        // Calculate total and average
        const totalCompletions = Object.values(monthlyData).reduce((sum, count) => sum + count, 0);
        const monthCount = Object.keys(monthlyData).length;
        const averagePerMonth = Math.round(totalCompletions / monthCount * 10) / 10;
        
        // Convert month keys to readable format
        const monthNames = {
            '01': '1月', '02': '2月', '03': '3月', '04': '4月',
            '05': '5月', '06': '6月', '07': '7月', '08': '8月',
            '09': '9月', '10': '10月', '11': '11月', '12': '12月'
        };
        
        let tableHTML = `
            <table class="monthly-stats-table">
                <thead>
                    <tr>
                        <th>月份</th>
                        <th>完成任務數</th>
                        <th>占比</th>
                        <th>趨勢</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        const sortedEntries = Object.entries(monthlyData);
        let previousCount = 0;
        
        sortedEntries.forEach(([monthKey, count], index) => {
            const [year, month] = monthKey.split('-');
            const monthName = monthNames[month] || month;
            const percentage = Math.round((count / totalCompletions) * 100);
            
            // Calculate trend
            let trend = '';
            if (index > 0) {
                if (count > previousCount) {
                    trend = '<span style="color: #27ae60;">↗ 上升</span>';
                } else if (count < previousCount) {
                    trend = '<span style="color: #e74c3c;">↘ 下降</span>';
                } else {
                    trend = '<span style="color: #95a5a6;">→ 持平</span>';
                }
            } else {
                trend = '<span style="color: #95a5a6;">-</span>';
            }
            
            tableHTML += `
                <tr>
                    <td class="month-name">${year}年 ${monthName}</td>
                    <td class="completion-count">${count}</td>
                    <td>${percentage}%</td>
                    <td>${trend}</td>
                </tr>
            `;
            
            previousCount = count;
        });
        
        // Add summary row
        tableHTML += `
                <tr style="border-top: 2px solid #34495e; background-color: #f8f9fa;">
                    <td class="month-name"><strong>總計/平均</strong></td>
                    <td class="completion-count"><strong>${totalCompletions}</strong></td>
                    <td><strong>100%</strong></td>
                    <td><strong>平均: ${averagePerMonth}/月</strong></td>
                </tr>
            </tbody>
        </table>
        `;
        
        tableContainer.innerHTML = tableHTML;
    }

    renderCharts(cards) {
        this.renderMonthlyChart(cards);
        this.renderLabelsChart(cards);
        this.renderBoardsChart(cards);
    }

    renderMonthlyChart(cards) {
        const monthlyData = this.groupCardsByMonth(cards);
        const ctx = document.getElementById('monthlyChart').getContext('2d');
        
        if (this.charts.monthly) {
            this.charts.monthly.destroy();
        }

        this.charts.monthly = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Object.keys(monthlyData),
                datasets: [{
                    label: '完成任務數',
                    data: Object.values(monthlyData),
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderLabelsChart(cards) {
        const labelData = this.groupCardsByLabels(cards);
        const ctx = document.getElementById('labelsChart').getContext('2d');
        
        if (this.charts.labels) {
            this.charts.labels.destroy();
        }

        const colors = ['#3498db', '#e74c3c', '#f39c12', '#27ae60', '#9b59b6', '#1abc9c', '#34495e'];

        this.charts.labels = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(labelData),
                datasets: [{
                    data: Object.values(labelData),
                    backgroundColor: colors.slice(0, Object.keys(labelData).length)
                }]
            },
            options: {
                responsive: true
            }
        });
    }

    renderBoardsChart(cards) {
        const boardData = this.groupCardsByBoards(cards);
        const ctx = document.getElementById('boardsChart').getContext('2d');
        
        if (this.charts.boards) {
            this.charts.boards.destroy();
        }

        this.charts.boards = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(boardData),
                datasets: [{
                    label: '卡片數量',
                    data: Object.values(boardData),
                    backgroundColor: '#3498db'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    groupCardsByMonth(cards) {
        const monthlyData = {};
        
        // Only count completed tasks
        const completedCards = cards.filter(card => card.dueComplete);
        
        completedCards.forEach(card => {
            // Use due date for completion if available, otherwise use last activity
            const date = card.due ? new Date(card.due) : new Date(card.dateLastActivity);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
        });
        
        // Sort months chronologically
        const sortedMonthlyData = {};
        Object.keys(monthlyData)
            .sort()
            .forEach(key => {
                sortedMonthlyData[key] = monthlyData[key];
            });
        
        return sortedMonthlyData;
    }

    groupCardsByLabels(cards) {
        const labelData = {};
        cards.forEach(card => {
            if (card.labels.length === 0) {
                labelData['無標籤'] = (labelData['無標籤'] || 0) + 1;
            } else {
                card.labels.forEach(label => {
                    const labelName = label.name || label.color;
                    labelData[labelName] = (labelData[labelName] || 0) + 1;
                });
            }
        });
        return labelData;
    }

    groupCardsByBoards(cards) {
        const boardData = {};
        cards.forEach(card => {
            const boardName = card.boardName || card.idBoard;
            boardData[boardName] = (boardData[boardName] || 0) + 1;
        });
        return boardData;
    }

    showMessage(message, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = type;
        messageDiv.textContent = message;
        
        document.querySelector('.sync-section').appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TrelloApp();
});