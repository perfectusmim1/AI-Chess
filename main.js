// Ana uygulama kontrolcüsü

class ChessApp {
    constructor() {
        this.game = new ChessGame();
        this.aiManager = new AIManager();
        this.openRouterAPI = new OpenRouterAPI();
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.gameRunning = false;
        this.autoPlay = false;
        this.availableModels = [];
        this.selectedModels = { white: null, black: null };
        this.localStorageKey = 'openrouter_api_key';
        // Manuel oyuncu etkileşimini tamamen kapat
        this.manualPlayEnabled = false;
        
        this.initializeUI();
        this.bindEvents();
        this.updateChessBoard();
        this.updateGameInfo();

        // Kayıtlı API anahtarı varsa otomatik yükle
        this.restoreApiKeyAndAutoLoad();
    }

    initializeUI() {
        // Satranç tahtasını oluştur
        this.createChessBoard();
        
        // API key input'u izle
        this.setupAPIKeyWatcher();
        
        // Başlangıçta searchable select'leri devre dışı bırak
        this.disableSearchableSelects();
    }

    disableSearchableSelects() {
        const whiteSelected = document.getElementById('whiteSelectedModel');
        const blackSelected = document.getElementById('blackSelectedModel');
        
        whiteSelected.classList.add('disabled');
        blackSelected.classList.add('disabled');
        
        const whiteSearchInput = document.querySelector('#whiteModelDropdown .model-search-input');
        const blackSearchInput = document.querySelector('#blackModelDropdown .model-search-input');
        
        whiteSearchInput.disabled = true;
        blackSearchInput.disabled = true;
    }

