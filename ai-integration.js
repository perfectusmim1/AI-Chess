// OpenRouter AI entegrasyonu

class OpenRouterAPI {
    constructor() {
        this.baseUrl = 'https://openrouter.ai/api/v1';
    }

    async fetchModels(apiKey) {
        try {
            console.log('🌐 OpenRouter\'dan modeller yükleniyor...');
            
            let url = `${this.baseUrl}/models`;
            const headers = {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'AI Chess Game',
                'User-Agent': 'Mozilla/5.0 (Chess Game)',
                'Accept': 'application/json'
            };

            const all = [];
            let guard = 0;
            let totalFetched = 0;
            
            while (url && guard < 15) { // Daha fazla sayfa için limit artırıldı
                console.log(`📄 Sayfa ${guard + 1} yükleniyor...`);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 saniye timeout
                
                try {
                    const response = await fetch(url, { 
                        method: 'GET', 
                        headers,
                        signal: controller.signal 
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (!response.ok) {
                        let errorText = '';
                        try {
                            errorText = await response.text();
                        } catch (e) {
                            errorText = response.statusText;
                        }
                        
                        if (response.status === 401) {
                            throw new Error('Geçersiz API anahtarı');
                        } else if (response.status === 429) {
                            throw new Error('Çok fazla istek, lütfen bekleyin');
                        } else if (response.status >= 500) {
                            throw new Error('OpenRouter sunucu hatası');
                        }
                        
                        throw new Error(`API Hatası: ${response.status} - ${errorText}`);
                    }
                    
                    const data = await response.json();
                    const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
                    
                    all.push(...items);
                    totalFetched += items.length;
                    console.log(`✅ ${items.length} model yüklendi (Toplam: ${totalFetched})`);
                    
                    url = data?.next || data?.links?.next || data?.meta?.next || null;
                    guard += 1;
                    
                    // Rate limiting için kısa bekle
                    if (url) {
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                    
                } catch (fetchError) {
                    clearTimeout(timeoutId);
                    
                    if (fetchError.name === 'AbortError') {
                        throw new Error('Model yükleme zaman aşımına uğradı');
                    }
                    throw fetchError;
                }
            }

            console.log(`🎯 Toplam ${totalFetched} model yüklendi, filtreleniyor...`);
            const filtered = this.filterAndSortModels(all);
            console.log(`✨ ${filtered.length} uygun model bulundu`);
            
            return filtered;
        } catch (error) {
            console.error('🔥 Model fetch hatası:', error);
            throw error;
        }
    }

    filterAndSortModels(models) {
        console.log(`🔍 ${models.length} model filtreleniyor...`);
        
        // Satranç için uygun modelleri filtrele
        const suitableModels = models.filter(model => {
            const id = (model.id || '').toLowerCase();
            const name = (model.name || '').toLowerCase();
            
            if (!id) return false;
            
            // Görüntü/vision modellerini exclude et
            if (id.includes('image') || id.includes('vision') || id.includes('dalle') || 
                id.includes('midjourney') || id.includes('stable-diffusion') ||
                name.includes('image') || name.includes('vision')) {
                return false;
            }
            
            // Embed modellerini exclude et
            if (id.includes('embed') || id.includes('embedding')) {
                return false;
            }
            
            // Moderation modellerini exclude et
            if (id.includes('moderation') || id.includes('moderate')) {
                return false;
            }
            
            // Çok eski/deprecated modelleri exclude et
            if (id.includes('gpt-3.5-turbo-instruct') || id.includes('text-davinci')) {
                return false;
            }
            
            return true;
        });

        console.log(`✅ ${suitableModels.length} uygun model bulundu`);

        // Öncelik sırasına göre sırala (satranç için en iyi modeller önce)
        return suitableModels.sort((a, b) => {
            const getPriority = (model) => {
                const id = model.id.toLowerCase();
                const name = (model.name || '').toLowerCase();
                
                // En iyi modeller
                if (id.includes('gpt-5') || id.includes('o1-preview') || id.includes('o1-mini')) return 1;
                if (id.includes('gpt-4o') || id.includes('gpt-4-turbo')) return 2;
                if (id.includes('claude-3-opus') || id.includes('claude-3.5-sonnet')) return 3;
                if (id.includes('gpt-4') && !id.includes('vision')) return 4;
                if (id.includes('claude-3-sonnet')) return 5;
                if (id.includes('gemini-pro') || id.includes('gemini-1.5')) return 6;
                if (id.includes('claude-3-haiku')) return 7;
                if (id.includes('llama-3') || id.includes('llama-70b') || id.includes('llama-405b')) return 8;
                if (id.includes('mixtral') || id.includes('mistral')) return 9;
                if (id.includes('gpt-3.5-turbo')) return 10;
                
                // Diğer modeller
                return 15;
            };
            
            const priorityA = getPriority(a);
            const priorityB = getPriority(b);
            
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            
            // Aynı öncelik seviyesinde ise alfabetik sırala
            return a.id.localeCompare(b.id);
        });
    }

    formatModelName(model) {
        // Model ismini daha okunabilir hale getir
        let name = model.name || model.id;
        
        // Ortak kısaltmaları genişlet
        name = name.replace(/gpt-4o/gi, 'GPT-4 Omni');
        name = name.replace(/gpt-4/gi, 'GPT-4');
        name = name.replace(/gpt-5/gi, 'GPT-5');
        name = name.replace(/claude-3-opus/gi, 'Claude 3 Opus');
        name = name.replace(/claude-3-sonnet/gi, 'Claude 3 Sonnet');
        name = name.replace(/claude-3-haiku/gi, 'Claude 3 Haiku');
        name = name.replace(/gemini-pro/gi, 'Gemini Pro');
        name = name.replace(/llama/gi, 'Llama');
        
        // Çok uzun isimleri kısalt
        if (name.length > 50) {
            name = name.substring(0, 47) + '...';
        }
        
        return name;
    }
}

class AIChessPlayer {
    constructor(apiKey, modelName) {
        this.apiKey = apiKey;
        this.modelName = modelName;
        this.baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
                 this.requestTimeoutMs = 20000; // API çağrısı için üst sınır (büyük modeller için artırıldı)
    }

         async makeMove(game) {
         // Geçerli hamle gelene kadar aynı modelden tekrar iste ve feedback ver
         let attempt = 0;
         let lastInvalidMove = null;
         let lastError = null;
         const maxAttempts = 25; // Maksimum deneme sayısı
         
         while (attempt < maxAttempts) {
             attempt++;
             try {
                 const fen = game.toFEN();
                 const boardState = this.getBoardDescription(game);
                 const moveHistory = game.moveHistory.slice(-10);
                 const validMoves = this.getValidMovesDescription(game);

                 const prompt = this.createChessPrompt(fen, boardState, moveHistory, game.currentPlayer, validMoves, lastInvalidMove, lastError, attempt);

                 console.log(`🤖 ${this.modelName} düşünüyor... (Deneme #${attempt})`);
                 const response = await this.callOpenRouter(prompt);
                 console.log(`💭 AI Yanıtı (${this.modelName}):`, response);

                 const move = this.parseAIResponse(response);
                 console.log(`🎯 Parse edilen hamle:`, move);

                 if (move && this.validateMove(game, move)) {
                     console.log(`✅ Geçerli hamle: ${move.from.row},${move.from.col} -> ${move.to.row},${move.to.col}`);
                     return move;
                 }
                 
                 // Geçersiz hamle detayını kaydet
                 lastInvalidMove = move;
                 lastError = move ? "Geçersiz hamle - kurallar ihlal edildi" : "Hamle formatı anlaşılamadı";
                 
                 console.warn(`❌ Geçersiz hamle (Deneme #${attempt}): ${lastError}`);
                 
                 // Her 3 denemede bir kısa bekle, çok fazla deneme varsa daha uzun bekle
                 if (attempt % 3 === 0) {
                     console.log(`⏳ ${attempt} deneme yapıldı, kısa mola...`);
                     await new Promise(r => setTimeout(r, attempt > 15 ? 2000 : 800));
                 }
                 
                 // 10+ denemeden sonra daha agresif feedback ver
                 if (attempt >= 10) {
                     console.warn(`🔥 ${attempt} deneme: Model yanıt vermiyor veya sürekli hatalı hamle yapıyor!`);
                 }
             } catch (error) {
                 lastError = `API hatası: ${error.message}`;
                 console.error(`🔥 AI hamle hatası (Deneme #${attempt}):`, error);
                 await new Promise(r => setTimeout(r, 500));
             }
         }
         
         // Maksimum deneme sayısına ulaşıldıysa fallback olarak random hamle yap
         console.error(`🚨 ${maxAttempts} deneme sonrasında geçerli hamle alınamadı, random hamle yapılıyor...`);
         return this.getRandomMove(game);
     }

    validateMove(game, move) {
        try {
            if (!move || !move.from || !move.to) {
                console.log('❌ Validation failed: Invalid move structure', move);
                return false;
            }
            
            const { from, to } = move;
            
            // Koordinat kontrolü
            if (from.row < 0 || from.row > 7 || from.col < 0 || from.col > 7 ||
                to.row < 0 || to.row > 7 || to.col < 0 || to.col > 7) {
                console.log('❌ Validation failed: Invalid coordinates', {from, to});
                return false;
            }
            
            // Aynı kare kontrolü
            if (from.row === to.row && from.col === to.col) {
                console.log('❌ Validation failed: Same square move', {from, to});
                return false;
            }
            
            // Taş kontrolü
            const piece = game.getPiece(from.row, from.col);
            if (!piece) {
                console.log('❌ Validation failed: No piece at source', from);
                return false;
            }
            
            if (piece.color !== game.currentPlayer) {
                console.log('❌ Validation failed: Wrong color piece', {piece: piece.color, currentPlayer: game.currentPlayer});
                return false;
            }
            
            // Geçerli hamle kontrolü
            const possibleMoves = game.getPossibleMoves(from.row, from.col);
            const isValid = possibleMoves.some(m => m.row === to.row && m.col === to.col);
            
            if (!isValid) {
                console.log('❌ Validation failed: Move not in possible moves', {
                    move: {from, to},
                    possibleMoves: possibleMoves.slice(0, 5),
                    totalPossible: possibleMoves.length
                });
            }
            
            return isValid;
        } catch (error) {
            console.error('🔥 Move validation error:', error);
            return false;
        }
    }

         createChessPrompt(fen, boardState, moveHistory, currentPlayer, validMoves = '', lastInvalidMove = null, lastError = null, attempt = 1) {
         const playerTR = currentPlayer === 'white' ? 'Beyaz' : 'Siyah';
         const playerEN = currentPlayer === 'white' ? 'White' : 'Black';
         
         let prompt = `You are playing chess as ${playerEN}.

BOARD:
${boardState}

FEN: ${fen}
TO MOVE: ${playerEN}
RECENT: ${moveHistory.length > 0 ? moveHistory.slice(-5).join(' ') : 'Start'}`;

         // Geçersiz hamle feedback'i ekle
         if (attempt > 1 && (lastInvalidMove || lastError)) {
             prompt += `\n\n⚠️  PREVIOUS ATTEMPT FAILED (Attempt #${attempt}):`;
             if (lastInvalidMove) {
                 prompt += `\nInvalid move attempted: from:${this.coordsToAlgebraic(lastInvalidMove.from.row, lastInvalidMove.from.col)} to:${this.coordsToAlgebraic(lastInvalidMove.to.row, lastInvalidMove.to.col)}`;
             }
             if (lastError) {
                 prompt += `\nError: ${lastError}`;
             }
             prompt += `\nYou MUST provide a DIFFERENT, LEGAL move this time!`;
         }

         // Geçerli hamleleri ekle (ilk 3 denemede)
         if (attempt <= 3 && validMoves) {
             prompt += `\n\nVALID MOVES AVAILABLE:\n${validMoves}`;
         }

         prompt += `\n\nThink silently about your best move, then respond with ONLY this exact format:

from:e2 to:e4

Examples:
from:e2 to:e4 (pawn)
from:g1 to:f3 (knight)
from:f1 to:c4 (bishop)
from:e1 to:g1 (castle)

CRITICAL RULES: 
- NO explanations, analysis, reasoning, or other text
- ONLY the exact move format: from:X to:Y
- Must be a LEGAL move according to chess rules
- Must be YOUR piece (${playerEN})
- Cannot leave your king in check`;

         if (attempt > 1) {
             prompt += `\n- This is attempt #${attempt} - provide a DIFFERENT valid move!`;
         }

         prompt += `\n\nYour move:`;
         
         return prompt;
     }

    getBoardDescription(game) {
        let description = '\n';
        
        for (let row = 0; row < 8; row++) {
            let rowDesc = `${8-row}: `;
            for (let col = 0; col < 8; col++) {
                const piece = game.getPiece(row, col);
                if (piece) {
                    const symbol = game.pieces[piece.color][piece.piece];
                    rowDesc += symbol + ' ';
                } else {
                    rowDesc += '. ';
                }
            }
            description += rowDesc + '\n';
        }
        
        description += '   a b c d e f g h\n';
        return description;
    }

    getValidMovesDescription(game) {
        try {
            const moves = [];
            const currentPlayer = game.currentPlayer;
            
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    const piece = game.getPiece(row, col);
                    if (piece && piece.color === currentPlayer) {
                        const possibleMoves = game.getPossibleMoves(row, col);
                        const from = this.coordsToAlgebraic(row, col);
                        
                        for (const move of possibleMoves) {
                            const to = this.coordsToAlgebraic(move.row, move.col);
                            moves.push(`from:${from} to:${to}`);
                        }
                    }
                }
            }
            
            if (moves.length === 0) {
                return 'No valid moves available (checkmate or stalemate)';
            }
            
            // İlk 20 hamleyi göster (çok uzun olmasın)
            const displayMoves = moves.slice(0, 20);
            let result = displayMoves.join(', ');
            
            if (moves.length > 20) {
                result += ` ... (${moves.length - 20} more)`;
            }
            
            return result;
        } catch (error) {
            console.error('🔥 Valid moves description hatası:', error);
            return 'Could not determine valid moves';
        }
    }

    async callOpenRouter(prompt) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'AI Chess Game'
                },
                body: JSON.stringify({
                    model: this.modelName,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a chess engine. Respond ONLY with a chess move in this exact format: from:e2 to:e4. No explanations, analysis, reasoning, or other text. Only the move format.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 32000, // Yeterli token limiti
                    temperature: 0.5, // Daha deterministik
                    top_p: 0.8
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                let errorMsg = `OpenRouter API hatası: ${response.status}`;
                
                if (response.status === 401) {
                    errorMsg = 'Geçersiz API anahtarı';
                } else if (response.status === 402) {
                    errorMsg = 'Insufficient credits';
                } else if (response.status === 429) {
                    errorMsg = 'Rate limit exceeded';
                } else if (response.status >= 500) {
                    errorMsg = 'Server error';
                }
                
                if (text) {
                    errorMsg += ` - ${text.slice(0, 100)}`;
                }
                
                const err = new Error(errorMsg);
                err.status = response.status;
                throw err;
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';
            
            // Debug: API yanıt yapısını logla
            if (!content) {
                console.log('🔍 API yanıt debug:', {
                    model: this.modelName,
                    choices_length: data.choices?.length,
                    first_choice: data.choices?.[0],
                    has_message: !!data.choices?.[0]?.message,
                    content_type: typeof content,
                    content_length: content.length,
                    full_data: data
                });
            }
            
            return content;
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error(`Timeout: ${this.modelName} ${this.requestTimeoutMs}ms içinde yanıt vermedi`);
            }
            
            throw error;
        }
    }

         parseAIResponse(response) {
         try {
             console.log('🔍 Parse edilecek response:', response);
             
             // Eğer response boşsa
             if (!response || !response.trim()) {
                 console.log('❌ Boş response');
                 return null;
             }
             
             // Eğer response çok uzunsa son kısmını da kontrol et
             if (response.length > 500) {
                 console.log('📝 Uzun response detected, length:', response.length);
                 console.log('📝 Son 200 karakter:', response.slice(-200));
             }
             
             // Response'u temizle
             const cleanResponse = response.trim().toLowerCase();
             
             // 1. "from:e2 to:e4" formatı (en kesin)
             let moveRegex = /from\s*:\s*([a-h][1-8])\s+to\s*:\s*([a-h][1-8])/i;
             let match = cleanResponse.match(moveRegex);
             
             if (match) {
                 console.log('✅ Format 1 eşleşti (from:X to:Y):', match);
                 return {
                     from: this.algebraicToCoords(match[1]),
                     to: this.algebraicToCoords(match[2])
                 };
             }

             // 2. "from e2 to e4" formatı (: olmadan)
             moveRegex = /from\s+([a-h][1-8])\s+to\s+([a-h][1-8])/i;
             match = cleanResponse.match(moveRegex);
             
             if (match) {
                 console.log('✅ Format 2 eşleşti (from X to Y):', match);
                 return {
                     from: this.algebraicToCoords(match[1]),
                     to: this.algebraicToCoords(match[2])
                 };
             }

             // 3. "e2-e4" veya "e2 to e4" formatı
             moveRegex = /([a-h][1-8])\s*(?:-|to)\s*([a-h][1-8])/i;
             match = cleanResponse.match(moveRegex);
             
             if (match) {
                 console.log('✅ Format 3 eşleşti (X-Y veya X to Y):', match);
                 return {
                     from: this.algebraicToCoords(match[1]),
                     to: this.algebraicToCoords(match[2])
                 };
             }

             // 4. "move e2 to e4" formatı
             moveRegex = /move\s+([a-h][1-8])\s+to\s+([a-h][1-8])/i;
             match = cleanResponse.match(moveRegex);
             
             if (match) {
                 console.log('✅ Format 4 eşleşti (move X to Y):', match);
                 return {
                     from: this.algebraicToCoords(match[1]),
                     to: this.algebraicToCoords(match[2])
                 };
             }

             // 5. "e2e4" formatı (boşluksuz, dikkatli)
             moveRegex = /\b([a-h][1-8])([a-h][1-8])\b/i;
             match = cleanResponse.match(moveRegex);
             
             if (match) {
                 console.log('✅ Format 5 eşleşti (XY):', match);
                 return {
                     from: this.algebraicToCoords(match[1]),
                     to: this.algebraicToCoords(match[2])
                 };
             }

             // 6. Sadece kare isimleri varsa ilk ikisini al
             const squares = cleanResponse.match(/\b[a-h][1-8]\b/gi);
             if (squares && squares.length >= 2) {
                 console.log('✅ Format 6 eşleşti (kare listesi):', squares);
                 return {
                     from: this.algebraicToCoords(squares[0]),
                     to: this.algebraicToCoords(squares[1])
                 };
             }

             console.log('❌ Hiçbir format eşleşmedi. Response uzunluğu:', response.length);
             
             // Debug: Response'da chess terimleri var mı?
             const chessTerms = ['chess', 'move', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king', 'castle', 'check', 'mate'];
             const foundTerms = chessTerms.filter(term => cleanResponse.includes(term));
             if (foundTerms.length > 0) {
                 console.log('🔍 Response\'da bulunan satranç terimleri:', foundTerms);
             }
             
             return null;
         } catch (error) {
             console.error('🔥 Hamle parse hatası:', error);
             return null;
         }
     }

    algebraicToCoords(algebraic) {
        const col = algebraic.charCodeAt(0) - 'a'.charCodeAt(0);
        const row = 8 - parseInt(algebraic[1]);
        return { row, col };
    }

    coordsToAlgebraic(row, col) {
        const file = String.fromCharCode('a'.charCodeAt(0) + col);
        const rank = 8 - row;
        return file + rank;
    }

    getRandomMove(game) {
        try {
            console.log('🎲 Random hamle aranıyor...');
            const allMoves = [];
            
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    const piece = game.getPiece(row, col);
                    if (piece && piece.color === game.currentPlayer) {
                        const moves = game.getPossibleMoves(row, col);
                        console.log(`📍 ${this.coordsToAlgebraic(row, col)} taşı için ${moves.length} hamle`);
                        
                        for (const move of moves) {
                            allMoves.push({
                                from: { row, col },
                                to: { row: move.row, col: move.col }
                            });
                        }
                    }
                }
            }
            
            console.log(`🎯 Toplam ${allMoves.length} geçerli hamle bulundu`);
            
            if (allMoves.length > 0) {
                const randomMove = allMoves[Math.floor(Math.random() * allMoves.length)];
                console.log(`🎲 Seçilen random hamle: ${this.coordsToAlgebraic(randomMove.from.row, randomMove.from.col)} -> ${this.coordsToAlgebraic(randomMove.to.row, randomMove.to.col)}`);
                return randomMove;
            }
            
            console.log('❌ Hiç geçerli hamle bulunamadı!');
            return null;
        } catch (error) {
            console.error('🔥 Random hamle hatası:', error);
            return null;
        }
    }

    // AI düşünme simülasyonu (kısaltıldı)
    async thinkingDelay() {
        const delay = Math.random() * 400 + 200; // 200-600ms
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

// AI Manager sınıfı
class AIManager {
    constructor() {
        this.whiteAI = null;
        this.blackAI = null;
        this.isThinking = false;
    }

    setWhiteAI(apiKey, modelName) {
        this.whiteAI = new AIChessPlayer(apiKey, modelName);
    }

    setBlackAI(apiKey, modelName) {
        this.blackAI = new AIChessPlayer(apiKey, modelName);
    }

    async makeAIMove(game) {
        if (this.isThinking) return false;
        
        this.isThinking = true;
        
        try {
            const currentAI = game.currentPlayer === 'white' ? this.whiteAI : this.blackAI;
            
            if (!currentAI) {
                throw new Error(`${game.currentPlayer} için AI tanımlanmamış`);
            }

            // Düşünme göstergesi
            this.showThinking(true, `${currentAI.modelName} ile hamle hesaplanıyor...`);
            
            // AI düşünme simülasyonu
            await currentAI.thinkingDelay();
            
            console.log(`🎯 ${game.currentPlayer} oyuncusu hamle yapıyor (${currentAI.modelName})`);
            
            // AI'dan hamle al (yalnızca seçilen model; geçersizse AI kendi içinde tekrar dener)
            const move = await currentAI.makeMove(game);
            
            if (move) {
                console.log(`🎯 Alınan hamle:`, move);
                
                // Hamleyi yap
                const success = game.makeMove(move.from.row, move.from.col, move.to.row, move.to.col);
                
                if (success) {
                    console.log(`✅ Hamle başarıyla yapıldı!`);
                    // UI'yi güncelle
                    this.updateUI(game);
                    return true;
                } else {
                    console.error('❌ Game.makeMove() başarısız:', move);
                    return false;
                }
            } else {
                console.error('❌ AI hiç hamle döndürmedi!');
                return false;
            }
        } catch (error) {
            console.error('🔥 AI Manager hatası:', error);
            return false;
        } finally {
            this.isThinking = false;
            this.showThinking(false);
        }
    }

    showThinking(show, details = '') {
        const indicator = document.getElementById('thinkingIndicator');
        const thinkingText = document.getElementById('thinkingText');
        const thinkingDetails = document.getElementById('thinkingDetails');
        
        if (indicator) {
            if (show) {
                indicator.classList.add('show');
                const currentAI = this.getCurrentAI();
                const playerName = this.getCurrentPlayerName();
                
                if (thinkingText) {
                    thinkingText.textContent = `${playerName} düşünüyor... (${currentAI})`;
                }
                
                if (thinkingDetails && details) {
                    thinkingDetails.textContent = details;
                    thinkingDetails.style.display = 'block';
                } else if (thinkingDetails) {
                    thinkingDetails.style.display = 'none';
                }
            } else {
                indicator.classList.remove('show');
                if (thinkingDetails) {
                    thinkingDetails.style.display = 'none';
                }
            }
        }
    }

    getCurrentAI() {
        if (!window.chessApp) return 'AI';
        const game = window.chessApp.game;
        const aiInfo = this.getAIInfo();
        const modelId = game.currentPlayer === 'white' ? aiInfo.white : aiInfo.black;
        return modelId ? modelId.split('/').pop() : 'AI';
    }

    getCurrentPlayerName() {
        if (!window.chessApp) return 'AI';
        const game = window.chessApp.game;
        return game.currentPlayer === 'white' ? 'Beyaz' : 'Siyah';
    }

    updateUI(game) {
        // Ana script'teki fonksiyonu çağır
        if (window.updateChessBoard) {
            window.updateChessBoard(game);
        }
        if (window.updateGameInfo) {
            window.updateGameInfo(game);
        }
        if (window.updateMoveHistory) {
            window.updateMoveHistory(game);
        }
    }

    canMakeMove() {
        return !this.isThinking;
    }

    hasValidAIs() {
        return this.whiteAI && this.blackAI;
    }

    getAIInfo() {
        return {
            white: this.whiteAI ? this.whiteAI.modelName : null,
            black: this.blackAI ? this.blackAI.modelName : null
        };
    }
}
