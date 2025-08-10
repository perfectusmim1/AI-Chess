// Satranç oyunu mantığı

class ChessGame {
    constructor() {
        this.board = this.initializeBoard();
        this.currentPlayer = 'white';
        this.moveHistory = [];
        this.gameStatus = 'active';
        this.lastMove = null;
        this.isKingInCheck = { white: false, black: false };
        
        // Unicode satranç taşları
        this.pieces = {
            white: {
                king: '♔',
                queen: '♕',
                rook: '♖',
                bishop: '♗',
                knight: '♘',
                pawn: '♙'
            },
            black: {
                king: '♚',
                queen: '♛',
                rook: '♜',
                bishop: '♝',
                knight: '♞',
                pawn: '♟'
            }
        };

        // Rokad durumları
        this.castlingRights = {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };

        // En passant
        this.enPassantTarget = null;
    }

    initializeBoard() {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        // Siyah taşlar
        board[0] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'].map(piece => ({ piece, color: 'black' }));
        board[1] = Array(8).fill({ piece: 'pawn', color: 'black' });
        
        // Beyaz taşlar
        board[7] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'].map(piece => ({ piece, color: 'white' }));
        board[6] = Array(8).fill({ piece: 'pawn', color: 'white' });
        
        return board;
    }

    getPiece(row, col) {
        if (row < 0 || row > 7 || col < 0 || col > 7) return null;
        return this.board[row][col];
    }

    setPiece(row, col, piece) {
        if (row >= 0 && row <= 7 && col >= 0 && col <= 7) {
            this.board[row][col] = piece;
        }
    }

    isValidSquare(row, col) {
        return row >= 0 && row <= 7 && col >= 0 && col <= 7;
    }

    isOwnPiece(row, col, color) {
        const piece = this.getPiece(row, col);
        return piece && piece.color === color;
    }

    isEnemyPiece(row, col, color) {
        const piece = this.getPiece(row, col);
        return piece && piece.color !== color;
    }

    isEmpty(row, col) {
        return this.getPiece(row, col) === null;
    }

    // Taş hareket kuralları
    getPossibleMoves(fromRow, fromCol) {
        const piece = this.getPiece(fromRow, fromCol);
        if (!piece || piece.color !== this.currentPlayer) return [];

        let moves = [];
        
        switch (piece.piece) {
            case 'pawn':
                moves = this.getPawnMoves(fromRow, fromCol, piece.color);
                break;
            case 'rook':
                moves = this.getRookMoves(fromRow, fromCol, piece.color);
                break;
            case 'knight':
                moves = this.getKnightMoves(fromRow, fromCol, piece.color);
                break;
            case 'bishop':
                moves = this.getBishopMoves(fromRow, fromCol, piece.color);
                break;
            case 'queen':
                moves = this.getQueenMoves(fromRow, fromCol, piece.color);
                break;
            case 'king':
                moves = this.getKingMoves(fromRow, fromCol, piece.color);
                break;
        }

        // Şaha giren hamleleri filtrele
        return moves.filter(move => !this.wouldBeInCheck(fromRow, fromCol, move.row, move.col, piece.color));
    }

    getPawnMoves(row, col, color) {
        const moves = [];
        const direction = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;

        // İleri hareket
        if (this.isEmpty(row + direction, col)) {
            moves.push({ row: row + direction, col });
            
            // İlk hamlede 2 kare
            if (row === startRow && this.isEmpty(row + 2 * direction, col)) {
                moves.push({ row: row + 2 * direction, col });
            }
        }

        // Çapraz alma
        for (const colOffset of [-1, 1]) {
            const newCol = col + colOffset;
            if (this.isValidSquare(row + direction, newCol)) {
                if (this.isEnemyPiece(row + direction, newCol, color)) {
                    moves.push({ row: row + direction, col: newCol });
                }
                // En passant
                if (this.enPassantTarget && 
                    this.enPassantTarget.row === row + direction && 
                    this.enPassantTarget.col === newCol) {
                    moves.push({ row: row + direction, col: newCol, isEnPassant: true });
                }
            }
        }

        return moves;
    }

