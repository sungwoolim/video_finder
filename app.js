// Utility for formatting numbers
const formatNumber = (num) => {
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString();
};

// Utility for duration format
const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// Utility for Date formatting
const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
};

// State
let MOCK_DATA = [];
let currentData = [];

let filterState = {
    search: '',
    length: 'all',
    date: 'all',
    subsMax: Infinity,
    viewsMin: 0
};

let sortState = {
    column: 'date',  
    descending: true
};

let selectedVideosMap = new Map(); // Global storage for selected videos: Map(id -> videoObject)
let selectedVideoIds = new Set(); // We'll keep this for convenience, but sync it with selectedVideosMap

// Elements
const tableBody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const lengthChips = document.querySelectorAll('#lengthFilters .chip');
const dateChips = document.querySelectorAll('#dateFilters .chip');
const subsRange = document.getElementById('subsRange');
const subsValDisplay = document.getElementById('subsValDisplay');
const viewsInput = document.getElementById('viewsInput');
const headers = document.querySelectorAll('th.sortable');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const apiKeyStatus = document.getElementById('apiKeyStatus');

// Selection & Generator Elements
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const fabContainer = document.getElementById('fabContainer');
const extractScriptBtn = document.getElementById('extractScriptBtn');
const selectedCount = document.getElementById('selectedCount');
const generatorView = document.getElementById('generatorView');
const closeGeneratorBtn = document.getElementById('closeGeneratorBtn');
const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
const promptTemplateInput = document.getElementById('promptTemplateInput');
const lengthOptionSelect = document.getElementById('lengthOptionSelect');
const videoTopicInput = document.getElementById('videoTopicInput');
const recommendTopicBtn = document.getElementById('recommendTopicBtn');
const topicRecommendationResult = document.getElementById('topicRecommendationResult');
const startGenerationBtn = document.getElementById('startGenerationBtn');
const pauseResumeBtn = document.getElementById('pauseResumeBtn');
const generationLog = document.getElementById('generationLog');
const basketList = document.getElementById('basketList');
const basketCount = document.getElementById('basketCount');
const clearBasketBtn = document.getElementById('clearBasketBtn');

// Initialization
const init = () => {
    // Load saved API keys and prompts
    const savedKey = localStorage.getItem('ytApiKey');
    if (savedKey) {
        apiKeyInput.value = savedKey;
    }
    
    const savedGeminiKey = localStorage.getItem('geminiApiKey');
    if (savedGeminiKey) {
        geminiApiKeyInput.value = savedGeminiKey;
    }
    
    const savedOpenAiKey = localStorage.getItem('openAiApiKey');
    const openAiApiKeyEl = document.getElementById('openAiApiKeyInput');
    if (savedOpenAiKey && openAiApiKeyEl) {
        openAiApiKeyEl.value = savedOpenAiKey;
    }
    
    const savedPrompt = localStorage.getItem('scriptPromptTemplate');
    if (savedPrompt) {
        promptTemplateInput.value = savedPrompt;
    }
    
    setupEventListeners();
    updateUI();
};

const setupEventListeners = () => {
    // Save API Key
    saveApiKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('ytApiKey', key);
            apiKeyStatus.textContent = "API Key saved to your browser!";
            apiKeyStatus.style.color = "var(--success)";
            apiKeyStatus.style.display = 'block';
            setTimeout(() => { apiKeyStatus.style.display = 'none'; }, 3000);
        } else {
            localStorage.removeItem('ytApiKey');
            apiKeyStatus.textContent = "API Key removed!";
            apiKeyStatus.style.color = "var(--text-secondary)";
            apiKeyStatus.style.display = 'block';
            setTimeout(() => { apiKeyStatus.style.display = 'none'; }, 3000);
        }
    });

    // Search
    searchBtn.addEventListener('click', fetchVideos);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') fetchVideos();
    });

    // Date Filters
    dateChips.forEach(chip => {
        chip.addEventListener('click', () => {
            if (filterState.date === chip.dataset.value) return;
            dateChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filterState.date = chip.dataset.value;
            
            if (searchInput.value.trim()) {
                fetchVideos();
            } else {
                applyFiltersAndSort();
            }
        });
    });

    // Length Filters
    lengthChips.forEach(chip => {
        chip.addEventListener('click', () => {
            lengthChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filterState.length = chip.dataset.value;
            applyFiltersAndSort();
        });
    });

    // Subs Slider Filter
    subsRange.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if (val >= 5000000) {
            subsValDisplay.textContent = 'Any (5M+)';
            filterState.subsMax = Infinity;
        } else {
            subsValDisplay.textContent = formatNumber(val);
            filterState.subsMax = val;
        }
        applyFiltersAndSort();
    });

    // TTS Engine Selector Toggle
    const ttsEngineSelect = document.getElementById('ttsEngineSelect');
    const openAiKeyWrapper = document.getElementById('openAiKeyWrapper');
    if (ttsEngineSelect && openAiKeyWrapper) {
        ttsEngineSelect.addEventListener('change', () => {
            openAiKeyWrapper.style.display = ttsEngineSelect.value === 'openai' ? 'block' : 'none';
        });
    }

    // Views Input Filter
    viewsInput.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 0) val = 0;
        filterState.viewsMin = val;
        applyFiltersAndSort();
    });

    // Sorting headers
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.sort;
            if (sortState.column === column) {
                sortState.descending = !sortState.descending;
            } else {
                sortState.column = column;
                sortState.descending = true;
            }
            applyFiltersAndSort();
        });
    });

    // Clear Basket
    if (clearBasketBtn) {
        clearBasketBtn.addEventListener('click', () => {
            if (confirm("모든 선택 내역을 삭제할까요?")) {
                selectedVideosMap.clear();
                syncSelectedIds();
                renderBasket();
                updateUI();
                updateFabVisibility();
                if (selectAllCheckbox) selectAllCheckbox.checked = false;
            }
        });
    }
};

const syncSelectedIds = () => {
    selectedVideoIds = new Set(selectedVideosMap.keys());
};

