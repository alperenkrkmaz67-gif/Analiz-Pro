// excelLoader.js - Client-Side Excel Data Loader
// Stores match data using IndexedDB (supports large files 28MB+)

// Global match data storage
window.matchData = [];
window.matchDataClosing = [];
window.matchDataOpening = [];
window.matchDataLoaded = false;
window.currentDataType = 'closing'; // 'closing' or 'opening'

// IndexedDB setup
const DB_NAME = 'ExcelDataDB';
const DB_VERSION = 1;
const STORE_NAME = 'matchData';

// Excel loading and parsing
window.ExcelLoader = {
    // Initialize IndexedDB
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
    },

    // Worker Code Constant to bypass file:// restrictions
    getWorkerBlobUrl() {
        const workerCode = `
            importScripts("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");

            const DB_NAME = 'ExcelDataDB';
            const DB_VERSION = 1;
            const STORE_NAME = 'matchData';

            self.onmessage = async function (e) {
                const { data, mode, dataType } = e.data;

                try {
                    const readOpts = {
                        type: 'array',
                        cellFormula: false,
                        cellHTML: false,
                        cellStyles: false,
                        cellText: false
                    };

                    const workbook = XLSX.read(data, readOpts);
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];

                    const matches = processExcelData(worksheet, dataType);

                    if (mode === 'archive') {
                        // Determine key based on dataType
                        const storageKey = (dataType === 'opening') ? 'matches_opening' : 'matches_closing';
                        await saveToIndexedDB(matches, storageKey, dataType);
                        self.postMessage({ success: true, count: matches.length, mode: 'archive', dataType: dataType });
                    } else if (mode === 'program') {
                        await saveToIndexedDB(matches, 'program_matches');
                        self.postMessage({ success: true, count: matches.length, mode: 'program' });
                    } else {
                        self.postMessage({ success: true, matches: matches });
                    }

                } catch (error) {
                    self.postMessage({ success: false, error: error.message });
                }
            };

            async function initDB() {
                return new Promise((resolve, reject) => {
                    const request = indexedDB.open(DB_NAME, DB_VERSION);
                    request.onerror = () => reject(request.error);
                    request.onsuccess = () => resolve(request.result);
                    request.onupgradeneeded = (event) => {
                        const db = event.target.result;
                        if (!db.objectStoreNames.contains(STORE_NAME)) {
                            db.createObjectStore(STORE_NAME);
                        }
                    };
                });
            }

            async function saveToIndexedDB(data, key, dataType) {
                const db = await initDB();
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);

                const CHUNK_SIZE = 2000;
                const totalItems = data.length;
                const totalChunks = Math.ceil(totalItems / CHUNK_SIZE);

                // Clear old chunks for this specific key
                store.delete(key); 
                
                store.put({ total: totalItems, chunks: totalChunks, type: dataType }, \`\${key}_meta\`);

                for (let i = 0; i < totalChunks; i++) {
                    const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                    store.put(chunk, \`\${key}_\${i}\`);
                }

                // Global Loaded Flags per type
                store.put(true, \`loaded_\${dataType || 'closing'}\`);

                return new Promise((resolve, reject) => {
                    transaction.oncomplete = () => resolve();
                    transaction.onerror = () => reject(transaction.error);
                });
            }

            function processExcelData(worksheet, dataType) {
                const rows = [];
                const range = XLSX.utils.decode_range(worksheet['!ref']);

                for (let R = range.s.r; R <= range.e.r; ++R) {
                    const match = {};
                    let hasData = false;

                    for (let C = range.s.c; C <= range.e.c; ++C) {
                        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                        const cell = worksheet[cellRef];
                        let value = cell ? (cell.v !== undefined ? cell.v : cell.w) : undefined;

                        if (value !== undefined && value !== null && value !== '') {
                            hasData = true;
                            if (C === 0 && typeof value === 'number') value = excelDateToString(value);
                            if (typeof value === 'string' && /^\\d+,\\d+$/.test(value)) value = value.replace(',', '.');
                            match[C] = value;
                        }
                    }

                    if (hasData) mapAndPushRow(match, rows, dataType);
                }
                return filterRows(rows);
            }

            function mapAndPushRow(match, rows, dataType) {
                 // Common Columns (0-13)
                if (!match.date && match[0]) match.date = match[0];
                if (!match.league && match[1]) match.league = match[1];
                if (!match.homeTeam && match[2]) match.homeTeam = match[2];
                if (!match.awayTeam && match[3]) match.awayTeam = match[3];
                if (!match.score_ht && match[4]) match.score_ht = match[4];
                if (!match.score && match[5]) match.score = match[5];

                if (!match.ms1 && match[6]) match.ms1 = match[6];
                if (!match.ms0 && match[7]) match.ms0 = match[7];
                if (!match.ms2 && match[8]) match.ms2 = match[8];
                if (!match.iy1 && match[9]) match.iy1 = match[9];
                if (!match.iy0 && match[10]) match.iy0 = match[10];
                if (!match.iy2 && match[11]) match.iy2 = match[11];
                if (!match.kg_var && match[12]) match.kg_var = match[12];
                if (!match.kg_yok && match[13]) match.kg_yok = match[13];

                 // Ensure indices 14+ are handled correctly
                if (dataType === 'opening') {
                    // --- Opening Odds Mapping (Final User Correction) ---
                    // M(12): KG Var, N(13): KG Yok (Handled in Common Block)
                    // O(14): Handicap 1
                    
                    // 14, 15, 16 -> Handicap (1, 0, 2)
                    if (!match.handicap_1 && match[14]) match.handicap_1 = match[14]; // Col O
                    if (!match.handicap_0 && match[15]) match.handicap_0 = match[15]; // Col P
                    if (!match.handicap_2 && match[16]) match.handicap_2 = match[16]; // Col Q

                    // 17, 18 -> IY 1.5 Alt/Ust
                    if (!match.iy15_alt && match[17]) match.iy15_alt = match[17]; // Col R
                    if (!match.iy15_ust && match[18]) match.iy15_ust = match[18]; // Col S

                    // 19, 20 -> MS 2.5 Alt/Ust
                    if (!match.ms25_alt && match[19]) match.ms25_alt = match[19]; // Col T
                    if (!match.ms25_ust && match[20]) match.ms25_ust = match[20]; // Col U

                    // 21, 22 -> MS 3.5 Alt/Ust
                    if (!match.ms35_alt && match[21]) match.ms35_alt = match[21]; // Col V
                    if (!match.ms35_ust && match[22]) match.ms35_ust = match[22]; // Col W

                    // 23, 24, 25, 26 -> TG (0-1, 2-3, 4-5, 6+)
                    if (!match.tg_01 && match[23]) match.tg_01 = match[23]; // Col X
                    if (!match.tg_23 && match[24]) match.tg_23 = match[24]; // Col Y
                    if (!match.tg_45 && match[25]) match.tg_45 = match[25]; // Col Z
                    if (!match.tg_6plus && match[26]) match.tg_6plus = match[26]; // Col AA

                    // 27-35 -> HT/FT (1/1 ... 2/2)
                    if (!match.htft_11 && match[27]) match.htft_11 = match[27];
                    if (!match.htft_10 && match[28]) match.htft_10 = match[28];
                    if (!match.htft_12 && match[29]) match.htft_12 = match[29];
                    if (!match.htft_01 && match[30]) match.htft_01 = match[30];
                    if (!match.htft_00 && match[31]) match.htft_00 = match[31];
                    if (!match.htft_02 && match[32]) match.htft_02 = match[32];
                    if (!match.htft_21 && match[33]) match.htft_21 = match[33];
                    if (!match.htft_20 && match[34]) match.htft_20 = match[34];
                    if (!match.htft_22 && match[35]) match.htft_22 = match[35];

                } else {
                    // --- Closing Odds Mapping (Default) ---
                    if (!match.cs_1x && match[14]) match.cs_1x = match[14];
                    if (!match.cs_12 && match[15]) match.cs_12 = match[15];
                    if (!match.cs_2x && match[16]) match.cs_2x = match[16];
                    if (!match.iy15_alt && match[17]) match.iy15_alt = match[17];
                    if (!match.iy15_ust && match[18]) match.iy15_ust = match[18];
                    if (!match.ms15_alt && match[19]) match.ms15_alt = match[19];
                    if (!match.ms15_ust && match[20]) match.ms15_ust = match[20];
                    if (!match.ms25_alt && match[21]) match.ms25_alt = match[21];
                    if (!match.ms25_ust && match[22]) match.ms25_ust = match[22];
                    if (!match.ms35_alt && match[23]) match.ms35_alt = match[23];
                    if (!match.ms35_ust && match[24]) match.ms35_ust = match[24];
                    if (!match.tg_01 && match[25]) match.tg_01 = match[25];
                    if (!match.tg_23 && match[26]) match.tg_23 = match[26];
                    if (!match.tg_45 && match[27]) match.tg_45 = match[27];
                    if (!match.tg_6plus && match[28]) match.tg_6plus = match[28];
                }

                match.id = rows.length + 1;
                rows.push(match);
            }

            function filterRows(rows) {
                return rows.filter(m => {
                    const isHeader = (String(m[0]).includes('TARİH') || String(m[0]).includes('Tarih'));
                    const hasData = m.homeTeam || m[2];
                    return !isHeader && hasData;
                });
            }

            function excelDateToString(excelDate) {
                if (typeof excelDate === 'string') return excelDate;
                if (typeof excelDate !== 'number') return excelDate;
                const excelEpoch = new Date(1900, 0, 1);
                const msPerDay = 24 * 60 * 60 * 1000;
                const date = new Date(excelEpoch.getTime() + (excelDate - 2) * msPerDay);
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = String(date.getFullYear()).slice(-2);
                return \`\${day}.\${month}.\${year}\`;
            }
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        return URL.createObjectURL(blob);
    },

    async loadFile(file, dataType = 'closing') {
        if (!file) throw new Error('Lütfen bir dosya seçin!');

        const runOnMainThread = async (data) => {
            console.warn('⚠️ Worker başarısız, ana thread üzerinde işlem yapılıyor...');
            try {
                const readOpts = { type: 'array', cellFormula: false, cellHTML: false, cellStyles: false, cellText: false };
                const workbook = XLSX.read(data, readOpts);
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Helper functions need to be accessible here, so we might need to duplicate or move them
                // For simplicity, we assume they are available or we move processExcelData to scope
                const matches = this.processExcelDataMain(worksheet, dataType); // We will define this helper

                // Save
                const storageKey = (dataType === 'opening') ? 'matches_opening' : 'matches_closing';
                await this.saveToIndexedDBMain(matches, storageKey, dataType); // We will define this helper

                await this.restoreFromIndexedDB();
                return true;
            } catch (err) {
                console.error('Main Thread Hatası:', err);
                throw new Error('Dosya işlenemedi: ' + err.message);
            }
        };

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const data = e.target.result;
                let workerUrl;

                try {
                    workerUrl = this.getWorkerBlobUrl();
                    const worker = new Worker(workerUrl);

                    if (data instanceof ArrayBuffer) {
                        // Do NOT transfer ownership (remove second arg) so we can reuse 'data' if worker fails
                        worker.postMessage({ data: data, mode: 'archive', dataType: dataType });
                    } else {
                        worker.postMessage({ data: data, mode: 'archive', dataType: dataType });
                    }

                    worker.onmessage = async function (e) {
                        const { success, count, error, dataType } = e.data;
                        if (success) {
                            console.log(`✅ ${count} maç (${dataType}) Worker tarafından IndexedDB'ye kaydedildi`);
                            await window.ExcelLoader.restoreFromIndexedDB();
                            worker.terminate();
                            URL.revokeObjectURL(workerUrl);
                            resolve(true);
                        } else {
                            console.error('Worker İşlem Hatası:', error);
                            // Fallback
                            worker.terminate();
                            URL.revokeObjectURL(workerUrl);
                            // We need a fresh buffer if it was transferred? 
                            // Actually if buffer was transferred we can't reuse it. 
                            // But for small files usually it's copied or we can reread.
                            // FileReader result is gone if transferred? 
                            // ArrayBuffer transfer detaches it.
                            // So we CANNOT easily fallback if we transferred. 
                            // Strategy: Don't transfer for fallback safety OR reread.
                            // Rereading is safer.
                            resolve(runOnMainThread(data)); // Attempt main thread (might fail if detached)
                        }
                    };

                    worker.onerror = function (err) {
                        console.error('Worker Başlatma/Script Hatası:', err);
                        worker.terminate();
                        if (workerUrl) URL.revokeObjectURL(workerUrl);
                        // Fallback logic
                        // Only possible if data isn't detached. 
                        // To be safe, let's reject and let the user retry or use a flag to disable worker?
                        // Better: Try main thread immediately if worker errors.
                        // Note: If ArrayBuffer was transferred, 'data' is length 0.
                        reject(new Error("Arka plan işlemi başarısız. (Mobil tarayıcı kısıtlaması olabilir). Lütfen tekrar deneyin."));
                    };
                } catch (wErr) {
                    console.error("Worker Catch:", wErr);
                    // Fallback immediately
                    resolve(runOnMainThread(data));
                }
            };
            reader.readAsArrayBuffer(file);
        });
    },

    // New Data Restoration Logic to handle BOTH types
    async restoreFromIndexedDB() {
        try {
            const db = await this.initDB();

            // Check flags
            const hasClosing = await this.checkLoaded(db, 'matches_closing');
            const hasOpening = await this.checkLoaded(db, 'matches_opening');

            // Load data if available
            if (hasClosing) {
                window.matchDataClosing = await this.loadDataset(db, 'matches_closing');
                console.log(`📦 Kapanış: ${window.matchDataClosing.length} maç yüklendi`);
            }
            if (hasOpening) {
                window.matchDataOpening = await this.loadDataset(db, 'matches_opening');
                console.log(`📦 Açılış: ${window.matchDataOpening.length} maç yüklendi`);
            }

            // Set default active
            this.setActive(window.currentDataType || 'closing');

            window.matchDataLoaded = (window.matchDataClosing.length > 0 || window.matchDataOpening.length > 0);
            return true;
        } catch (error) {
            console.error('IndexedDB yükleme hatası:', error);
            return false;
        }
    },

    async checkLoaded(db, keyBase) {
        return new Promise(resolve => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const req = store.get(`${keyBase}_meta`);
            req.onsuccess = () => resolve(!!req.result);
            req.onerror = () => resolve(false);
        });
    },

    async loadDataset(db, keyBase) {
        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const metaReq = store.get(`${keyBase}_meta`);

            metaReq.onsuccess = async () => {
                if (metaReq.result) {
                    const { chunks } = metaReq.result;
                    const allMatches = [];
                    for (let i = 0; i < chunks; i++) {
                        const chunk = await this.getChunk(db, `${keyBase}_${i}`);
                        if (chunk) allMatches.push(...chunk);
                    }
                    resolve(allMatches);
                } else {
                    resolve([]);
                }
            };
            metaReq.onerror = () => resolve([]);
        });
    },

    async getChunk(db, key) {
        return new Promise((resolve) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve([]);
        });
    },

    // Switch Active Dataset
    setActive(type) {
        window.currentDataType = type;
        if (type === 'opening') {
            window.matchData = window.matchDataOpening || [];
        } else {
            window.matchData = window.matchDataClosing || [];
        }
        console.log(`🔄 Veri seti değiştirildi: ${type} (${window.matchData.length} maç)`);
    },

    getData() {
        return window.matchData;
    },

    isLoaded() {
        return window.matchData && window.matchData.length > 0;
    },

    getCount() {
        return window.matchData ? window.matchData.length : 0;
    },

    hasClosing() { return window.matchDataClosing && window.matchDataClosing.length > 0; },
    hasOpening() { return window.matchDataOpening && window.matchDataOpening.length > 0; },

    getClosingCount() { return window.matchDataClosing ? window.matchDataClosing.length : 0; },
    getOpeningCount() { return window.matchDataOpening ? window.matchDataOpening.length : 0; },

    async clear() {
        window.matchData = [];
        window.matchDataClosing = [];
        window.matchDataOpening = [];
        window.matchDataLoaded = false;
        try {
            const db = await this.initDB();
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            store.clear();
        } catch (error) {
            console.error('IndexedDB temizleme hatası:', error);
        }
    },

    excelDateToString(excelDate) {
        if (typeof excelDate === 'string') return excelDate;
        if (typeof excelDate !== 'number') return excelDate;
        const excelEpoch = new Date(1900, 0, 1);
        const msPerDay = 24 * 60 * 60 * 1000;
        const date = new Date(excelEpoch.getTime() + (excelDate - 2) * msPerDay);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        return `${day}.${month}.${year}`;
    },

    // --- Main Thread Fallback Helpers ---

    processExcelDataMain(worksheet, dataType) {
        // Logic duplicated from Worker for Main Thread fallback
        const rows = [];
        const range = XLSX.utils.decode_range(worksheet['!ref']);

        for (let R = range.s.r; R <= range.e.r; ++R) {
            const match = {};
            let hasData = false;

            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                const cell = worksheet[cellRef];
                let value = cell ? (cell.v !== undefined ? cell.v : cell.w) : undefined;

                if (value !== undefined && value !== null && value !== '') {
                    hasData = true;
                    if (C === 0 && typeof value === 'number') value = this.excelDateToString(value);
                    if (typeof value === 'string' && /^\d+,\d+$/.test(value)) value = value.replace(',', '.');
                    match[C] = value;
                }
            }
            if (hasData) this.mapAndPushRowMain(match, rows, dataType);
        }
        return this.filterRowsMain(rows);
    },

    mapAndPushRowMain(match, rows, dataType) {
        // Common Columns
        if (!match.date && match[0]) match.date = match[0];
        if (!match.league && match[1]) match.league = match[1];
        if (!match.homeTeam && match[2]) match.homeTeam = match[2];
        if (!match.awayTeam && match[3]) match.awayTeam = match[3];
        if (!match.score_ht && match[4]) match.score_ht = match[4];
        if (!match.score && match[5]) match.score = match[5];

        if (!match.ms1 && match[6]) match.ms1 = match[6];
        if (!match.ms0 && match[7]) match.ms0 = match[7];
        if (!match.ms2 && match[8]) match.ms2 = match[8];
        if (!match.iy1 && match[9]) match.iy1 = match[9];
        if (!match.iy0 && match[10]) match.iy0 = match[10];
        if (!match.iy2 && match[11]) match.iy2 = match[11];
        if (!match.kg_var && match[12]) match.kg_var = match[12];
        if (!match.kg_yok && match[13]) match.kg_yok = match[13];

        if (dataType === 'opening') {
            // Opening Odds Mapping
            if (!match.cs_1x && match[14]) match.cs_1x = match[14];
            if (!match.handicap_1 && match[15]) match.handicap_1 = match[15];
            if (!match.handicap_0 && match[16]) match.handicap_0 = match[16];
            if (!match.handicap_2 && match[17]) match.handicap_2 = match[17];
            if (!match.iy15_alt && match[18]) match.iy15_alt = match[18];
            if (!match.iy15_ust && match[19]) match.iy15_ust = match[19];
            if (!match.ms25_alt && match[20]) match.ms25_alt = match[20];
            if (!match.ms25_ust && match[21]) match.ms25_ust = match[21];
            if (!match.ms35_alt && match[22]) match.ms35_alt = match[22];
            if (!match.ms35_ust && match[23]) match.ms35_ust = match[23];
            if (!match.tg_01 && match[24]) match.tg_01 = match[24];
            if (!match.tg_23 && match[25]) match.tg_23 = match[25];
            if (!match.tg_45 && match[26]) match.tg_45 = match[26];
            if (!match.tg_6plus && match[27]) match.tg_6plus = match[27];
            if (!match.htft_11 && match[28]) match.htft_11 = match[28];
            // ... and so on for Opening
        } else {
            // Closing Odds Mapping
            if (!match.cs_1x && match[14]) match.cs_1x = match[14];
            if (!match.cs_12 && match[15]) match.cs_12 = match[15];
            if (!match.cs_2x && match[16]) match.cs_2x = match[16];
            if (!match.iy15_alt && match[17]) match.iy15_alt = match[17];
            if (!match.iy15_ust && match[18]) match.iy15_ust = match[18];
            if (!match.ms15_alt && match[19]) match.ms15_alt = match[19];
            if (!match.ms15_ust && match[20]) match.ms15_ust = match[20];
            if (!match.ms25_alt && match[21]) match.ms25_alt = match[21];
            if (!match.ms25_ust && match[22]) match.ms25_ust = match[22];
            if (!match.ms35_alt && match[23]) match.ms35_alt = match[23];
            if (!match.ms35_ust && match[24]) match.ms35_ust = match[24];
            if (!match.tg_01 && match[25]) match.tg_01 = match[25];
            if (!match.tg_23 && match[26]) match.tg_23 = match[26];
            if (!match.tg_45 && match[27]) match.tg_45 = match[27];
            if (!match.tg_6plus && match[28]) match.tg_6plus = match[28];
        }
        match.id = rows.length + 1;
        rows.push(match);
    },

    filterRowsMain(rows) {
        return rows.filter(m => {
            const isHeader = (String(m[0]).includes('TARİH') || String(m[0]).includes('Tarih'));
            const hasData = m.homeTeam || m[2];
            return !isHeader && hasData;
        });
    },

    async saveToIndexedDBMain(data, key, dataType) {
        const db = await this.initDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const CHUNK_SIZE = 2000;
        const totalItems = data.length;
        const totalChunks = Math.ceil(totalItems / CHUNK_SIZE);

        store.delete(key);
        store.put({ total: totalItems, chunks: totalChunks, type: dataType }, `${key}_meta`);

        for (let i = 0; i < totalChunks; i++) {
            const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            store.put(chunk, `${key}_${i}`);
        }
        store.put(true, `loaded_${dataType || 'closing'}`);

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    },
};

console.log('📊 ExcelLoader initialized (Dual Storage Support + Main Thread Fallback)');
