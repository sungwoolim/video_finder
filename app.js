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

<<<<<<< HEAD
let selectedVideosMap = new Map(); // Global storage for selected videos: Map(id -> videoObject)
let selectedVideoIds = new Set(); // We'll keep this for convenience, but sync it with selectedVideosMap
=======
let selectedVideoIds = new Set();
let selectedVideosMap = new Map();
>>>>>>> 2f5eb60 (V6.1: Unified Integrity Mode, Port Fix(5001), and Dynamic Scene Counting)

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
<<<<<<< HEAD
=======
const recommendTopicBtn = document.getElementById('recommendTopicBtn');
const topicRecommendationResult = document.getElementById('topicRecommendationResult');
const videoTopicInput = document.getElementById('videoTopicInput');

// Manual Prompt Elements
const generatePromptsOnlyBtn = document.getElementById('generatePromptsOnlyBtn');
const manualScriptInput = document.getElementById('manualScriptInput');
const manualPromptLog = document.getElementById('manualPromptLog');
>>>>>>> 2f5eb60 (V6.1: Unified Integrity Mode, Port Fix(5001), and Dynamic Scene Counting)

// Initialization
const init = () => {
    const savedKey = localStorage.getItem('ytApiKey');
    if (savedKey) apiKeyInput.value = savedKey;
    
    const savedGeminiKey = localStorage.getItem('geminiApiKey');
    if (savedGeminiKey) geminiApiKeyInput.value = savedGeminiKey;
    
    const savedPrompt = localStorage.getItem('scriptPromptTemplate');
    if (savedPrompt) promptTemplateInput.value = savedPrompt;
    
    setupEventListeners();
    updateUI();
};

const setupEventListeners = () => {
    saveApiKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('ytApiKey', key);
            apiKeyStatus.textContent = "API Key saved!";
            apiKeyStatus.style.color = "var(--success)";
            apiKeyStatus.style.display = 'block';
            setTimeout(() => { apiKeyStatus.style.display = 'none'; }, 3000);
        } else {
            localStorage.removeItem('ytApiKey');
            apiKeyStatus.textContent = "API Key removed!";
            apiKeyStatus.style.display = 'block';
            setTimeout(() => { apiKeyStatus.style.display = 'none'; }, 3000);
        }
    });

    searchBtn.addEventListener('click', fetchVideos);
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') fetchVideos(); });

    dateChips.forEach(chip => {
        chip.addEventListener('click', () => {
            dateChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filterState.date = chip.dataset.value;
            if (searchInput.value.trim()) fetchVideos();
            else applyFiltersAndSort();
        });
    });

    lengthChips.forEach(chip => {
        chip.addEventListener('click', () => {
            lengthChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filterState.length = chip.dataset.value;
            applyFiltersAndSort();
        });
    });

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

    viewsInput.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        filterState.viewsMin = isNaN(val) ? 0 : val;
        applyFiltersAndSort();
    });

    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.sort;
            if (sortState.column === column) sortState.descending = !sortState.descending;
            else { sortState.column = column; sortState.descending = true; }
            applyFiltersAndSort();
        });
    });

<<<<<<< HEAD
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
=======
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            document.querySelectorAll('.video-select').forEach(cb => {
                cb.checked = isChecked;
                const id = cb.dataset.id;
                if (isChecked) {
                    selectedVideoIds.add(id);
                    const obj = currentData.find(v => v.id === id);
                    if (obj) selectedVideosMap.set(id, obj);
                } else {
                    selectedVideoIds.delete(id);
                    selectedVideosMap.delete(id);
                }
            });
            updateFabVisibility();
            updateBasketView();
        });
    }

    if (extractScriptBtn) {
        extractScriptBtn.addEventListener('click', () => {
            if (geminiApiKeyInput.value) localStorage.setItem('geminiApiKey', geminiApiKeyInput.value);
            localStorage.setItem('scriptPromptTemplate', promptTemplateInput.value);
            document.querySelector('.search-container').style.display = 'none';
            document.querySelector('.filters-panel').style.display = 'none';
            document.querySelector('.table-container').style.display = 'none';
            fabContainer.style.display = 'none';
            generatorView.style.display = 'block';
        });
    }

    if (closeGeneratorBtn) {
        closeGeneratorBtn.addEventListener('click', () => {
            document.querySelector('.search-container').style.display = 'block';
            document.querySelector('.filters-panel').style.display = 'block';
            document.querySelector('.table-container').style.display = 'block';
            generatorView.style.display = 'none';
            updateFabVisibility();
        });
    }