const renderBasket = () => {
    if (!basketList) return;
    
    basketList.innerHTML = '';
    basketCount.textContent = selectedVideosMap.size;

    if (selectedVideosMap.size === 0) {
        basketList.innerHTML = `<div style="color: var(--text-secondary); font-size: 0.85rem; padding: 1rem; text-align: center;">영상을 선택하면<br>여기에 표시됩니다.</div>`;
        return;
    }

    selectedVideosMap.forEach((video, id) => {
        const li = document.createElement('li');
        li.className = 'basket-item';
        li.innerHTML = `
            <div class="basket-item-info" title="${video.title}">${video.title}</div>
            <button class="basket-item-remove" data-id="${id}">&times;</button>
        `;
        basketList.appendChild(li);
    });

    // Add remove listeners
    basketList.querySelectorAll('.basket-item-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            selectedVideosMap.delete(id);
            syncSelectedIds();
            renderBasket();
            updateUI();
            updateFabVisibility();
            updateSelectAllState();
        });
    });
};

const fetchVideos = async () => {
    const query = searchInput.value.trim();
    if (!query) return;

    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert("Please enter & save your YouTube API Key at the top first!");
        return;
    }

    filterState.search = query.toLowerCase();
    
    // REMOVED: selectedVideoIds.clear() - We want persistence!
    
    updateFabVisibility();
    if (selectAllCheckbox) selectAllCheckbox.checked = false;

    tableBody.innerHTML = `
        <tr>
            <td colspan="7">
                <div class="empty-state">
                    <h2>Loading data from YouTube...</h2>
                </div>
            </td>
        </tr>
    `;

    try {
        // 1. Fetch Search List
        let dateQuery = '';
        if (filterState.date !== 'all') {
            const now = new Date();
            if (filterState.date === 'week') now.setDate(now.getDate() - 7);
            else if (filterState.date === 'month') now.setMonth(now.getMonth() - 1);
            else if (filterState.date === 'year') now.setFullYear(now.getFullYear() - 1);
            dateQuery = `&publishedAfter=${now.toISOString()}`;
        }
        
        let allItems = [];
        let pageToken = '';
        let pagesFetched = 0;
        const MAX_PAGES = 5; // Fetch up to 150 results (30 * 5)
        
        while (pagesFetched < MAX_PAGES) {
            const pageQuery = pageToken ? `&pageToken=${pageToken}` : '';
            const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=30&q=${encodeURIComponent(query)}&type=video${dateQuery}${pageQuery}&key=${apiKey}`;
            const searchRes = await fetch(searchUrl);
            if (!searchRes.ok) {
                const err = await searchRes.json();
                throw new Error(err.error?.message || "YouTube Search API Error");
            }
            const searchData = await searchRes.json();
            
            if (searchData.items && searchData.items.length > 0) {
                allItems = allItems.concat(searchData.items);
            }
            
            pageToken = searchData.nextPageToken;
            pagesFetched++;
            
            if (!pageToken) break; // No more pages
        }
        
        if (allItems.length === 0) {
            MOCK_DATA = [];
            applyFiltersAndSort();
            return;
        }

        const videoIds = allItems.map(item => item.id.videoId).filter(id => id);
        const channelIds = [...new Set(allItems.map(item => item.snippet.channelId))];

        // 2. Fetch Video Details (in batches of 50)
        const statsMap = {};
        for (let i = 0; i < videoIds.length; i += 50) {
            const batchIds = videoIds.slice(i, i + 50);
            const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${batchIds.join(',')}&key=${apiKey}`;
            const videosRes = await fetch(videosUrl);
            if (!videosRes.ok) throw new Error("YouTube Videos API Error");
            const videosData = await videosRes.json();
            
            if (videosData.items) {
                videosData.items.forEach(v => {
                    let durationStr = v.contentDetails?.duration || 'PT0S';
                    let totalSeconds = 0;
                    const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                    if (match) {
                        const h = match[1] ? parseInt(match[1]) : 0;
                        const m = match[2] ? parseInt(match[2]) : 0;
                        const s = match[3] ? parseInt(match[3]) : 0;
                        totalSeconds = (h * 3600) + (m * 60) + s;
                    }
                    statsMap[v.id] = {
                        viewCount: parseInt(v.statistics?.viewCount || '0'),
                        duration: totalSeconds
                    };
                });
            }
        }

        // 3. Fetch Channel Stats (in batches of 50)
        const chanStatsMap = {};
        for (let i = 0; i < channelIds.length; i += 50) {
            const batchIds = channelIds.slice(i, i + 50);
            const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${batchIds.join(',')}&key=${apiKey}`;
            const channelsRes = await fetch(channelsUrl);
            if (!channelsRes.ok) throw new Error("YouTube Channels API Error");
            const channelsData = await channelsRes.json();
            
            if (channelsData.items) {
                channelsData.items.forEach(c => {
                    chanStatsMap[c.id] = parseInt(c.statistics?.subscriberCount || '0');
                });
            }
        }

        // Combine
        const escapeHTML = (str) => {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };
        
        const results = [];
        for (const item of allItems) {
            const vid = item.id.videoId;
            if (!vid) continue;
            const snippet = item.snippet;
            
            const stats = statsMap[vid] || { viewCount: 0, duration: 0 };
            const views = stats.viewCount;
            
            const fakeCtr = Number((Math.random() * (12.0 - 3.0) + 3.0).toFixed(1));
            const fakeImpressions = views > 0 ? Math.floor(views / (fakeCtr / 100)) : 0;
            const realSubs = chanStatsMap[snippet.channelId] || 0;
            
            const thumbUrl = snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url;

            results.push({
                id: vid,
                title: escapeHTML(snippet.title),
                channel: snippet.channelTitle,
                duration: stats.duration,
                views: views,
                subs: realSubs,
                impressions: fakeImpressions,
                ctr: fakeCtr,
                thumb: thumbUrl,
                publishedAt: snippet.publishedAt || ''
            });
        }

        MOCK_DATA = results;
        applyFiltersAndSort();

    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state" style="color: var(--danger)">
                        <h2>Error loading data</h2>
                        <p>${error.message}</p>
                    </div>
                </td>
            </tr>
        `;
    }
};