    getRookMoves(row, col, color) {
        const moves = [];
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

        for (const [dRow, dCol] of directions) {
            for (let i = 1; i < 8; i++) {
                const newRow = row + i * dRow;
                const newCol = col + i * dCol;

                if (!this.isValidSquare(newRow, newCol)) break;

                if (this.isEmpty(newRow, newCol)) {
                    moves.push({ row: newRow, col: newCol });
                } else if (this.isEnemyPiece(newRow, newCol, color)) {
                    moves.push({ row: newRow, col: newCol });
                    break;
                } else {
                    break;
                }
            }
        }

        return moves;
    }

    getKnightMoves(row, col, color) {
        const moves = [];
        const knightMoves = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];

        for (const [dRow, dCol] of knightMoves) {
            const newRow = row + dRow;
            const newCol = col + dCol;

            if (this.isValidSquare(newRow, newCol) && 
                (this.isEmpty(newRow, newCol) || this.isEnemyPiece(newRow, newCol, color))) {
                moves.push({ row: newRow, col: newCol });
            }
        }

        return moves;
    }

    getBishopMoves(row, col, color) {
        const moves = [];
        const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

        for (const [dRow, dCol] of directions) {
            for (let i = 1; i < 8; i++) {
                const newRow = row + i * dRow;
                const newCol = col + i * dCol;

                if (!this.isValidSquare(newRow, newCol)) break;

                if (this.isEmpty(newRow, newCol)) {
                    moves.push({ row: newRow, col: newCol });
                } else if (this.isEnemyPiece(newRow, newCol, color)) {
                    moves.push({ row: newRow, col: newCol });
                    break;
                } else {
                    break;
                }
            }
        }

        return moves;
    }

    getQueenMoves(row, col, color) {
        return [...this.getRookMoves(row, col, color), ...this.getBishopMoves(row, col, color)];
    }

    getKingMoves(row, col, color) {
        const moves = [];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];

        for (const [dRow, dCol] of directions) {
            const newRow = row + dRow;
            const newCol = col + dCol;

            if (this.isValidSquare(newRow, newCol) && 
                (this.isEmpty(newRow, newCol) || this.isEnemyPiece(newRow, newCol, color))) {
                moves.push({ row: newRow, col: newCol });
            }
        }

        // Rokad
        if (this.canCastle(color, 'kingside')) {
            moves.push({ row, col: col + 2, isCastling: 'kingside' });
        }
        if (this.canCastle(color, 'queenside')) {
            moves.push({ row, col: col - 2, isCastling: 'queenside' });
        }

        return moves;
    }

    canCastle(color, side) {
        if (!this.castlingRights[color][side] || this.isKingInCheck[color]) {
            return false;
        }

        const row = color === 'white' ? 7 : 0;
        const kingCol = 4;
        const rookCol = side === 'kingside' ? 7 : 0;
        const direction = side === 'kingside' ? 1 : -1;

        // Kale ve kral yerinde mi?
        const king = this.getPiece(row, kingCol);
        const rook = this.getPiece(row, rookCol);
        
        if (!king || king.piece !== 'king' || king.color !== color ||
            !rook || rook.piece !== 'rook' || rook.color !== color) {
            return false;
        }

        // Aralarındaki kareler boş mu?
        const endCol = side === 'kingside' ? 6 : 2;
        const startCol = Math.min(kingCol, endCol);
        const end = Math.max(kingCol, endCol);

        for (let col = startCol + 1; col < end; col++) {
            if (!this.isEmpty(row, col)) return false;
        }

        // Kral geçeceği kareler şah altında mı?
        for (let col = kingCol; col !== endCol + direction; col += direction) {
            if (this.isSquareAttacked(row, col, color === 'white' ? 'black' : 'white')) {
                return false;
            }
        }

        return true;
    }

    // Şah kontrolü
    isSquareAttacked(row, col, byColor) {
        // Bu kareye saldıran belirtilen renkteki taş var mı?
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.getPiece(r, c);
                if (piece && piece.color === byColor) {
                    const moves = this.getRawMoves(r, c, piece);
                    if (moves.some(move => move.row === row && move.col === col)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    getRawMoves(row, col, piece) {
        // Şah kontrolü yapmadan ham hamleleri döndür
        switch (piece.piece) {
            case 'pawn': return this.getRawPawnMoves(row, col, piece.color);
            case 'rook': return this.getRookMoves(row, col, piece.color);
            case 'knight': return this.getKnightMoves(row, col, piece.color);
            case 'bishop': return this.getBishopMoves(row, col, piece.color);
            case 'queen': return this.getQueenMoves(row, col, piece.color);
            case 'king': return this.getRawKingMoves(row, col, piece.color);
            default: return [];
        }
    }

    getRawPawnMoves(row, col, color) {
        const moves = [];
        const direction = color === 'white' ? -1 : 1;

        // Sadece çapraz saldırılar
        for (const colOffset of [-1, 1]) {
            const newRow = row + direction;
            const newCol = col + colOffset;
            if (this.isValidSquare(newRow, newCol)) {
                moves.push({ row: newRow, col: newCol });
            }
        }
        return moves;
    }

    getRawKingMoves(row, col, color) {
        const moves = [];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];

        for (const [dRow, dCol] of directions) {
            const newRow = row + dRow;
            const newCol = col + dCol;
            if (this.isValidSquare(newRow, newCol)) {
                moves.push({ row: newRow, col: newCol });
            }
        }
        return moves;
    }

    wouldBeInCheck(fromRow, fromCol, toRow, toCol, color) {
        // Geçici olarak hamleyi yap
        const originalPiece = this.getPiece(toRow, toCol);
        const movingPiece = this.getPiece(fromRow, fromCol);
        
        this.setPiece(toRow, toCol, movingPiece);
        this.setPiece(fromRow, fromCol, null);

        // Kral pozisyonunu bul
        let kingRow, kingCol;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.getPiece(r, c);
                if (piece && piece.piece === 'king' && piece.color === color) {
                    kingRow = r;
                    kingCol = c;
                    break;
                }
            }
        }

        const inCheck = this.isSquareAttacked(kingRow, kingCol, color === 'white' ? 'black' : 'white');

        // Hamleyi geri al
        this.setPiece(fromRow, fromCol, movingPiece);
        this.setPiece(toRow, toCol, originalPiece);

        return inCheck;
    }

    // Hamle yapma
    makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.getPiece(fromRow, fromCol);
        if (!piece || piece.color !== this.currentPlayer) return false;

        const possibleMoves = this.getPossibleMoves(fromRow, fromCol);
        const move = possibleMoves.find(m => m.row === toRow && m.col === toCol);
        
        if (!move) return false;

        // Hamleyi kaydet
        const moveNotation = this.getMoveNotation(fromRow, fromCol, toRow, toCol, move);
        
        // Özel hamleler
        if (move.isEnPassant) {
            // En passant ile alınan piyonu kaldır
            const capturedRow = piece.color === 'white' ? toRow + 1 : toRow - 1;
            this.setPiece(capturedRow, toCol, null);
        }

        if (move.isCastling) {
            // Kaleyi de hareket ettir
            const rookFromCol = move.isCastling === 'kingside' ? 7 : 0;
            const rookToCol = move.isCastling === 'kingside' ? 5 : 3;
            const rook = this.getPiece(fromRow, rookFromCol);
            this.setPiece(fromRow, rookToCol, rook);
            this.setPiece(fromRow, rookFromCol, null);
        }

        // Normal hamle
        this.setPiece(toRow, toCol, piece);
        this.setPiece(fromRow, fromCol, null);

        // Promosyon kontrolü
        if (piece.piece === 'pawn' && (toRow === 0 || toRow === 7)) {
            this.setPiece(toRow, toCol, { piece: 'queen', color: piece.color });
            moveNotation += '=Q';
        }

        // En passant hedef güncelle
        this.enPassantTarget = null;
        if (piece.piece === 'pawn' && Math.abs(fromRow - toRow) === 2) {
            this.enPassantTarget = { row: (fromRow + toRow) / 2, col: fromCol };
        }

        // Rokad haklarını güncelle
        if (piece.piece === 'king') {
            this.castlingRights[piece.color].kingside = false;
            this.castlingRights[piece.color].queenside = false;
        }
        if (piece.piece === 'rook') {
            if (fromCol === 0) this.castlingRights[piece.color].queenside = false;
            if (fromCol === 7) this.castlingRights[piece.color].kingside = false;
        }

        // Son hamleyi kaydet
        this.lastMove = { fromRow, fromCol, toRow, toCol };
        this.moveHistory.push(moveNotation);

        // Sırayı değiştir
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';

        // Oyun durumunu kontrol et
        this.updateGameStatus();

        return true;
    }

    getMoveNotation(fromRow, fromCol, toRow, toCol, move) {
        const piece = this.getPiece(fromRow, fromCol);
        const target = this.getPiece(toRow, toCol);
        const files = 'abcdefgh';
        
        let notation = '';
        
        if (move.isCastling) {
            return move.isCastling === 'kingside' ? 'O-O' : 'O-O-O';
        }

        if (piece.piece !== 'pawn') {
            notation += piece.piece.charAt(0).toUpperCase();
        }

        notation += files[fromCol] + (8 - fromRow);
        
        if (target || move.isEnPassant) {
            notation += 'x';
        } else {
            notation += '-';
        }
        
        notation += files[toCol] + (8 - toRow);

        return notation;
    }

    updateGameStatus() {
        // Şah kontrolü
        this.isKingInCheck = {
            white: this.isKingInCheckStatus('white'),
            black: this.isKingInCheckStatus('black')
        };

        // Mat ve pat kontrolü
        const hasLegalMoves = this.hasLegalMoves(this.currentPlayer);
        
        if (!hasLegalMoves) {
            if (this.isKingInCheck[this.currentPlayer]) {
                this.gameStatus = this.currentPlayer === 'white' ? 'black_wins' : 'white_wins';
            } else {
                this.gameStatus = 'stalemate';
            }
        }
    }

    isKingInCheckStatus(color) {
        // Kralın pozisyonunu bul
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.getPiece(r, c);
                if (piece && piece.piece === 'king' && piece.color === color) {
                    return this.isSquareAttacked(r, c, color === 'white' ? 'black' : 'white');
                }
            }
        }
        return false;
    }

    hasLegalMoves(color) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.getPiece(r, c);
                if (piece && piece.color === color) {
                    const moves = this.getPossibleMoves(r, c);
                    if (moves.length > 0) return true;
                }
            }
        }
        return false;
    }

    // Satranç tahtasını FEN formatında export et
    toFEN() {
        let fen = '';
        
        for (let row = 0; row < 8; row++) {
            let emptyCount = 0;
            
            for (let col = 0; col < 8; col++) {
                const piece = this.getPiece(row, col);
                
                if (piece) {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    
                    let pieceChar = piece.piece.charAt(0);
                    if (piece.piece === 'knight') pieceChar = 'n';
                    
                    fen += piece.color === 'white' ? pieceChar.toUpperCase() : pieceChar.toLowerCase();
                } else {
                    emptyCount++;
                }
            }
            
            if (emptyCount > 0) {
                fen += emptyCount;
            }
            
            if (row < 7) fen += '/';
        }
        
        fen += ' ' + (this.currentPlayer === 'white' ? 'w' : 'b');
        
        return fen;
    }

    // UI güncellemesi için board durumunu döndür
    getBoardState() {
        const state = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.getPiece(row, col);
                if (piece) {
                    state.push({
                        row,
                        col,
                        piece: piece.piece,
                        color: piece.color,
                        symbol: this.pieces[piece.color][piece.piece]
                    });
                }
            }
        }
        return state;
    }
}