>>>>>>> 2f5eb60 (V6.1: Unified Integrity Mode, Port Fix(5001), and Dynamic Scene Counting)
};

const fetchVideos = async () => {
    const query = searchInput.value.trim();
    if (!query) return;
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) { alert("Please enter YouTube API Key!"); return; }

    filterState.search = query.toLowerCase();
<<<<<<< HEAD
    
    // REMOVED: selectedVideoIds.clear() - We want persistence!
    
=======
    selectedVideoIds.clear();
>>>>>>> 2f5eb60 (V6.1: Unified Integrity Mode, Port Fix(5001), and Dynamic Scene Counting)
    updateFabVisibility();

    tableBody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><h2>Loading...</h2></div></td></tr>`;

    try {
        const searchRes = await fetch(`http://127.0.0.1:5001/api/search?query=${encodeURIComponent(query)}`);
        const searchData = await searchRes.json();
        if (!searchRes.ok) throw new Error(searchData.error || "Search API Error");

        if (searchData.length === 0) { MOCK_DATA = []; applyFiltersAndSort(); return; }

        // 파이썬 서버에서 받아온 데이터를 MOCK_DATA 형식으로 변환
        MOCK_DATA = searchData.map(item => ({
            id: item.videoId,
            title: item.title,
            channel: "YouTube Video", // 기본값
            duration: 0, // 상세 정보는 나중에 채워짐
            views: 0,
            subs: 0,
            thumb: item.thumbnail,
            publishedAt: new Date().toISOString()
        }));

        applyFiltersAndSort();
    } catch (e) {
        tableBody.innerHTML = `<tr><td colspan="7"><div class="empty-state" style="color:var(--danger)"><h2>Error</h2><p>${e.message}</p></div></td></tr>`;
    }
};

const applyFiltersAndSort = () => {
    let filtered = MOCK_DATA.filter(v => {
        if (filterState.length === 'shorts' && v.duration >= 60) return false;
        if (filterState.length === 'medium' && (v.duration < 60 || v.duration > 1200)) return false;
        if (filterState.length === 'long' && v.duration <= 1200) return false;
        if (v.subs > filterState.subsMax) return false;
        if (v.views < filterState.viewsMin) return false;
        return true;
    });

    filtered.sort((a, b) => {
        let valA = a[sortState.column], valB = b[sortState.column];
        if (sortState.column === 'date') { valA = new Date(a.publishedAt); valB = new Date(b.publishedAt); }
        return sortState.descending ? (valA < valB ? 1 : -1) : (valA > valB ? 1 : -1);
    });

    currentData = filtered;
    updateUI();
};