const applyFiltersAndSort = () => {
    let filtered = MOCK_DATA.filter(video => {

        if (filterState.length === 'shorts' && video.duration >= 60) return false;
        if (filterState.length === 'medium' && (video.duration < 60 || video.duration > 1200)) return false; 
        if (filterState.length === 'long' && video.duration <= 1200) return false;

        if (filterState.date !== 'all') {
            const pubDate = new Date(video.publishedAt);
            const now = new Date();
            let limitDate = new Date();
            if (filterState.date === 'week') limitDate.setDate(now.getDate() - 7);
            else if (filterState.date === 'month') limitDate.setMonth(now.getMonth() - 1);
            else if (filterState.date === 'year') limitDate.setFullYear(now.getFullYear() - 1);
            if (pubDate < limitDate) return false;
        }

        if (video.subs > filterState.subsMax) return false;
        if (video.views < filterState.viewsMin) return false;

        return true;
    });

    filtered.sort((a, b) => {
        let comparison = 0;
        
        if (sortState.column === 'date') {
            const timeA = new Date(a.publishedAt).getTime() || 0;
            const timeB = new Date(b.publishedAt).getTime() || 0;
            if (timeA > timeB) comparison = 1;
            else if (timeA < timeB) comparison = -1;
        } else {
            let valA = a[sortState.column];
            let valB = b[sortState.column];
            if (valA > valB) comparison = 1;
            else if (valA < valB) comparison = -1;
        }

        return sortState.descending ? comparison * -1 : comparison;
    });

    currentData = filtered;
    updateUI();
};

const updateUI = () => {
    headers.forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.sort === sortState.column) {
            th.classList.add(sortState.descending ? 'desc' : 'asc');
        }
    });

    tableBody.innerHTML = '';

    if (currentData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <h2>No videos found</h2>
                        <p>Search for a topic or adjust filters to view results.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    currentData.forEach(video => {
        const tr = document.createElement('tr');
        
        const viewsStr = formatNumber(video.views);
        const subsStr = formatNumber(video.subs);
        const impressionsStr = formatNumber(video.impressions);
        
        const durationDisplay = video.duration < 60 ? 'SHORTS' : formatDuration(video.duration);
        const isChecked = selectedVideoIds.has(video.id) ? 'checked' : '';

        tr.innerHTML = `
            <td style="text-align: center; vertical-align: middle;">
                <input type="checkbox" class="video-select" data-id="${video.id}" ${isChecked}>
            </td>
            <td>
                <div class="video-cell">
                    <a href="https://youtube.com/watch?v=${video.id}" target="_blank" style="text-decoration:none; display:flex; shrink:0; justify-content:center;">
                        <img src="${video.thumb}" alt="Thumbnail" class="thumbnail" onerror="this.src='https://images.unsplash.com/photo-1611162617474-5b21e879e113?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&q=80'">
                    </a>
                    <div class="video-info">
                        <div class="video-title">
                            <a href="https://youtube.com/watch?v=${video.id}" target="_blank" style="color:var(--text-primary); text-decoration:none;">${video.title}</a>
                        </div>
                        <div class="channel-name">${video.channel}</div>
                        <div class="duration-badge">${durationDisplay}</div>
                    </div>
                </div>
            </td>
            <td class="metric-cell" style="color: var(--text-secondary)">${formatDate(video.publishedAt)}</td>
            <td class="metric-cell">${viewsStr}</td>
            <td class="metric-cell">${subsStr}</td>
            <td class="metric-cell">${impressionsStr}</td>
            <td class="metric-cell" style="color: ${video.ctr > 10 ? 'var(--success)' : 'inherit'}">${video.ctr.toFixed(1)}%</td>
        `;
        tableBody.appendChild(tr);
    });

    // Add listeners to checkboxes
    document.querySelectorAll('.video-select').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const id = e.target.getAttribute('data-id');
            const videoObj = currentData.find(v => v.id === id);
            
            if (e.target.checked) {
                if (videoObj) selectedVideosMap.set(id, videoObj);
            } else {
                selectedVideosMap.delete(id);
            }
            
            syncSelectedIds();
            renderBasket();
            updateFabVisibility();
            updateSelectAllState();
        });
    });
};

const updateFabVisibility = () => {
    if (selectedVideosMap.size > 0) {
        fabContainer.style.display = 'block';
        selectedCount.textContent = selectedVideosMap.size;
    } else {
        fabContainer.style.display = 'none';
    }
};

const updateSelectAllState = () => {
    if (!selectAllCheckbox) return;
    const checkboxes = document.querySelectorAll('.video-select');
    if (checkboxes.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
        return;
    }
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    const someChecked = Array.from(checkboxes).some(cb => cb.checked);
    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = someChecked && !allChecked;
};

// Select All Handler
if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.querySelectorAll('.video-select').forEach(checkbox => {
            checkbox.checked = isChecked;
            const id = checkbox.getAttribute('data-id');
            const videoObj = currentData.find(v => v.id === id);
            
            if (isChecked) {
                if (videoObj) selectedVideosMap.set(id, videoObj);
            } else {
                selectedVideosMap.delete(id);
            }
        });
        syncSelectedIds();
        renderBasket();
        updateFabVisibility();
    });
}

// Open Generator View
if (extractScriptBtn) {
    extractScriptBtn.addEventListener('click', () => {
        // Save current inputs
        if (geminiApiKeyInput.value) localStorage.setItem('geminiApiKey', geminiApiKeyInput.value);
        localStorage.setItem('scriptPromptTemplate', promptTemplateInput.value);
        
        // Hide Search UI, Show Generator UI
        document.querySelector('.search-container').style.display = 'none';
        document.querySelector('.filters-panel').style.display = 'none';
        document.querySelector('.table-container').style.display = 'none';
        fabContainer.style.display = 'none';
        generatorView.style.display = 'block';
    });
}

// Close Generator View
if (closeGeneratorBtn) {
    closeGeneratorBtn.addEventListener('click', () => {
        document.querySelector('.search-container').style.display = 'block';
        document.querySelector('.filters-panel').style.display = 'block';
        document.querySelector('.table-container').style.display = 'block';
        generatorView.style.display = 'none';
        updateFabVisibility(); // show fab again if items selected
    });
}