    setupAPIKeyWatcher() {
        const apiKeyInput = document.getElementById('apiKey');
        const loadModelsBtn = document.getElementById('loadModels');

        if (apiKeyInput && loadModelsBtn) {
            apiKeyInput.addEventListener('input', (e) => {
                const apiKey = e.target.value.trim();
                loadModelsBtn.disabled = !apiKey || apiKey.length < 10;
                
                if (apiKey.length >= 10) {
                    loadModelsBtn.querySelector('.load-text').textContent = 'Modelleri Yükle';
                } else {
                    loadModelsBtn.querySelector('.load-text').textContent = 'API Key Gerekli';
                }
            });

            // Enter ile direkt yükleme
            apiKeyInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!loadModelsBtn.disabled) {
                        this.loadModels();
                    }
                }
            });
        }
    }

    createChessBoard() {
        const board = document.getElementById('chessBoard');
        board.innerHTML = '';
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `chess-square ${(row + col) % 2 === 0 ? 'white' : 'black'}`;
                square.dataset.row = row;
                square.dataset.col = col;
                
                // Manuel oyun kapalı. İleride açılmak istenirse flag ile kontrol edilir
                square.addEventListener('click', () => {
                    if (this.manualPlayEnabled) {
                        this.handleSquareClick(row, col);
                    }
                });
                
                board.appendChild(square);
            }
        }
    }

    bindEvents() {
        // Oyun kontrol butonları
        document.getElementById('startGame').addEventListener('click', () => this.startGame());
        document.getElementById('pauseGame').addEventListener('click', () => this.pauseGame());
        document.getElementById('resetGame').addEventListener('click', () => this.resetGame());
        
        // Model yükleme butonu
        document.getElementById('loadModels').addEventListener('click', () => this.loadModels());
        
        // Searchable select events
        this.bindSearchableSelectEvents('white');
        this.bindSearchableSelectEvents('black');
        
        // Click outside to close dropdowns
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.searchable-select')) {
                this.closeAllDropdowns();
            }
        });
    }

    bindSearchableSelectEvents(color) {
        const selectedModel = document.getElementById(`${color}SelectedModel`);
        const dropdown = document.getElementById(`${color}ModelDropdown`);
        const searchInput = dropdown.querySelector('.model-search-input');
        
        // Toggle dropdown
        selectedModel.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown(color);
        });
        
        // Search functionality
        searchInput.addEventListener('input', (e) => {
            this.filterModels(color, e.target.value);
        });
        
        // Prevent dropdown close when clicking inside
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    toggleDropdown(color) {
        const selectedModel = document.getElementById(`${color}SelectedModel`);
        const dropdown = document.getElementById(`${color}ModelDropdown`);
        const searchInput = dropdown.querySelector('.model-search-input');
        
        // Close other dropdown
        const otherColor = color === 'white' ? 'black' : 'white';
        this.closeDropdown(otherColor);
        
        const isOpen = dropdown.style.display === 'block';
        
        if (isOpen) {
            this.closeDropdown(color);
        } else {
            dropdown.style.display = 'block';
            selectedModel.classList.add('open');
            searchInput.focus();
            searchInput.value = '';
            this.filterModels(color, '');
        }
    }

    closeDropdown(color) {
        const selectedModel = document.getElementById(`${color}SelectedModel`);
        const dropdown = document.getElementById(`${color}ModelDropdown`);
        if (!dropdown || dropdown.style.display !== 'block') return;

        // Kapanış animasyonu
        dropdown.classList.add('closing');
        selectedModel.classList.remove('open');
        
        const onAnimEnd = () => {
            dropdown.style.display = 'none';
            dropdown.classList.remove('closing');
            dropdown.removeEventListener('animationend', onAnimEnd);
        };
        dropdown.addEventListener('animationend', onAnimEnd);
    }

    closeAllDropdowns() {
        this.closeDropdown('white');
        this.closeDropdown('black');
    }

    filterModels(color, searchTerm) {
        const modelList = document.getElementById(`${color}ModelList`);
        const filteredModels = this.availableModels.filter(model => {
            const formattedName = this.openRouterAPI.formatModelName(model);
            const hay = (formattedName + ' ' + model.id).toLowerCase();
            const q = (searchTerm || '').toLowerCase();
            // Basit fuzzy: boşlukla ayrılmış kelimelerin her biri geçsin
            return q.split(/\s+/).every(tok => hay.includes(tok));
        });

        this.populateModelList(color, filteredModels);
    }

    async loadModels() {
        const apiKey = document.getElementById('apiKey').value.trim();
        const loadBtn = document.getElementById('loadModels');
        const loadText = loadBtn.querySelector('.load-text');
        const loadSpinner = loadBtn.querySelector('.loading-spinner');

        if (!apiKey) {
            alert('Lütfen önce API anahtarınızı girin.');
            return;
        }

        try {
            // Loading durumu
            loadBtn.disabled = true;
            loadText.style.display = 'none';
            loadSpinner.style.display = 'inline';

            // Modelleri OpenRouter'dan çek
            this.availableModels = await this.openRouterAPI.fetchModels(apiKey);

            if (this.availableModels.length === 0) {
                throw new Error('Erişilebilir model bulunamadı.');
            }

            // Dropdown'ları doldur
            this.populateModelDropdowns();

            // Anahtarı kaydet ve API alanını gizle
            this.persistApiKey(apiKey);
            this.hideApiKeySection();

            // Başarı mesajı
            loadText.textContent = `${this.availableModels.length} Model Yüklendi`;
            loadText.style.color = '#48bb78';

        } catch (error) {
            console.error('Model yükleme hatası:', error);
            
            let errorMessage = 'Model yükleme başarısız.';
            if (error.message.includes('401')) {
                errorMessage = 'Geçersiz API anahtarı.';
            } else if (error.message.includes('403')) {
                errorMessage = 'API anahtarında yetki sorunu.';
            } else if (error.message.includes('429')) {
                errorMessage = 'Çok fazla istek. Biraz bekleyin.';
            }
            
            loadText.textContent = errorMessage;
            loadText.style.color = '#e53e3e';
            
            alert(`Hata: ${errorMessage}\n\nLütfen API anahtarınızı kontrol edin.`);
        } finally {
            // Loading durumu sıfırla
            loadSpinner.style.display = 'none';
            loadText.style.display = 'inline';
            loadBtn.disabled = false;
            
            // 3 saniye sonra buton metnini sıfırla
            setTimeout(() => {
                if (this.availableModels.length > 0) {
                    loadText.textContent = 'Modelleri Yenile';
                    loadText.style.color = '';
                } else {
                    loadText.textContent = 'Modelleri Yükle';
                    loadText.style.color = '';
                }
            }, 3000);
        }
    }

    persistApiKey(apiKey) {
        try {
            const encoded = btoa(apiKey);
            localStorage.setItem(this.localStorageKey, encoded);
        } catch (e) {
            console.warn('API anahtarı kaydedilemedi:', e);
        }
    }

    restoreApiKeyAndAutoLoad() {
        try {
            const encoded = localStorage.getItem(this.localStorageKey);
            if (!encoded) return;

            const apiKey = atob(encoded);
            const apiKeyInput = document.getElementById('apiKey');
            const loadBtn = document.getElementById('loadModels');
            if (apiKeyInput && loadBtn) {
                apiKeyInput.value = apiKey;
                loadBtn.disabled = apiKey.length < 10;
                // Otomatik model yükleme
                this.loadModels();
            }
        } catch (e) {
            console.warn('Kayıtlı API anahtarı okunamadı:', e);
        }
    }

    hideApiKeySection() {
        const section = document.querySelector('.api-key-section');
        if (section) {
            section.style.display = 'none';
        }
    }

    populateModelDropdowns() {
        // Searchable select'leri etkinleştir
        this.enableSearchableSelects();
        
        // Model listelerini doldur
        this.populateModelList('white', this.availableModels);
        this.populateModelList('black', this.availableModels);

        // Varsayılan seçimleri yap (eğer varsa)
        const defaultModel = this.availableModels.find(m => 
            m.id.includes('gpt-5') || m.id.includes('gpt-4')
        );
        
        if (defaultModel) {
            this.selectModel('white', defaultModel);
            this.selectModel('black', defaultModel);
        }
    }

    enableSearchableSelects() {
        // Selected model kutularını etkinleştir
        const whiteSelected = document.getElementById('whiteSelectedModel');
        const blackSelected = document.getElementById('blackSelectedModel');
        
        whiteSelected.classList.remove('disabled');
        blackSelected.classList.remove('disabled');
        
        // Search input'ları etkinleştir
        const whiteSearchInput = document.querySelector('#whiteModelDropdown .model-search-input');
        const blackSearchInput = document.querySelector('#blackModelDropdown .model-search-input');
        
        whiteSearchInput.disabled = false;
        blackSearchInput.disabled = false;
        
        // Metinleri güncelle
        whiteSelected.querySelector('.model-name').textContent = 'Model Seçin...';
        blackSelected.querySelector('.model-name').textContent = 'Model Seçin...';
    }

    populateModelList(color, models) {
        const modelList = document.getElementById(`${color}ModelList`);
        
        if (models.length === 0) {
            modelList.innerHTML = '<div class="no-models">Model bulunamadı</div>';
            return;
        }

        modelList.innerHTML = '';
        
        models.forEach(model => {
            const formattedName = this.openRouterAPI.formatModelName(model);
            
            const modelItem = document.createElement('div');
            modelItem.className = 'model-item';
            modelItem.dataset.modelId = model.id;
            
            // Seçili modeli vurgula
            if (this.selectedModels[color]?.id === model.id) {
                modelItem.classList.add('selected');
            }
            
            modelItem.innerHTML = `
                <div class="model-title">${formattedName}</div>
                <div class="model-id">${model.id}</div>
            `;
            
            modelItem.addEventListener('click', () => {
                this.selectModel(color, model);
                this.closeDropdown(color);
            });
            
            modelList.appendChild(modelItem);
        });
    }

    selectModel(color, model) {
        this.selectedModels[color] = model;
        
        // Seçili model UI'sini güncelle
        const selectedModel = document.getElementById(`${color}SelectedModel`);
        const modelName = selectedModel.querySelector('.model-name');
        const formattedName = this.openRouterAPI.formatModelName(model);
        
        modelName.textContent = formattedName;
        modelName.title = model.id; // Tooltip için tam ID
        
        // AI oyuncuları güncelle
        this.updateAIPlayers();
        
        // Model listesindeki seçimi güncelle
        if (this.availableModels.length > 0) {
            this.populateModelList(color, this.availableModels);
        }
    }

    async startGame() {
        const apiKey = document.getElementById('apiKey').value.trim();
        const whiteModelId = this.selectedModels.white?.id;
        const blackModelId = this.selectedModels.black?.id;

        if (!apiKey) {
            alert('Lütfen OpenRouter API anahtarınızı girin.');
            return;
        }

        if (this.availableModels.length === 0) {
            alert('Önce "Modelleri Yükle" butonuna tıklayarak modelleri yükleyin.');
            return;
        }

        if (!whiteModelId || !blackModelId) {
            alert('Lütfen her iki takım için de AI modeli seçin.');
            return;
        }

        // AI oyuncuları ayarla
        this.aiManager.setWhiteAI(apiKey, whiteModelId);
        this.aiManager.setBlackAI(apiKey, blackModelId);

        // Aynı model seçiliyse ve biri 404 veriyorsa fallback için uyarı günlüğü
        if (whiteModelId === blackModelId) {
            console.log('ℹ️ Her iki taraf için aynı model seçildi. Gerekirse otomatik fallback devreye girecek.');
        }

        // Oyunu başlat
        this.gameRunning = true;
        this.autoPlay = true;
        
        // UI güncelle
        document.getElementById('startGame').disabled = true;
        document.getElementById('pauseGame').disabled = false;
        document.getElementById('gameStatusText').textContent = 'Oyun başladı - AI vs AI';
        
        // Başarı mesajı göster
        const whiteModelName = this.selectedModels.white?.id || 'Unknown';
        const blackModelName = this.selectedModels.black?.id || 'Unknown';
        this.showGameMessage(`Oyun başladı! ${whiteModelName.split('/').pop()} vs ${blackModelName.split('/').pop()}`, 'success');
        
        // İlk hamleyi başlat
        this.playNextMove();
    }

    pauseGame() {
        this.autoPlay = false;
        document.getElementById('startGame').disabled = false;
        document.getElementById('pauseGame').disabled = true;
        document.getElementById('gameStatusText').textContent = 'Oyun duraklatıldı';
        
        const moveCount = Math.ceil(this.game.moveHistory.length / 2);
        this.showGameMessage(`Oyun duraklatıldı (${moveCount} hamle)`, 'info');
    }

    resetGame() {
        this.game = new ChessGame();
        this.gameRunning = false;
        this.autoPlay = false;
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.manualPlayEnabled = false;
        
        // UI'yi sıfırla
        document.getElementById('startGame').disabled = false;
        document.getElementById('pauseGame').disabled = true;
        document.getElementById('gameStatusText').textContent = 'Oyun sıfırlandı';
        document.getElementById('moveHistory').innerHTML = '';
        
        // Mesajları temizle
        const messageContainer = document.getElementById('gameMessages');
        if (messageContainer) {
            messageContainer.innerHTML = '';
        }
        
        this.updateChessBoard();
        this.updateGameInfo();
        
        this.showGameMessage('Oyun tahtası sıfırlandı', 'info', 2000);
    }

    async playNextMove() {
        if (!this.autoPlay || !this.gameRunning || this.game.gameStatus !== 'active') {
            return;
        }

        if (!this.aiManager.canMakeMove()) {
            // AI hala düşünüyor, biraz bekle
            setTimeout(() => this.playNextMove(), 500);
            return;
        }

        try {
            // Hamle öncesi oyun durumunu logla
            console.log(`🎮 Hamle ${Math.ceil(this.game.moveHistory.length / 2 + 1)}: ${this.game.currentPlayer} sırası`);
            
            const success = await this.aiManager.makeAIMove(this.game);
            
            if (success) {
                // Hamle başarılı mesajı
                const moveCount = Math.ceil(this.game.moveHistory.length / 2);
                const currentPlayer = this.game.currentPlayer === 'white' ? 'Siyah' : 'Beyaz'; // Sıra değişti
                
                // Oyun durumunu kontrol et
                if (this.game.gameStatus !== 'active') {
                    this.endGame();
                    return;
                }
                
                // Şah durumunu kontrol et ve bildir
                if (this.game.isKingInCheck[this.game.currentPlayer]) {
                    const playerInCheck = this.game.currentPlayer === 'white' ? 'Beyaz' : 'Siyah';
                    this.showGameMessage(`${playerInCheck} şah! Hamle ${moveCount}`, 'warning', 2000);
                }
                
                // Sonraki hamleye geç
                setTimeout(() => this.playNextMove(), 1200);
            } else {
                console.error('AI hamle yapamadı');
                this.showGameMessage('AI hamle yapamadı, oyun duraklatıldı', 'error');
                this.pauseGame();
            }
        } catch (error) {
            console.error('Hamle hatası:', error);
            this.showGameMessage(`Hata: ${error.message}`, 'error');
            this.pauseGame();
        }
    }

    endGame() {
        this.autoPlay = false;
        this.gameRunning = false;
        
        let statusText = '';
        let messageType = 'info';
        const aiInfo = this.aiManager.getAIInfo();
        
        switch (this.game.gameStatus) {
            case 'white_wins':
                statusText = `Beyaz kazandı! (Mat) - ${aiInfo.white || 'AI'}`;
                messageType = 'success';
                break;
            case 'black_wins':
                statusText = `Siyah kazandı! (Mat) - ${aiInfo.black || 'AI'}`;
                messageType = 'success';
                break;
            case 'stalemate':
                statusText = 'Berabere! (Pat)';
                messageType = 'warning';
                break;
            default:
                statusText = 'Oyun bitti';
        }
        
        document.getElementById('gameStatusText').textContent = statusText;
        document.getElementById('startGame').disabled = false;
        document.getElementById('pauseGame').disabled = true;
        
        // Oyun istatistiklerini göster
        const moveCount = Math.ceil(this.game.moveHistory.length / 2);
        this.showGameMessage(`Oyun bitti! ${moveCount} hamle oynanı.`, messageType, 5000);
        
        // Kazananı göster
        setTimeout(() => {
            const confirmed = confirm(`${statusText}\n\nYeni oyun başlatmak ister misiniz?`);
            if (confirmed) {
                this.resetGame();
            }
        }, 1000);
    }

    handleSquareClick(row, col) {
        // Manuel oyun devre dışı
        if (!this.manualPlayEnabled) return;
        
        if (this.selectedSquare) {
            // Hamle yapmayı dene
            const success = this.game.makeMove(
                this.selectedSquare.row, 
                this.selectedSquare.col, 
                row, 
                col
            );
            
            if (success) {
                this.updateChessBoard();
                this.updateGameInfo();
                this.updateMoveHistory();
            }
            
            this.clearSelection();
        } else {
            // Taş seç
            const piece = this.game.getPiece(row, col);
            if (piece && piece.color === this.game.currentPlayer) {
                this.selectSquare(row, col);
            }
        }
    }

    selectSquare(row, col) {
        this.selectedSquare = { row, col };
        this.possibleMoves = this.game.getPossibleMoves(row, col);
        this.updateChessBoard();
    }

    clearSelection() {
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.updateChessBoard();
    }

    updateAIPlayers() {
        // AI oyuncuları güncelle (eğer oyun çalışmıyorsa)
        if (!this.gameRunning) {
            const apiKey = document.getElementById('apiKey').value.trim();
            const whiteModelId = this.selectedModels.white?.id;
            const blackModelId = this.selectedModels.black?.id;

            if (apiKey && whiteModelId && blackModelId) {
                this.aiManager.setWhiteAI(apiKey, whiteModelId);
                this.aiManager.setBlackAI(apiKey, blackModelId);
            }
        }
    }

    updateChessBoard() {
        const squares = document.querySelectorAll('.chess-square');
        
        // Tüm kareleri temizle
        squares.forEach(square => {
            square.innerHTML = '';
            square.classList.remove('highlight', 'possible-move', 'last-move');
        });

        // Taşları yerleştir
        const boardState = this.game.getBoardState();
        boardState.forEach(({ row, col, symbol }) => {
            const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (square) {
                const piece = document.createElement('span');
                piece.className = 'chess-piece';
                piece.textContent = symbol;
                square.appendChild(piece);
            }
        });

        // Seçili kareyi vurgula
        if (this.selectedSquare) {
            const selectedElement = document.querySelector(
                `[data-row="${this.selectedSquare.row}"][data-col="${this.selectedSquare.col}"]`
            );
            if (selectedElement) {
                selectedElement.classList.add('highlight');
            }
        }

        // Mümkün hamleleri göster
        this.possibleMoves.forEach(move => {
            const square = document.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`);
            if (square) {
                square.classList.add('possible-move');
            }
        });

        // Son hamleyi vurgula
        if (this.game.lastMove) {
            const fromSquare = document.querySelector(
                `[data-row="${this.game.lastMove.fromRow}"][data-col="${this.game.lastMove.fromCol}"]`
            );
            const toSquare = document.querySelector(
                `[data-row="${this.game.lastMove.toRow}"][data-col="${this.game.lastMove.toCol}"]`
            );
            
            if (fromSquare) fromSquare.classList.add('last-move');
            if (toSquare) toSquare.classList.add('last-move');
        }
    }

    updateGameInfo() {
        const currentPlayerText = document.getElementById('currentPlayerText');
        const gameStatusText = document.getElementById('gameStatusText');
        const moveCountText = document.getElementById('moveCountText');

        if (currentPlayerText) {
            const playerName = this.game.currentPlayer === 'white' ? 'Beyaz' : 'Siyah';
            const aiInfo = this.aiManager.getAIInfo();
            const modelId = this.game.currentPlayer === 'white' ? aiInfo.white : aiInfo.black;
            const modelLabel = modelId || (this.selectedModels[this.game.currentPlayer]?.id) || 'AI';
            currentPlayerText.textContent = `Sıra: ${playerName} (${modelLabel})`;
        }

        if (gameStatusText && !this.gameRunning) {
            let status = 'Oyun başlamadı';
            if (this.game.isKingInCheck[this.game.currentPlayer]) {
                status = `${this.game.currentPlayer === 'white' ? 'Beyaz' : 'Siyah'} şah!`;
            }
            gameStatusText.textContent = status;
        }

        if (moveCountText) {
            moveCountText.textContent = `Hamle: ${Math.ceil(this.game.moveHistory.length / 2)}`;
        }
    }

    updateMoveHistory() {
        const moveHistory = document.getElementById('moveHistory');
        if (!moveHistory) return;

        moveHistory.innerHTML = '';

        for (let i = 0; i < this.game.moveHistory.length; i += 2) {
            const moveNumber = Math.floor(i / 2) + 1;
            const whiteMove = this.game.moveHistory[i] || '';
            const blackMove = this.game.moveHistory[i + 1] || '';

            const moveItem = document.createElement('div');
            moveItem.className = 'move-item';
            moveItem.innerHTML = `
                <span class="move-number">${moveNumber}.</span>
                <span class="white-move">${whiteMove}</span>
                <span class="black-move">${blackMove}</span>
            `;
            
            moveHistory.appendChild(moveItem);
        }

        // En son hamleye scroll
        moveHistory.scrollTop = moveHistory.scrollHeight;
    }

    showGameMessage(message, type = 'info', duration = 3000) {
        // Mesaj container'ı oluştur veya bul
        let messageContainer = document.getElementById('gameMessages');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'gameMessages';
            messageContainer.className = 'game-messages';
            document.querySelector('.container').appendChild(messageContainer);
        }

        // Mesaj elementi oluştur
        const messageEl = document.createElement('div');
        messageEl.className = `game-message game-message-${type}`;
        messageEl.textContent = message;

        // Mesajı ekle
        messageContainer.appendChild(messageEl);

        // Animasyon için kısa bekle
        setTimeout(() => {
            messageEl.classList.add('show');
        }, 10);

        // Belirtilen süre sonra kaldır
        setTimeout(() => {
            messageEl.classList.remove('show');
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, duration);
    }
}

// Global fonksiyonlar (AI Manager için)
window.updateChessBoard = function(game) {
    if (window.chessApp) {
        window.chessApp.game = game;
        window.chessApp.updateChessBoard();
    }
};

window.updateGameInfo = function(game) {
    if (window.chessApp) {
        window.chessApp.game = game;
        window.chessApp.updateGameInfo();
    }
};

window.updateMoveHistory = function(game) {
    if (window.chessApp) {
        window.chessApp.game = game;
        window.chessApp.updateMoveHistory();
    }
};

// Sayfa yüklendiğinde uygulamayı başlat
document.addEventListener('DOMContentLoaded', () => {
    window.chessApp = new ChessApp();
});

// Hata yakalama
window.addEventListener('error', (e) => {
    console.error('Uygulama hatası:', e.error);
});

// API anahtarı gizlilik kontrolü
document.addEventListener('DOMContentLoaded', () => {
    const apiInput = document.getElementById('apiKey');
    if (apiInput) {
        // Güvenlik için değeri sakla
        let realValue = '';
        
        apiInput.addEventListener('input', (e) => {
            realValue = e.target.value;
        });
        
        // Değeri almak için global fonksiyon
        window.getApiKey = () => realValue;
    }
});