const updateUI = () => {
    tableBody.innerHTML = '';
    currentData.forEach(v => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align:center"><input type="checkbox" class="video-select" data-id="${v.id}" ${selectedVideoIds.has(v.id)?'checked':''}></td>
            <td><div class="video-cell"><img src="${v.thumb}" class="thumbnail"><div class="video-info"><div class="video-title">${v.title}</div><div class="channel-name">${v.channel}</div></div></div></td>
            <td class="metric-cell">${v.publishedAt.split('T')[0]}</td>
            <td class="metric-cell">${formatNumber(v.views)}</td>
            <td class="metric-cell">${formatNumber(v.subs)}</td>
            <td class="metric-cell">-</td>
            <td class="metric-cell">-</td>
        `;
        tableBody.appendChild(tr);
    });

<<<<<<< HEAD
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
=======
    document.querySelectorAll('.video-select').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = cb.dataset.id;
            if (e.target.checked) {
                selectedVideoIds.add(id);
                selectedVideosMap.set(id, currentData.find(x => x.id === id));
            } else {
                selectedVideoIds.delete(id);
                selectedVideosMap.delete(id);
            }
>>>>>>> 2f5eb60 (V6.1: Unified Integrity Mode, Port Fix(5001), and Dynamic Scene Counting)
            updateFabVisibility();
            updateBasketView();
        });
    });
};

const updateFabVisibility = () => {
<<<<<<< HEAD
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
=======
    if (fabContainer) fabContainer.style.display = selectedVideoIds.size > 0 ? 'block' : 'none';
    if (selectedCount) selectedCount.textContent = selectedVideoIds.size;
};

const updateBasketView = () => {
    if (!basketList) return;
    basketList.innerHTML = '';
    if (basketCount) basketCount.textContent = selectedVideosMap.size;
    selectedVideosMap.forEach((v, id) => {
        const li = document.createElement('li');
        li.className = 'basket-item';
        li.innerHTML = `<span>${v.title}</span><button class="basket-item-remove" data-id="${id}">&times;</button>`;
        basketList.appendChild(li);
    });
    
    basketList.querySelectorAll('.basket-item-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = btn.dataset.id;
            selectedVideoIds.delete(id);
            selectedVideosMap.delete(id);
            updateUI();
            updateFabVisibility();
            updateBasketView();
        });
>>>>>>> 2f5eb60 (V6.1: Unified Integrity Mode, Port Fix(5001), and Dynamic Scene Counting)
    });
};

<<<<<<< HEAD
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
=======
async function callGemini(apiKey, prompt) {
    console.log("🚀 app.js V3.9 (Resilient Fallback) - 호출 시작");
    
    const actualKey = apiKey.split(',')[0].replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (!actualKey) throw new Error("API 키가 유효하지 않습니다.");
    
    const models = [
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-2.0-flash-exp"
    ];
    
    let lastErr = "";
    
    for (const modelName of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${actualKey}`;
            console.log(`📡 시도 중: ${modelName}...`);
            
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7 }
                })
            });
            
            const data = await res.json();
            
            if (res.ok && data.candidates && data.candidates[0].content) {
                console.log(`✅ [${modelName}] 호출 성공!`);
>>>>>>> 2f5eb60 (V6.1: Unified Integrity Mode, Port Fix(5001), and Dynamic Scene Counting)
                return data.candidates[0].content.parts[0].text;
            }
            
            lastErr = data.error ? `${data.error.status}: ${data.error.message}` : `HTTP ${res.status}`;
            console.warn(`⚠️ ${modelName} 건너뜀 (이유: ${lastErr})`);
            
            // 인증 오류(403)나 키 오류(400) 중 특정 케이스만 즉시 중단, 나머지는 다음 모델 시도
            if (res.status === 403 && lastErr.includes("API_KEY_INVALID")) {
                throw new Error("API 키가 유효하지 않습니다. 확인 후 다시 시도해주세요.");
            }
            
            // 과부하(UNAVAILABLE), 모델 없음(NOT_FOUND) 등은 다음 모델로 계속 진행
            continue;
            
        } catch (e) {
            lastErr = e.message;
            if (e.message.includes("API 키가 유효하지 않습니다")) throw e;
            console.error(`🚨 ${modelName} 에러 발생, 다음 모델 시도...`, e);
        }
    }
    
    throw new Error(`모든 모델 시도 실패. (마지막 에러: ${lastErr})\n\n팁: API 키 상태를 확인하시거나 잠시 후 다시 시도해 주세요.`);
}