// Topic Recommendation Logic
if (recommendTopicBtn) {
    recommendTopicBtn.addEventListener('click', async () => {
        const geminiKey = geminiApiKeyInput.value.trim();
        if (!geminiKey) {
            alert("Please enter a Gemini API Key first!");
            return;
        }
        
        if (selectedVideoIds.size === 0) {
            alert("영상을 한 개 이상 선택해야 주제를 추천받을 수 있습니다.");
            return;
        }

        recommendTopicBtn.disabled = true;
        recommendTopicBtn.textContent = "추천 중...";
        topicRecommendationResult.style.display = 'block';
        topicRecommendationResult.style.color = "var(--text-secondary)";
        topicRecommendationResult.textContent = "선택된 영상 제목들을 분석하여 채널에 어울리는 최적의 바이럴 기획을 구상 중입니다...";

        try {
            const selectedTitles = Array.from(selectedVideosMap.values()).map(v => v.title);
            
            const prompt = `You are a viral YouTube content strategist. I selected the following successful videos on YouTube.
Selected Titles:
${selectedTitles.join('\n')}

Based on these titles, recommend 5 highly engaging and viral YouTube video topic ideas (in Korean) that I can make. 
Make them sound curious and clickable. Output them as a numbered list. Do not add any extra conversational filler.`;

            const ideas = await callGemini(geminiKey, prompt);
            
            topicRecommendationResult.style.color = "var(--success)";
            topicRecommendationResult.innerHTML = `<strong>💡 AI 추천 주제 아이디어:</strong><br>${ideas.replace(/\n/g, '<br>')}<br><span style="color:var(--text-secondary); font-size: 0.8rem; margin-top: 0.5rem; display: block;">(위 추천 중 마음에 드는 주제를 영상 주제 입력창에 복사/작성해 주세요!)</span>`;
            
        } catch (e) {
            topicRecommendationResult.style.color = "var(--danger)";
            topicRecommendationResult.textContent = `추천 실패: ${e.message}`;
        }
        
        recommendTopicBtn.disabled = false;
        recommendTopicBtn.textContent = "주제 추천받기";
    });
}

// ----------------------------------------------------
// PART 2 & 3: TRANSCRIPT + SCRIPT GENERATION LOGIC
// ----------------------------------------------------
async function callGemini(apiKey, promptText) {
    const fallbackModels = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash-lite", "gemini-2.0-flash"];
    let lastErrorMsg = null;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    for (const model of fallbackModels) {
        let retriesFor429 = 0;
        while (retriesFor429 < 3) {
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: promptText }] }],
                        generationConfig: { temperature: 0.7 }
                    })
                });

                if (!res.ok) {
                    const err = await res.json();
                    const baseMsg = err.error?.message || "Gemini API Error";
                    
                    // Smart Rate Limit Handling
                    if (res.status === 429 && baseMsg.includes("Please retry in")) {
                        const match = baseMsg.match(/Please retry in ([\d\.]+)s/);
                        if (match) {
                            const waitSeconds = parseFloat(match[1]) + 2; // +2 for safety margin
                            const logMsg = `\\n⏳ [Smart Auto-Retry] 분당 토큰/요청 제한 도달! 구글의 지시에 따라 ${waitSeconds.toFixed(0)}초간 일시정지 후 자동 재시도합니다... (재시도 ${retriesFor429 + 1}/3)\\n`;
                            const logEl = document.getElementById('generationLog');
                            if (logEl) {
                                logEl.innerHTML += logMsg;
                                logEl.scrollTop = logEl.scrollHeight;
                            }
                            await sleep(waitSeconds * 1000);
                            retriesFor429++;
                            continue; // Retry the exact same model!
                        }
                    }

                    const isTransient = res.status === 503 || res.status === 429 || res.status === 404 || 
                                        baseMsg.toLowerCase().includes("high demand") || 
                                        baseMsg.toLowerCase().includes("quota") || 
                                        baseMsg.toLowerCase().includes("not found");
                    
                    if (isTransient) {
                        lastErrorMsg = `[${model}] failed: ${res.status === 503 ? 'High demand' : baseMsg}`;
                        console.warn(lastErrorMsg);
                        break; // Break the while loop to fallback to the next model
                    }
                    
                    throw new Error(baseMsg);
                }
                
                const data = await res.json();
                if (!data.candidates || data.candidates.length === 0) throw new Error("No candidates returned from Gemini");
                return data.candidates[0].content.parts[0].text;

            } catch (e) {
                // Return to outer loop if it's not a generic node/fetch error
                if (!e.message.includes("fetch")) {
                    throw e;
                }
                lastErrorMsg = e.message;
                continue;
            }
        }
    }
    
    throw new Error(`All available AI models are currently busy or unavailable. Last message: ${lastErrorMsg}\\n\\nTip: Wait a few minutes before trying again.`);
}

// --- PAUSE MANAGER ---
const pauseManager = {
    isPaused: false,
    resolveFunc: null,
    async check(logFn) {
        if (this.isPaused) {
            if (logFn) logFn("\n⏸ 작업이 일시정지되었습니다. [▶ 계속하기]를 눌러 다시 시작하세요...");
            await new Promise(r => this.resolveFunc = r);
            if (logFn) logFn("▶ 작업이 재개되었습니다!\n");
        }
    },
    toggle() {
        if (!pauseResumeBtn) return;
        if (this.isPaused) {
            this.isPaused = false;
            if (this.resolveFunc) this.resolveFunc();
            this.resolveFunc = null;
            pauseResumeBtn.textContent = "⏸ 일시정지";
            pauseResumeBtn.style.background = "var(--warning, #f59e0b)";
            pauseResumeBtn.style.color = "black";
        } else {
            this.isPaused = true;
            pauseResumeBtn.textContent = "▶ 계속하기";
            pauseResumeBtn.style.background = "var(--success, #27ae60)";
            pauseResumeBtn.style.color = "white";
        }
    }
};

if (pauseResumeBtn) {
    pauseResumeBtn.addEventListener('click', () => {
        pauseManager.toggle();
    });
}

