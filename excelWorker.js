// excelWorker.js
// Handles heavy Excel parsing in a background thread to prevent UI freezing.

importScripts("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");

const DB_NAME = 'ExcelDataDB';
const DB_VERSION = 1;
const STORE_NAME = 'matchData';

self.onmessage = async function (e) {
    const { data, mode } = e.data; // Expecting object with data and mode

    try {
        // High-Memory Efficiency Options
        const readOpts = {
            type: 'array',
            cellFormula: false,
            cellHTML: false,
            cellStyles: false,
            cellText: false, // We use .v or .w logic carefully
            // dense: true - Reverted to fix parsing issue
        };

        const workbook = XLSX.read(data, readOpts);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Free workbook reference immediately if possible (though scoped)
        // workbook = null; 

        // Process data
        const matches = processExcelData(worksheet);

        // Save to DB directly in Worker
        if (mode === 'archive') {
            await saveToIndexedDB(matches, 'matches');
            self.postMessage({ success: true, count: matches.length, mode: 'archive' });
        } else if (mode === 'program') {
            await saveToIndexedDB(matches, 'program_matches');
            self.postMessage({ success: true, count: matches.length, mode: 'program' });
        } else {
            // Fallback or just parse
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

async function saveToIndexedDB(data, key) {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Chunking Configuration
    const CHUNK_SIZE = 2000;
    const totalItems = data.length;
    const totalChunks = Math.ceil(totalItems / CHUNK_SIZE);

    // clear old single key if exists to free up space
    store.delete(key);

    // Save Metadata
    store.put({ total: totalItems, chunks: totalChunks }, `${key}_meta`);

    // Save Chunks
    for (let i = 0; i < totalChunks; i++) {
        const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        store.put(chunk, `${key}_${i}`);
    }

    if (key === 'matches') store.put(true, 'loaded');

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

function processExcelData(worksheet) {
    const rows = [];

    // Handle Dense Mode block removed to fix 0 matches issue
    // Reverting to Standard Sparse Mode logic below

    // Fallback: Sparse Mode (Standard)
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
                if (C === 0 && typeof value === 'number') {
                    value = excelDateToString(value);
                }
                if (typeof value === 'string' && /^\d+,\d+$/.test(value)) {
                    value = value.replace(',', '.');
                }
                match[C] = value;
            }
        }

        if (hasData) {
            mapAndPushRow(match, rows);
        }
    }

    return filterRows(rows);
}

function mapAndPushRow(match, rows) {
    // Mapping logic (same as original)
    if (!match.date && match[0]) match.date = match[0];
    if (!match.league && match[1]) match.league = match[1];
    if (!match.homeTeam && match[2]) match.homeTeam = match[2];
    if (!match.awayTeam && match[3]) match.awayTeam = match[3];
    if (!match.score_ht && match[4]) match.score_ht = match[4];
    if (!match.score && match[5]) match.score = match[5];

    // Odds mapping...
    // Match Result Odds - 6: MS1, 7: MS0, 8: MS2
    if (!match.ms1 && match[6]) match.ms1 = match[6];
    if (!match.ms0 && match[7]) match.ms0 = match[7];
    if (!match.ms2 && match[8]) match.ms2 = match[8];

    // Half Time Odds - 9: IY1, 10: IY0, 11: IY2
    if (!match.iy1 && match[9]) match.iy1 = match[9];
    if (!match.iy0 && match[10]) match.iy0 = match[10];
    if (!match.iy2 && match[11]) match.iy2 = match[11];

    // Both Teams Score - 12: KG Var, 13: KG Yok
    if (!match.kg_var && match[12]) match.kg_var = match[12];
    if (!match.kg_yok && match[13]) match.kg_yok = match[13];

    // Double Chance - 14: 1X, 15: 12, 16: 2X
    if (!match.cs_1x && match[14]) match.cs_1x = match[14];
    if (!match.cs_12 && match[15]) match.cs_12 = match[15];
    if (!match.cs_2x && match[16]) match.cs_2x = match[16];

    // Over/Under 1.5 (IY 1.5) - 17: Alt, 18: Üst
    if (!match.iy15_alt && match[17]) match.iy15_alt = match[17];
    if (!match.iy15_ust && match[18]) match.iy15_ust = match[18];

    // Over/Under 1.5 (MS) - 19: Alt, 20: Üst
    if (!match.ms15_alt && match[19]) match.ms15_alt = match[19];
    if (!match.ms15_ust && match[20]) match.ms15_ust = match[20];

    // Over/Under 2.5 (MS) - 21: Alt, 22: Üst
    if (!match.ms25_alt && match[21]) match.ms25_alt = match[21];
    if (!match.ms25_ust && match[22]) match.ms25_ust = match[22];

    // Over/Under 3.5 (MS) - 23: Alt, 24: Üst
    if (!match.ms35_alt && match[23]) match.ms35_alt = match[23];
    if (!match.ms35_ust && match[24]) match.ms35_ust = match[24];

    // Total Goals - 25: 0-1, 26: 2-3, 27: 4-5, 28: 6+
    if (!match.tg_01 && match[25]) match.tg_01 = match[25];
    if (!match.tg_23 && match[26]) match.tg_23 = match[26];
    if (!match.tg_45 && match[27]) match.tg_45 = match[27];
    if (!match.tg_6plus && match[28]) match.tg_6plus = match[28];

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

    return `${day}.${month}.${year}`;
}