<<<<<<< HEAD
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
=======
// Topic Recommendation
if (recommendTopicBtn) {
    recommendTopicBtn.addEventListener('click', async () => {
        const key = geminiApiKeyInput.value.trim();
        if (!key || selectedVideosMap.size === 0) return;
        recommendTopicBtn.disabled = true;
        topicRecommendationResult.textContent = "Analyzing topics...";
        try {
            const titles = Array.from(selectedVideosMap.values()).map(v => v.title).join('\n');
            const ideas = await callGemini(key, `Recommend 5 viral topics in Korean based on these titles:\n${titles}`);
            topicRecommendationResult.innerHTML = `<strong>Recommendations:</strong><br>${ideas.replace(/\n/g, '<br>')}`;
        } catch (e) { topicRecommendationResult.textContent = e.message; }
        recommendTopicBtn.disabled = false;
>>>>>>> 2f5eb60 (V6.1: Unified Integrity Mode, Port Fix(5001), and Dynamic Scene Counting)
    });
}

// ----------------------------------------------------
// MAIN GENERATION FLOW (CHUNKED)
// ----------------------------------------------------
if (startGenerationBtn) {
    startGenerationBtn.addEventListener('click', async () => {
        const geminiKey = geminiApiKeyInput.value.trim();
        if (!geminiKey) return;
        startGenerationBtn.disabled = true;
        generationLog.innerHTML = "=== Processing Multi-step Generation ===\n";
        const log = (msg) => { generationLog.innerHTML += msg + "\n"; generationLog.scrollTop = generationLog.scrollHeight; };

        try {
            let sentences = [];

            // [V6.0 스마트 체크] 이미 업로드하거나 준비된 대본이 있다면 새로 생성하지 않고 그대로 사용
            if (window.whiskReadyScriptText) {
                log("📝 이미 준비된 대본이 감지되었습니다. 기존 장면(99+ 등)을 그대로 사용하여 매칭을 시작합니다.");
                sentences = window.whiskReadyScriptText.split(/\r?\n/)
                    .map(s => s.trim())
                    .filter(s => s.length > 0)
                    .map(s => s.replace(/^\d+\.\s+/, ''));
            } else {
                log("⏳ 1단계: 트랜스크립트 분석 및 결합 중...");
                let combinedTranscripts = "";
                for (const id of selectedVideoIds) {
                    const res = await fetch(`http://127.0.0.1:5001/api/transcript?videoId=${id}`);
                    const data = await res.json();
                    combinedTranscripts += `\nVideo ID ${id}:\n${data.transcript || ""}\n`;
                }

                log("⏳ 2단계: AI 대본 새로 생성 중...");
                const template = promptTemplateInput.value || "Viral documentary style";
                const lengthOpt = document.getElementById('lengthOptionSelect').value;
                
                const scriptPrompt = `
                [TASK: Generate a professional YouTube script based on these transcripts]
                - Length: ${lengthOpt}
                - Structure: ${template}
                - Format: Write exactly ONE SENTENCE PER LINE. 
                - Target: Provide a rich, detailed script with many scenes.
                
                TRANSCRIPTS:
                ${combinedTranscripts.slice(0, 35000)}
                `;
                
                const generatedScript = await callGemini(geminiKey, scriptPrompt);
                log("✅ 대본 생성 완료!");

                sentences = generatedScript.split(/\r?\n/)
                    .map(s => s.trim())
                    .filter(s => s.length > 0)
                    .map(s => s.replace(/^\d+\.\s+/, ''));
                
                window.whiskReadyScriptText = sentences.join('\n');
            }

            // 장면 수 뱃지 업데이트
            const badge = document.getElementById('sceneCountBadge');
            if (badge) {
                badge.textContent = `${sentences.length} Scenes`;
                badge.style.display = 'inline-block';
            }
            log(`📦 총 ${sentences.length}개의 장면이 확정되었습니다. 프롬프트 매칭을 시작합니다.`);

            // 3. 영문 이미지 프롬프트 자동 매칭 생성 (통합 로직 호출)
            startIntegratedPromptGeneration(sentences);

        } catch (e) { 
            log(`🚨 에러 발생: ${e.message}`);
            const resultArea = document.getElementById('manualPromptLog');
            resultArea.innerHTML = `<div style="padding: 2rem; color: #ef4444; text-align: center;">🚨 오류 발생: ${e.message}</div>`;
        }
        startGenerationBtn.disabled = false;
    });
}