if (startGenerationBtn) {
    startGenerationBtn.addEventListener('click', async () => {
        const geminiKey = geminiApiKeyInput.value.trim();
        if (!geminiKey) {
            alert("Please enter a Gemini API Key!");
            return;
        }

        const template = promptTemplateInput.value.trim() || '훅(질문 포함) > 인트로 > 설명 > 결론';
        // Save inputs
        localStorage.setItem('geminiApiKey', geminiKey);
        localStorage.setItem('scriptPromptTemplate', template);

        // Parse Steps
        const steps = template.split('>').map(s => s.trim()).filter(s => s);
        if (steps.length === 0) {
            alert("Invalid Prompt Template structure. Make sure you use '>' to separate steps.");
            return;
        }

        const lengthSelection = lengthOptionSelect.value;
        let targetCharCount = 7000;
        if (lengthSelection === "Short") targetCharCount = 3000;
        if (lengthSelection === "Long") targetCharCount = 10000;

        const videoTopic = videoTopicInput ? videoTopicInput.value.trim() : '';

        const stepCharTarget = Math.floor(targetCharCount / steps.length);

        startGenerationBtn.disabled = true;
        startGenerationBtn.textContent = "Processing...";
        if (pauseResumeBtn) {
            pauseResumeBtn.style.display = 'block';
            pauseManager.isPaused = false;
            pauseResumeBtn.textContent = "⏸ 일시정지";
            pauseResumeBtn.style.background = "var(--warning, #f59e0b)";
            pauseResumeBtn.style.color = "black";
        }
        generationLog.innerHTML = "";

        const log = (msg) => {
            generationLog.innerHTML += msg + '\\n';
            generationLog.scrollTop = generationLog.scrollHeight;
        };

        try {
            log('=== PART 2: Extracting Transcripts ===');
            let combinedTranscripts = "";
            let idx = 1;
            const idsArray = Array.from(selectedVideoIds);

            for (const vid of idsArray) {
                await pauseManager.check(log);
                const videoData = selectedVideosMap.get(vid);
                const title = videoData ? videoData.title : 'Unknown Title';
                log(`Extracting transcript for video ID: ${vid} (${idx}/${idsArray.length})...`);
                // Calls Cloudflare Function
                const res = await fetch(`/api/transcript?videoId=${vid}`);
                if (!res.ok) {
                    const err = await res.json().catch(()=>({}));
                    log(`Warning: Failed to extract ${vid}. ${err.error || res.statusText}`);
                    combinedTranscripts += `\n--- Video: ${vid} (Title: ${title}) ---\n(No transcript available)\n`;
                } else {
                    const data = await res.json();
                    if (data.transcript) {
                        combinedTranscripts += `\n--- Video: ${vid} (Title: ${title}) ---\n${data.transcript}\n`;
                        log(`Success for ${vid}.`);
                    } else {
                        log(`Warning: No transcript found for ${vid}.`);
                        combinedTranscripts += `\n--- Video: ${vid} (Title: ${title}) ---\n(No transcript available)\n`;
                    }
                }
                idx++;
            }

            if (!combinedTranscripts.trim()) {
                log(`\nERROR: No transcripts could be extracted. We cannot proceed without base data.`);
                startGenerationBtn.disabled = false;
                startGenerationBtn.textContent = "Start Multi-step Generation";
                return;
            }

            log(`\n=== PART 3: AI Script Generation ===`);
            log(`Total target length: ~${targetCharCount} characters`);
            log(`Structure: ${steps.join(' -> ')}`);
            log(`====================================\n`);

            let accumulatedScript = "";

            const sleep = (ms) => new Promise(r => setTimeout(r, ms));

            for (let i = 0; i < steps.length; i++) {
                await pauseManager.check(log);
                const currentStep = steps[i];
                log(`\\n▶ Generating Part ${i + 1}/${steps.length}: [ ${currentStep} ]...`);

                let extra_instructions = "";
                if (i === 0) {
                    extra_instructions = `\nCRITICAL REQUIREMENT FOR THE FIRST SENTENCE: 
The VERY FIRST sentence of your response MUST be a question that starts with the exact word "여러분" and ends with "까?". (e.g. "여러분, ~~~ 고민해본 적 있으신가요?")
This starting question MUST present a deeply relatable concern, fear, or common misunderstanding extracted from the <transcripts>, making the viewer immediately think "Wait, is this about me?".`;
                } else {
                    extra_instructions = `\nCRITICAL ENFORCEMENT FOR THIS STEP:
DO NOT use the word "여러분" or the phrase "여러분 ~~ 까?" anywhere in your response. DO NOT write another hook question. It has already been covered previously and MUST NOT BE REPEATED. Focus entirely on the content for this exact step.`;
                }

                const prompt = `You are a professional YouTube scriptwriter. We are building a script step-by-step to reach a total length of approximately ${targetCharCount} characters.
This step focuses EXCLUSIVELY on: "${currentStep}".
Target Theme/Topic: "${videoTopic || '선택된 영상들의 공통된 핵심 인사이트'}"
Target character count for this specific segment: ~${stepCharTarget} characters.

Base Reference Material (Raw Transcripts):
<transcripts>
${combinedTranscripts.slice(0, 150000)} // Truncating to 150k chars to cover ~25 videos fully
</transcripts>

Previously Written Script (You must naturally continue from this if it exists):
<previous_script>
${accumulatedScript || "(This is the beginning of the script)"}
</previous_script>

Instructions:
1. Write ONLY the content for the current step ("${currentStep}").
2. Ensure the tone is engaging and natural for a YouTube video.
3. The content must logically inherit the context of the <previous_script> and transition smoothly.
4. Output just the raw script text. Do not add metadata, prefixes, or conversational filler like "Here is the next part".
5. IMPORTANT TONE RULE: The entire script MUST be written strictly in formal/polite Korean using "~입니다", "~습니다", "~합니까?" endings (하십시오체). Do NOT use informal or plain endings like "~해요", "~요", "~한다", or "~이다".${extra_instructions}`;

                const stepContent = await callGemini(geminiKey, prompt);
                accumulatedScript += `\n\n[ ${currentStep} ]\n` + stepContent.trim();
                
                log(`\n>> Generated Content for [ ${currentStep} ]:\n` + stepContent.trim() + `\n`);

                // Rate Limit 방지를 위해 각 파트 생성 후 마지막 파트가 아니면 20초 대기
                if (i < steps.length - 1) {
                    log(`⏳ 구글 무료 할당량(Rate Limit) 방어 기동: 서버 과열을 막기 위해 20초간 안전 대기합니다...`);
                    await sleep(20000);
                }
            }

            log(`\n====================================`);
            log(`✅ SCRIPT GENERATION COMPLETE!\n\n`);

            // --- AUTO WHISK FORMATTING ---
            // 1. Remove step headers like [ 훅(질문 포함) ]
            // 2. Break lines at every period, question mark, or exclamation mark.
            const whiskReadyScript = accumulatedScript
                .replace(/\[.*?\]/g, '') // Remove markers properly
                .replace(/([.?!])(\s+)/g, '$1\n') // Add single newline after punctuation
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0) // Remove empty lines
                .join('\n'); // Join with single newline, so one sentence per line

            log(`=== 🎬 AUTO WHISK READY SCRIPT (한 줄에 한 문장) ===\n`);
            log(whiskReadyScript);
            log(`\n======================================================`);

            // Expose for TTS
            window.whiskReadyScriptText = whiskReadyScript;
            
            // Text Script Download Button
            const scriptBlob = new Blob([whiskReadyScript], { type: 'text/plain;charset=utf-8' });
            const scriptUrl = URL.createObjectURL(scriptBlob);
            const downloadBtnHtml = `<br><br><a href="${scriptUrl}" download="YT_AutoWhisk_Script.txt" style="display: inline-block; background: #3b82f6; color: white; text-align: center; padding: 0.5rem 1rem; border-radius: 6px; text-decoration: none; font-weight: 600; box-shadow: 0 2px 10px rgba(59,130,246,0.3);">⬇️ 대본 텍스트 다운로드 (.txt)</a><br><br>`;
            document.getElementById('generationLog').innerHTML += downloadBtnHtml;
            document.getElementById('generationLog').scrollTop = document.getElementById('generationLog').scrollHeight;

            showProofPanel = null; // removed

            document.getElementById('ttsPanel').style.display = 'block';
            document.getElementById('audioLog').innerText = '✅ 모든 대본 생성이 완료되었습니다. 이제 [Generate Full Audio] 버튼을 눌러 TTS를 생성할 수 있습니다.';

        } catch(e) {
            log(`\\n🚨 ERROR: ${e.message}`);
        } finally {
            startGenerationBtn.disabled = false;
            startGenerationBtn.textContent = "Start Multi-step Generation";
            if (pauseResumeBtn) {
                pauseResumeBtn.style.display = 'none';
            }
        }
    });
}

