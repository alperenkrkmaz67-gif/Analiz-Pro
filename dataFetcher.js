// dataFetcher.js - Mackolik Data Integration

const DataFetcher = {
    apiUrl: 'https://arsiv.mackolik.com/AjaxHandlers/ProgramDataHandler.ashx',
    // proxyUrl: 'https://api.allorigins.win/get?url=',
    proxyUrl: 'https://corsproxy.io/?',

    // No init() call here, we call specific mode from page script

    initPageMode() {
        console.log('Initializing DataFetcher in Page Mode');
        this.fetchMatches(true);
    },

    // Legacy modal mode support
    bindEvents() { /* Deprecated */ },

    async fetchMatches(isPageMode = false) {
        const listContainer = document.getElementById(isPageMode ? 'match-list-container' : 'matchList');
        const loading = document.getElementById(isPageMode ? 'loading-state' : 'matchLoading');
        const errorState = document.getElementById('error-state');
        const errorMsg = document.getElementById('error-message');

        if (listContainer) listContainer.innerHTML = '';
        if (loading) loading.style.display = 'block';
        if (errorState) errorState.style.display = 'none';

        try {
            const today = new Date();
            const dateStr = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;

            const mackolikUrl = `${this.apiUrl}?type=6&sortValue=DATE&day=${dateStr}&sort=-1&sortDir=1&groupId=-1&np=1&sport=1`;

            // Use CorsProxy.io (Directly returns valid response)
            const response = await fetch(this.proxyUrl + encodeURIComponent(mackolikUrl));
            if (!response.ok) throw new Error("Proxy response failed");

            const mackolikData = await response.json();

            // Mackolik structure validation
            if (!mackolikData.m || !Array.isArray(mackolikData.m)) {
                throw new Error("Maç verisi bulunamadı");
            }

            this.renderMatches(mackolikData.m, isPageMode);

        } catch (error) {
            console.error('Data Fetch Error:', error);
            if (loading) loading.style.display = 'none';
            if (errorState) {
                errorState.style.display = 'block';
                if (errorMsg) errorMsg.textContent = `Veri çekilemedi: ${error.message}`;
            }
        } finally {
            if (loading) loading.style.display = 'none';
        }
    },

    renderMatches(matches, isPageMode) {
        const listContainer = document.getElementById(isPageMode ? 'match-list-container' : 'matchList');
        if (!listContainer) return;

        // m indices: 0:id, 1:Home, 3:Away, 6:Time, 26:League, 16:MS1, 17:MS0, 18:MS2
        let count = 0;

        matches.forEach(m => {
            if (!m[1] || !m[3]) return;
            count++;

            const item = document.createElement('div');

            if (isPageMode) {
                // Card Layout for Page
                item.className = 'match-card';
                item.innerHTML = `
                    <div class="match-card-header">
                        <span><i class="far fa-clock"></i> ${m[6]}</span>
                        <span>${m[26] || 'Lig Yok'}</span>
                    </div>
                    <div class="match-card-teams">
                        <div>${m[1]}</div>
                        <div>${m[3]}</div>
                    </div>
                    <div class="match-card-actions">
                        <button class="btn btn-primary btn-sm btn-block">
                            Analiz Et <i class="fas fa-arrow-right"></i>
                        </button>
                    </div>
                `;
            } else {
                // List Layout for Modal
                item.className = 'match-item';
                item.innerHTML = `
                    <div class="match-time">${m[6]}</div>
                    <div class="match-teams">
                        <span class="match-league">${m[26] || 'Lig Yok'}</span>
                        <span style="font-weight:700;">${m[1]}</span>
                        <span>${m[3]}</span>
                    </div>
                    <div class="match-actions">
                        <button class="btn btn-sm btn-primary">Seç</button>
                    </div>
                `;
            }

            item.onclick = () => this.selectMatch(m);
            listContainer.appendChild(item);
        });

        if (count === 0 && listContainer) {
            listContainer.innerHTML = '<p style="text-align:center; color:white; grid-column:1/-1;">Bugün için listelenecek maç bulunamadı.</p>';
        }
    },

    async selectMatch(m) {
        // Manual Object Construction
        const matchObj = {
            id: 1, // Always ID 1 for single match selection
            date: m[7],
            league: m[26],
            homeTeam: m[1],
            awayTeam: m[3],
            ms1: this.fixOdd(m[16]),
            ms0: this.fixOdd(m[17]),
            ms2: this.fixOdd(m[18]),
        };

        console.log('Selected Match:', matchObj);

        try {
            // Save to IndexedDB using ExcelLoader
            if (window.ExcelLoader) {
                await window.ExcelLoader.saveToIndexedDB([matchObj]);
                console.log('Match saved to DB');
            } else {
                console.warn('ExcelLoader not found, falling back to localStorage');
                localStorage.setItem('tempMatchData', JSON.stringify([matchObj]));
            }

            // Redirect to Dedicated Analysis Page
            window.location.href = 'dedicated_analysis.html?tab=iy_gol';

        } catch (e) {
            console.error('Selection Error:', e);
            alert('Seçim yapılırken hata oluştu: ' + e.message);
        }
    },

    fixOdd(val) {
        if (!val) return undefined;
        return String(val).replace(',', '.');
    }
};