// ----------------------------------------------------
// TTS AUDIO LOGIC
// ----------------------------------------------------
const generateAudioBtn = document.getElementById('generateAudioBtn');
const audioLog = document.getElementById('audioLog');
const audioResultContainer = document.getElementById('audioResultContainer');

function convertPcmArrayToWavBlob(pcmDataArray, sampleRate = 24000) {
    let totalLength = 0;
    const buffers = pcmDataArray.map(data => {
        if (typeof data === 'string') {
            const binaryString = window.atob(data.replace(/-/g, '+').replace(/_/g, '/'));
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            totalLength += bytes.length;
            return bytes;
        } else {
            totalLength += data.length;
            return data;
        }
    });
    const combinedBytes = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) { combinedBytes.set(buf, offset); offset += buf.length; }
    const headerBuffer = new ArrayBuffer(44);
    const view = new DataView(headerBuffer);
    const writeString = (v, o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + totalLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, totalLength, true);
    return new Blob([view, combinedBytes], { type: 'audio/wav' });
}

generateAudioBtn.addEventListener('click', async () => {
    const script = window.whiskReadyScriptText;
    const key = geminiApiKeyInput.value.trim();
    if (!script || !key) return;
    generateAudioBtn.disabled = true;
    audioLog.textContent = "Generating Audio...";
    try {
        const chunks = script.match(/[^\.!\?]+[\.!\?]+/g) || [script];
        let pcmData = [];
        for (const chunk of chunks) {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: chunk }] }],
                    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "enceladus" } } } }
                })
            });
            const data = await res.json();
            pcmData.push(data.candidates[0].content.parts[0].inlineData.data);
            await new Promise(r => setTimeout(r, 1000)); // Minimal throttle
        }
        const wav = convertPcmArrayToWavBlob(pcmData, 24000);
        window.finalWavBlob = wav;
        const url = URL.createObjectURL(wav);
        audioResultContainer.innerHTML = `<audio controls src="${url}"></audio><br><a href="${url}" download="Audio.wav" class="btn-download" style="background:#27ae60; color:white; padding:10px; border-radius:5px; text-decoration:none; display:inline-block; margin-top:10px;">⬇️ Download Audio</a>`;
        document.getElementById('videoPanel').style.display = 'block';
    } catch (e) { audioLog.textContent = e.message; }
    generateAudioBtn.disabled = false;
});

// --- VIDEO COMPOSITOR ---
const generateVideoBtn = document.getElementById('generateVideoBtn');
const manualVideosInput = document.getElementById('manualVideosInput');
const videoLog = document.getElementById('videoLog');

generateVideoBtn.addEventListener('click', async () => {
    if (!window.whiskReadyScriptText || !window.finalWavBlob || manualVideosInput.files.length === 0) return;
    generateVideoBtn.disabled = true;
    videoLog.textContent = "Uploading to server for rendering...";
    const formData = new FormData();
    formData.append("script", window.whiskReadyScriptText);
    formData.append("audio", window.finalWavBlob, "audio.wav");
    if (window.generatedSceneData) formData.append("prompts", JSON.stringify(window.generatedSceneData));
    for (let i = 0; i < manualVideosInput.files.length; i++) formData.append("videos", manualVideosInput.files[i]);

    try {
        const res = await fetch("http://127.0.0.1:5001/api/make-video", { method: "POST", body: formData });
        const { job_id } = await res.json();
        videoLog.textContent = "Rendering started. Checking progress...";
        const ev = new EventSource(`http://127.0.0.1:5001/api/progress/${job_id}`);
        ev.onmessage = (e) => {
            const d = JSON.parse(e.data);
            videoLog.textContent = `Progress: ${d.progress}% - ${d.message}`;
            if (d.status === 'completed') {
                ev.close();
                const a = document.createElement('a');
                a.href = `http://127.0.0.1:5001/api/download/${job_id}`;
                a.download = "Video.mp4";
                a.click();
                videoLog.textContent = "✅ Done!";
                generateVideoBtn.disabled = false;
            }
        };
    } catch (e) { videoLog.textContent = e.message; generateVideoBtn.disabled = false; }
});