// --- TTS AUDIO GENERATION LOGIC ---
const generateAudioBtn = document.getElementById('generateAudioBtn');
const audioLog = document.getElementById('audioLog');
const audioResultContainer = document.getElementById('audioResultContainer');

function alog(msg) {
    audioLog.innerHTML += msg;
    audioLog.scrollTop = audioLog.scrollHeight;
}

function splitTextIntoChunks(text, maxLen = 800) {
    // split by punctuation to keep sentences intact
    const sentences = text.split(/([.?!]+[\\n\\s]*)/);
    const chunks = [];
    let currentChunk = "";
    
    for (let i = 0; i < sentences.length; i += 2) {
        const sentence = sentences[i];
        const delim = sentences[i+1] || "";
        const completeSentence = sentence + delim;
        
        if (!completeSentence.trim()) continue;

        if (currentChunk.length + completeSentence.length > maxLen) {
            if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());
            currentChunk = completeSentence;
        } else {
            currentChunk += completeSentence;
        }
    }
    if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());
    return chunks;
}

// Convert Array of Raw PCM (Base64 Strings or Uint8Arrays) to a single WAV Blob
function convertPcmArrayToWavBlob(pcmDataArray, sampleRate = 24000) {
    let totalLength = 0;
    const buffers = pcmDataArray.map(data => {
        if (typeof data === 'string') {
            let stB64 = data.replace(/-/g, '+').replace(/_/g, '/');
            const pad = stB64.length % 4;
            if (pad) {
                stB64 += '='.repeat(4 - pad);
            }
            const binaryString = window.atob(stB64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            totalLength += len;
            return bytes;
        } else {
            // It's already a Uint8Array from OpenAI
            totalLength += data.length;
            return data;
        }
    });

    const combinedBytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
        combinedBytes.set(buf, offset);
        offset += buf.length;
    }

    const pcmDataLength = totalLength;
    const headerBuffer = new ArrayBuffer(44);
    const view = new DataView(headerBuffer);

    const writeString = (view, offset, str) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmDataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM Format (1)
    view.setUint16(22, 1, true); // 1 channel (Mono)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate (SampleRate * 1 channel * 2 bytes)
    view.setUint16(32, 2, true); // Block align (1 channel * 2 bytes)
    view.setUint16(34, 16, true); // Bits per sample (16)
    writeString(view, 36, 'data');
    view.setUint32(40, pcmDataLength, true);

    return new Blob([view, combinedBytes], { type: 'audio/wav' });
}

async function callGeminiAudio(apiKey, chunkText) {
    const model = "gemini-2.5-flash-preview-tts"; 
    const retries = 3;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    
    // User styling param
    const promptText = `[Voice Rules: Professional anchor, Warm and analytical tone, Constant speed, Medium pitch. Maintain the EXACT same consistent voice character from start to finish without mood swings.] Read the following text:\n\n${chunkText}`;
    
    for(let r = 0; r < retries; r++) {
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: {
                        responseModalities: ["AUDIO"],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: { voiceName: "enceladus" }
                            }
                        }
                    }
                })
            });

            if (!res.ok) {
                 const err = await res.json();
                 const baseMsg = err.error?.message || "Audio API Error";
                 if (res.status === 429) {
                     alog(`\n⏳ 과부하 감지. 20초 후 자동 재시도...`);
                     await sleep(20000); 
                     continue;
                 }
                 throw new Error(baseMsg);
            }
            
            const data = await res.json();
            const part = data.candidates?.[0]?.content?.parts?.[0];
            if (part && part.inlineData && part.inlineData.mimeType.includes("audio")) {
                return part.inlineData.data; // RAW PCM Base64
            }
            throw new Error("No audio returned. Verify model capabilities.");
            
        } catch(e) {
             if (e.message.includes("fetch")) {
                 if (r === retries - 1) throw e;
                 await sleep(5000);
                 continue;
             }
             if (r === retries - 1) throw e;
        }
    }
    throw new Error("API calls completely failed because all retries were exhausted.");
}