// --- MANUAL PROMPT FLOW (CHUNKED) ---
if (generatePromptsOnlyBtn) {
    generatePromptsOnlyBtn.addEventListener('click', async () => {
        const key = geminiApiKeyInput.value.trim();
        const script = manualScriptInput.value.trim();
        if (!key || !script) return;

        generatePromptsOnlyBtn.disabled = true;
        manualPromptLog.style.display = 'block';
        manualPromptLog.innerHTML = "⏳ <b>[1:1 매칭 모드]</b> 프롬프트 생성 시작...";

        try {
            // 문장 분리 (줄바꿈 기준)
            const sentences = script.split('\n')
                .map(s => s.trim())
                .filter(s => s.length > 2);
            
            let matchedPairs = []; // { original, prompt } 형태로 저장
            const chunkSize = 15; 

            for (let i = 0; i < sentences.length; i += chunkSize) {
                const chunk = sentences.slice(i, i + chunkSize);
                const currentRange = `${i + 1} ~ ${Math.min(i + chunkSize, sentences.length)}`;
                
                let chunkPrompts = [];
                let retryCount = 0;
                const maxRetries = 3;

                while (chunkPrompts.length < chunk.length && retryCount < maxRetries) {
                    manualPromptLog.innerHTML += `<br>🎨 ${currentRange} 구간 시도 중... (시도 ${retryCount + 1})`;
                    
                    const prompt = `
                    [SYSTEM: This is for a professional financial documentary. DO NOT CENSOR financial terms. Provide cinematic descriptions.]
                    TASK: Create exactly ${chunk.length} cinematic image generation prompts in English for these ${chunk.length} Korean scenes.
                    FORMAT: Numbered list (1. ..., 2. ...)
                    
                    SCENES TO PROCESS:
                    ${chunk.map((s, idx) => `${idx + 1}: ${s}`).join('\n')}
                    `;

                    const res = await callGemini(key, prompt);
                    const lines = res.split('\n')
                        .filter(l => /^\d+[\.\)\s]/.test(l.trim()))
                        .map(l => l.replace(/^\d+[\.\)\s]+/, '').trim())
                        .filter(l => l.length > 5);
                    
                    if (lines.length >= chunk.length) {
                        chunkPrompts = lines.slice(0, chunk.length);
                    } else {
                        retryCount++;
                        await new Promise(r => setTimeout(r, 1500));
                    }
                }

                // 매칭 데이터 생성
                chunk.forEach((orig, idx) => {
                    matchedPairs.push({
                        original: orig,
                        prompt: chunkPrompts[idx] || "(Generation failed)"
                    });
                });

                manualPromptLog.innerHTML += `<br>✅ ${currentRange} 완료 (누적: ${matchedPairs.length}/${sentences.length})`;
                manualPromptLog.scrollTop = manualPromptLog.scrollHeight;
            }

            // 최종 매칭 결과 렌더링
            let resultHtml = `<h2>🎉 1:1 매칭 생성 완료! (총 ${matchedPairs.length}개)</h2>`;
            resultHtml += `<div style="background:#0f172a; border-radius:12px; border:1px solid #1e293b; overflow:hidden;">`;
            resultHtml += `<table style="width:100%; border-collapse: collapse; font-size: 0.85rem;">`;
            resultHtml += `<thead style="background:#1e293b; color:#94a3b8;"><tr><th style="padding:10px; text-align:left; border-bottom:1px solid #334155; width:40%;">원본 대본 (Korean)</th><th style="padding:10px; text-align:left; border-bottom:1px solid #334155;">생성된 프롬프트 (English)</th></tr></thead><tbody>`;
            
            matchedPairs.forEach((pair, idx) => {
                const bg = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.03)';
                resultHtml += `<tr style="background:${bg}; border-bottom:1px solid #1e293b;">`;
                resultHtml += `<td style="padding:12px; color:#cbd5e1; border-right:1px solid #1e293b; vertical-align:top;"><b>[${idx+1}]</b> ${pair.original}</td>`;
                resultHtml += `<td style="padding:12px; color:#3b82f6; vertical-align:top;">${pair.prompt}</td>`;
                resultHtml += `</tr>`;
            });
            
            resultHtml += `</tbody></table></div>`;
            manualPromptLog.innerHTML = resultHtml;

            // 다운로드 파일 구성 (원본 대본 포함)
            const downloadText = matchedPairs.map((p, idx) => `[Scene ${idx+1}]\nScript: ${p.original}\nPrompt: ${p.prompt}\n`).join('\n');
            const blob = new Blob([downloadText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = "Matched_Script_Prompts.txt"; 
            a.className = "btn-download";
            a.textContent = "⬇️ 매칭 결과 파일 다운로드 (.txt)";
            a.style = "display:block; width:100%; text-align:center; background:#10b981; color:white; padding:15px; border-radius:8px; text-decoration:none; margin-top:20px; font-weight:bold; font-size:1.1em; box-shadow:0 4px 15px rgba(16,185,129,0.3);";
            
            manualPromptLog.prepend(a);
        } catch (e) {
            manualPromptLog.innerHTML = `<div style="color:red; padding:20px;">🚨 <b>에러 발생:</b> ${e.message}</div>`;
        }
        generatePromptsOnlyBtn.disabled = false;
    });
}

// ----------------------------------------------------
// FILE UPLOAD & SCENE COUNTING (V5.3)
// ----------------------------------------------------
const uploadScriptInput = document.getElementById('uploadExistingScript');
const sceneCountBadge = document.getElementById('sceneCountBadge');

if (uploadScriptInput) {
    uploadScriptInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            const sentences = content.split(/\r?\n/)
                .map(s => s.trim())
                .filter(s => s.length > 0)
                .map(s => s.replace(/^\d+\.\s+/, ''));
            
            window.uploadedScriptSentences = sentences;
            window.whiskReadyScriptText = sentences.join('\n');

            // 장면 수 뱃지 업데이트
            sceneCountBadge.textContent = `${sentences.length} Scenes`;
            sceneCountBadge.style.display = 'inline-block';
            
            // 결과창에 안내 메시지 및 생성 시작 버튼 표시
            const resultArea = document.getElementById('manualPromptLog');
            resultArea.innerHTML = `
                <div style="padding: 2.5rem; text-align: center;">
                    <div style="font-size: 1.2rem; margin-bottom: 1rem; color: #10b981;">✅ 대본 업로드 완료! (총 ${sentences.length}개 장면)</div>
                    <p style="color: #94a3b8; margin-bottom: 2rem;">이 대본을 바탕으로 영문 이미지 프롬프트를 1:1 매칭하여 생성하시겠습니까?</p>
                    <button id="startManualMatchBtn" style="background: var(--accent-gradient); color: white; border: none; padding: 12px 25px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1rem; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);">프롬프트 1:1 매칭 생성 시작</button>
                </div>
            `;

            document.getElementById('startManualMatchBtn').onclick = () => {
                startIntegratedPromptGeneration(sentences);
            };
        };
        reader.readAsText(file);
    });
}