async function callOpenAIAudio(apiKey, chunkText) {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "tts-1",
            input: chunkText,
            voice: "onyx",
            response_format: "pcm",
            speed: 0.95 // Slightly slower for calmer, clearer anchor tone
        })
    });

    if (!res.ok) {
        let err;
        try { err = await res.json(); } catch(e){}
        throw new Error(err?.error?.message || "OpenAI API Error");
    }

    const arrayBuffer = await res.arrayBuffer();
    return new Uint8Array(arrayBuffer); // Raw PCM Stream from OpenAI
}

generateAudioBtn.addEventListener('click', async () => {
    if (!window.whiskReadyScriptText) return;
    
    generateAudioBtn.disabled = true;
    generateAudioBtn.textContent = "Generating... Please wait";
    audioLog.innerHTML = "";
    audioResultContainer.innerHTML = "";
    
    const _apiKey = document.getElementById('geminiApiKeyInput').value.trim();
    const openAiApiKeyInput = document.getElementById('openAiApiKeyInput');
    const openAiApiKey = openAiApiKeyInput?.value.trim();
    const engine = document.getElementById('ttsEngineSelect')?.value || 'gemini';

    // Persist OpenAI key
    if (openAiApiKey) localStorage.setItem('openAiApiKey', openAiApiKey);
    
    // Set chunk size. Gemini fails with 429 often on large chunks (internal limits). OpenAI handles 1500 fine.
    const chunkSize = engine === 'openai' ? 1500 : 800;
    const chunks = splitTextIntoChunks(window.whiskReadyScriptText, chunkSize);
    alog(`✅ 전체 대본을 ${chunks.length}개의 조각(Chunk)으로 분할했습니다 (엔진: ${engine}, 최대 ${chunkSize}자).\n`);
    
    const base64AudioArray = [];
    
    if (engine === 'gemini' && !_apiKey) {
        alog(`\n🚨 ERROR: Gemini API Key가 누락되었습니다.`);
        generateAudioBtn.disabled = false;
        generateAudioBtn.textContent = "Generate Full Audio";
        return;
    }
    
    if (engine === 'openai' && !openAiApiKey) {
        alog(`\n🚨 ERROR: OpenAI API Key가 누락되었습니다.`);
        generateAudioBtn.disabled = false;
        generateAudioBtn.textContent = "Generate Full Audio";
        return;
    }
    
    try {
        for(let i=0; i<chunks.length; i++) {
           alog(`▶ Generating Audio Part ${i+1}/${chunks.length} [${engine.toUpperCase()}]...\n`);
           
           let audioData;
           if (engine === 'openai') {
               audioData = await callOpenAIAudio(openAiApiKey, chunks[i]);
           } else {
               audioData = await callGeminiAudio(_apiKey, chunks[i]);
           }
           base64AudioArray.push(audioData);
           alog(`✅ Part ${i+1} 오디오 생성 완료.\n`);
           
           if (i < chunks.length - 1) {
               if (engine === 'gemini') {
                   alog(`⏳ 구글 서버 과열 방지를 위해 15초간 대기합니다...\n`);
                   await new Promise(r => setTimeout(r, 15000));
               } else {
                   // OpenAI allows rapid requests, brief pause
                   await new Promise(r => setTimeout(r, 1000));
               }
           }
        }
        
        alog(`\n🚀 ${chunks.length}개의 조각난 오디오 파일을 1개의 무손실 WAV 파일로 병합합니다...`);
        // 24kHz is what both models emit for PCM in our usage (openAI can emit 24k default for PCM)
        const finalWavBlob = convertPcmArrayToWavBlob(base64AudioArray, 24000);
        const finalWavUrl = URL.createObjectURL(finalWavBlob);
        
        audioResultContainer.innerHTML = `
            <div style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; border: 1px solid var(--glass-border);">
                <audio controls src="${finalWavUrl}" style="width: 100%; margin-bottom: 10px;"></audio>
                <a href="${finalWavUrl}" download="YT_Script_Voice_${engine}.wav" style="display: block; background: var(--success, #27ae60); color: white; text-align: center; padding: 0.75rem; border-radius: 6px; text-decoration: none; font-weight: 600; box-shadow: 0 2px 10px rgba(39,174,96,0.3);">⬇️ 전체 오디오 파일 다운로드 (.wav)</a>
            </div>
        `;
        alog(`\n✅ 오디오 생성 및 병합 완벽히 성공! 결과물을 다운로드하거나 재생하세요.`);
        
        // Expose to video creator
        window.finalWavBlob = finalWavBlob;
        document.getElementById('videoPanel').style.display = 'block';
        document.getElementById('videoLog').style.display = 'block';
        document.getElementById('videoLog').innerText = '✅ 오디오가 준비되었습니다! 이제 AutoWhisk 이미지들을 여러 장 선택하고 유튜브 영상 제작을 시작하세요.';
        
    } catch(e) {
        alog(`\n🚨 ERROR: ${e.message}`);
    }
    generateAudioBtn.disabled = false;
    generateAudioBtn.textContent = "Generate Full Audio";
});

// --- AUDIO UPLOAD LOGIC ---
const audioUploadInput = document.getElementById('audioUploadInput');
if (audioUploadInput) {
    audioUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        window.finalWavBlob = file;
        const audioUrl = URL.createObjectURL(file);
        
        audioResultContainer.innerHTML = `
            <div style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; border: 1px solid var(--glass-border);">
                <audio controls src="${audioUrl}" style="width: 100%; margin-bottom: 10px;"></audio>
                <div style="text-align: center; color: var(--success); font-weight: 600;">✅ 업로드된 오디오 파일이 준비되었습니다.</div>
            </div>
        `;
        
        alog(`\n✅ 사용자가 직접 오디오 파일(${file.name})을 업로드했습니다.`);
        
        document.getElementById('videoPanel').style.display = 'block';
        document.getElementById('videoLog').style.display = 'block';
        document.getElementById('videoLog').innerText = '✅ 오디오가 준비되었습니다! 이제 AutoWhisk 이미지들을 여러 장 선택하고 유튜브 영상 제작을 시작하세요.';
        
        // Reset input so user can re-upload if needed
        audioUploadInput.value = '';
    });
}