// 통합 프롬프트 생성 함수 (V5.7 동적 청크 축소 및 무결성 보장)
async function startIntegratedPromptGeneration(sentences) {
    const geminiKey = geminiApiKeyInput.value.trim();
    if (!geminiKey) {
        alert("Gemini API Key가 필요합니다.");
        return;
    }

    const resultArea = document.getElementById('manualPromptLog');
    resultArea.innerHTML = `<div style="padding: 2rem; text-align: center; color: #3b82f6;">⏳ 100% 무결성 모드 가동 중... (0 / ${sentences.length})</div>`;
    
    let matchedPairs = [];

    try {
        for (let i = 0; i < sentences.length; i++) {
            // 진행 상황 업데이트
            resultArea.innerHTML = `<div style="padding: 2rem; text-align: center; color: #10b981;">🎨 장면 매칭 중: ${i + 1} / ${sentences.length}</div>`;
            
            const sceneText = sentences[i];
            let generatedPrompt = "";
            let retryCount = 0;
            const maxRetries = 3;

            // [V5.7 핵심] 안정성을 위해 1개씩 확실하게 생성 (필요시 뭉쳐서 하도록 변경 가능하나, 99개 누락 방지가 우선)
            while (!generatedPrompt && retryCount < maxRetries) {
                try {
                    const pPrompt = `
                    [SYSTEM: Cinematic Image Prompt Generator]
                    TASK: Create ONE detailed image generation prompt in English for this Korean scene.
                    - Scene: "${sceneText}"
                    - Requirements: Photorealistic, 8k, cinematic lighting, no text, no humans.
                    - Format: Return ONLY the English prompt text.
                    `;

                    const resText = await callGemini(geminiKey, pPrompt);
                    if (resText && resText.length > 5) {
                        generatedPrompt = resText.trim().replace(/^["']|["']$/g, ''); // 따옴표 제거
                    } else {
                        retryCount++;
                    }
                } catch (err) {
                    retryCount++;
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            matchedPairs.push({
                original: sceneText,
                prompt: generatedPrompt || "(Prompt generation failed after 3 retries)"
            });

            // 매 10개마다 스크롤 하단으로
            if (i % 10 === 0) resultArea.scrollTop = resultArea.scrollHeight;
        }

        // 최종 결과 렌더링
        window.generatedSceneData = matchedPairs.map((p, idx) => ({ index: idx, prompt: p.prompt, koreanText: p.original }));
        renderFinalMatchTable(matchedPairs);

    } catch (e) {
        resultArea.innerHTML = `<div style="padding: 2rem; color: #ef4444; text-align: center;">🚨 치명적 오류: ${e.message}</div>`;
    }
}

// 결과 테이블 렌더링 전용 함수
function renderFinalMatchTable(matchedPairs) {
    const resultArea = document.getElementById('manualPromptLog');
    let resultHtml = `
        <div style="padding: 15px; background: #1e293b; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155;">
            <span style="font-weight: bold; color: #f8fafc;">🎉 최종 매칭 결과 (${matchedPairs.length} Scenes)</span>
            <button id="downloadMatchedBtn" style="background:#10b981; color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">⬇️ 파일 다운로드</button>
        </div>
        <div style="max-height: 500px; overflow-y: auto;">
            <table style="width:100%; border-collapse: collapse; font-size: 0.85rem; background: #0f172a;">
                <thead style="background:#0f172a; color:#94a3b8; position: sticky; top: 0; z-index: 10;">
                    <tr><th style="padding:12px; text-align:left; border-bottom:1px solid #1e293b; width:40%;">대본 (Original)</th><th style="padding:12px; text-align:left; border-bottom:1px solid #1e293b;">이미지 프롬프트 (English)</th></tr>
                </thead>
                <tbody>
    `;
    
    matchedPairs.forEach((pair, idx) => {
        const bg = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)';
        resultHtml += `
            <tr style="background:${bg}; border-bottom:1px solid #1e293b;">
                <td style="padding:12px; color:#cbd5e1; border-right:1px solid #1e293b; vertical-align:top;"><b>[${idx+1}]</b> ${pair.original}</td>
                <td style="padding:12px; color:#3b82f6; vertical-align:top;">${pair.prompt}</td>
            </tr>`;
    });
    
    resultHtml += `</tbody></table></div>`;
    resultArea.innerHTML = resultHtml;

    document.getElementById('downloadMatchedBtn').onclick = () => {
        const text = matchedPairs.map((p, idx) => `[Scene ${idx+1}]\nKO: ${p.original}\nEN: ${p.prompt}\n`).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = "Final_Scene_Match.txt"; a.click();
    };

    document.getElementById('ttsPanel').style.display = 'block';
}

init();