// --- VIDEO COMPOSITOR LOGIC ---
const generateVideoBtn = document.getElementById('generateVideoBtn');
const whiskImagesInput = document.getElementById('whiskImagesInput');
const videoLog = document.getElementById('videoLog');

function vlog(msg) {
    videoLog.innerHTML += msg;
    videoLog.scrollTop = videoLog.scrollHeight;
}

generateVideoBtn.addEventListener('click', async () => {
    if (!window.whiskReadyScriptText || !window.finalWavBlob) {
        alert("먼저 대본(Script)과 오디오 트랙(Audio)을 모두 생성해야 합니다!");
        return;
    }
    if (whiskImagesInput.files.length === 0) {
        alert("오토 위스크(Auto Whisk)에서 생성한 이미지 파일들을 모두 드래그해서 선택해주세요!");
        return;
    }

    generateVideoBtn.disabled = true;
    generateVideoBtn.textContent = "⏳ 비디오 병합 중... (잠시만 기다려주세요)";
    videoLog.innerHTML = "";
    vlog(`🚀 영상을 병합하기 위해 로컬 파이썬 렌더링 서버(http://localhost:5000)와 통신합니다...\n`);

    const formData = new FormData();
    formData.append("script", window.whiskReadyScriptText);
    formData.append("audio", window.finalWavBlob, "audio.wav");
    
    for (let i = 0; i < whiskImagesInput.files.length; i++) {
        formData.append("images", whiskImagesInput.files[i]);
    }

    try {
        const pContainer = document.getElementById('videoProgressContainer');
        const pBar = document.getElementById('videoProgressBar');
        const pPercent = document.getElementById('videoProgressPercent');
        
        if (pContainer) pContainer.style.display = 'block';
        if (pBar) pBar.style.width = '0%';
        if (pPercent) pPercent.innerText = '0%';
        
        vlog(`⏳ FFmpeg 줌팬 필터 렌더링 서버를 시작합니다...\n(영상 길이에 따라 대략 몇 분 정도 소요됩니다)\n`);
        
        const res = await fetch("http://127.0.0.1:5000/api/make-video", {
            method: "POST",
            body: formData
        });

        if (!res.ok) {
            let errMsg = "서버 에러 발생!";
            try {
                const errObj = await res.json();
                errMsg = errObj.error || errMsg;
            } catch(e) {}
            throw new Error(errMsg);
        }
        
        const { job_id } = await res.json();
        const eventSource = new EventSource(`http://127.0.0.1:5000/api/progress/${job_id}`);
        
        eventSource.onmessage = function(event) {
            const data = JSON.parse(event.data);
            
            if (data.error) {
                eventSource.close();
                vlog(`\n🚨 SSE ERROR: ${data.error}`);
                generateVideoBtn.disabled = false;
                generateVideoBtn.textContent = "Upload & Create Video";
                return;
            }
                        if (pBar) pBar.style.width = `${data.progress}%`;
            if (pPercent) pPercent.innerText = `${data.progress}%`;
            
            const pText = document.getElementById('videoProgressText');
            if (pText && data.message) pText.innerText = data.message;            
            if (data.status === 'completed') {
                eventSource.close();
                vlog(`\n🎉 100% 비디오 렌더링이 성공적으로 완료되었습니다! 파일 다운로드를 시작합니다.`);
                
                // Trigger download
                const a = document.createElement('a');
                a.href = `http://127.0.0.1:5000/api/download/${job_id}`;
                a.download = "Final_YouTube_Video.mp4";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                vlog(`\n✅ "Final_YouTube_Video.mp4" 파일 다운로드가 시작되었습니다!`);
                generateVideoBtn.disabled = false;
                generateVideoBtn.textContent = "Upload & Create Video";
            }
            else if (data.status === 'error') {
                eventSource.close();
                vlog(`\n🚨 SERVER ERROR: 렌더링 중 오류가 발생했습니다. (서버 로그 확인 필요)`);
                if (pContainer) pContainer.children[0].children[0].innerText = 'Error occurred';
                generateVideoBtn.disabled = false;
                generateVideoBtn.textContent = "Upload & Create Video";
            }
        };

        eventSource.onerror = function(err) {
            console.error("SSE Error:", err);
            eventSource.close();
            vlog(`\n🚨 NETWORK ERROR: 진행률 서버와의 연결이 끊어졌습니다.`);
            generateVideoBtn.disabled = false;
            generateVideoBtn.textContent = "Upload & Create Video";
        };
        
        // We do NOT enable the button here. The SSE listeners will handle re-enabling when done.
        return; // Early return so finally block equivalent is managed by event listener callbacks

    } catch (e) {
        vlog(`\n🚨 ERROR: ${e.message}\n로컬 서버(python video_server.py)가 켜져 있는지 확인해 주세요!`);
    }

    generateVideoBtn.disabled = false;
    generateVideoBtn.textContent = "Upload & Create Video";
});

// --- SCRIPT UPLOAD RESTORE LOGIC ---
const uploadExistingScript = document.getElementById('uploadExistingScript');
if (uploadExistingScript) {
    uploadExistingScript.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target.result;
            window.whiskReadyScriptText = text;
            
            // Show TTS and Video Panels
            const ttsPanel = document.getElementById('ttsPanel');
            const videoPanel = document.getElementById('videoPanel');
            if (ttsPanel) ttsPanel.style.display = 'block';
            if (videoPanel) videoPanel.style.display = 'block';
            
            // Log output
            const logEl = document.getElementById('generationLog');
            if (logEl) {
                logEl.innerHTML += `\n✅ [RESTORED] Loaded script from ${file.name}!\nLength: ${text.length} chars.\nYou can now generate audio directly.`;
                logEl.scrollTop = logEl.scrollHeight;
            }
            
            // Show ttsPanel and update audioLog
            const audioLog = document.getElementById('audioLog');
            if (ttsPanel) ttsPanel.style.display = 'block';
            if (audioLog) audioLog.innerText = '✅ Script restored! You can click [Generate Full Audio] to resume processing.';
            
            // Reset input so it works again for same file
            uploadExistingScript.value = '';
        };
        reader.readAsText(file);
    });
}

init();
