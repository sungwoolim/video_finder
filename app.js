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

let selectedVideoIds = new Set();

// Elements
const tableBody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const lengthChips = document.querySelectorAll('#lengthFilters .chip');
const dateChips = document.querySelectorAll('#dateFilters .chip');
const subsRange = document.getElementById('subsRange');
const subsValDisplay = document.getElementById('subsValDisplay');
const viewsRange = document.getElementById('viewsRange');
const viewsValDisplay = document.getElementById('viewsValDisplay');
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
const startGenerationBtn = document.getElementById('startGenerationBtn');
const generationLog = document.getElementById('generationLog');

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

    // Views Slider Filter
    viewsRange.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if (val === 0) {
            viewsValDisplay.textContent = 'Any (0)';
            filterState.viewsMin = 0;
        } else if (val >= 10000000) {
            viewsValDisplay.textContent = '10M+';
            filterState.viewsMin = 10000000;
        } else {
            viewsValDisplay.textContent = formatNumber(val) + '+';
            filterState.viewsMin = val;
        }
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

    // Clear previous selections on new search
    selectedVideoIds.clear();
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
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=30&q=${encodeURIComponent(query)}&type=video${dateQuery}&key=${apiKey}`;
        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) {
            const err = await searchRes.json();
            throw new Error(err.error?.message || "YouTube Search API Error");
        }
        const searchData = await searchRes.json();
        
        if (!searchData.items || searchData.items.length === 0) {
            MOCK_DATA = [];
            applyFiltersAndSort();
            return;
        }

        const videoIds = searchData.items.map(item => item.id.videoId).filter(id => id);
        const channelIds = [...new Set(searchData.items.map(item => item.snippet.channelId))];

        // 2. Fetch Video Details
        const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`;
        const videosRes = await fetch(videosUrl);
        if (!videosRes.ok) throw new Error("YouTube Videos API Error");
        const videosData = await videosRes.json();
        
        const statsMap = {};
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

        // 3. Fetch Channel Stats
        // Batch channel requests if there are too many (max 50)
        const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds.slice(0, 50).join(',')}&key=${apiKey}`;
        const channelsRes = await fetch(channelsUrl);
        if (!channelsRes.ok) throw new Error("YouTube Channels API Error");
        const channelsData = await channelsRes.json();
        
        const chanStatsMap = {};
        if (channelsData.items) {
            channelsData.items.forEach(c => {
                chanStatsMap[c.id] = parseInt(c.statistics?.subscriberCount || '0');
            });
        }

        // Combine
        const escapeHTML = (str) => {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };
        
        const results = [];
        for (const item of searchData.items) {
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
            if (e.target.checked) selectedVideoIds.add(id);
            else selectedVideoIds.delete(id);
            updateFabVisibility();
            updateSelectAllState();
        });
    });
};

const updateFabVisibility = () => {
    if (selectedVideoIds.size > 0) {
        fabContainer.style.display = 'block';
        selectedCount.textContent = selectedVideoIds.size;
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
            if (isChecked) selectedVideoIds.add(id);
            else selectedVideoIds.delete(id);
        });
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

        const stepCharTarget = Math.floor(targetCharCount / steps.length);

        startGenerationBtn.disabled = true;
        startGenerationBtn.textContent = "Processing...";
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
                log(`Extracting transcript for video ID: ${vid} (${idx}/${idsArray.length})...`);
                // Calls Cloudflare Function
                const res = await fetch(`/api/transcript?videoId=${vid}`);
                if (!res.ok) {
                    const err = await res.json().catch(()=>({}));
                    log(`Warning: Failed to extract ${vid}. ${err.error || res.statusText}`);
                } else {
                    const data = await res.json();
                    if (data.transcript) {
                        combinedTranscripts += `\n--- Video: ${vid} ---\n${data.transcript}\n`;
                        log(`Success for ${vid}.`);
                    } else {
                        log(`Warning: No transcript found for ${vid}.`);
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
                const currentStep = steps[i];
                log(`\\n▶ Generating Part ${i + 1}/${steps.length}: [ ${currentStep} ]...`);

                const prompt = `You are a professional YouTube scriptwriter. We are building a script step-by-step to reach a total length of approximately ${targetCharCount} characters.
This step focuses EXCLUSIVELY on: "${currentStep}".
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
4. Output just the raw script text. Do not add metadata, prefixes, or conversational filler like "Here is the next part".`;

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
                .replace(/\\[(.*?)\\]/g, '') // Remove markers
                .replace(/([.?!])([\\s\\n]+)/g, '$1\\n\\n') // Add double newlines after punctuation
                .split('\\n')
                .map(line => line.trim())
                .filter(line => line.length > 0) // Remove empty lines
                .join('\\n\\n');

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

            document.getElementById('ttsPanel').style.display = 'block';
            document.getElementById('audioLog').innerText = '✅ 모든 대본 생성이 완료되었습니다. 이제 [Generate Full Audio] 버튼을 눌러 TTS를 생성할 수 있습니다.';

        } catch(e) {
            log(`\\n🚨 ERROR: ${e.message}`);
        }

        startGenerationBtn.disabled = false;
        startGenerationBtn.textContent = "Start Multi-step Generation";
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

// Convert Array of Raw PCM Base64 to a single WAV Blob
function convertPcmBase64ToWavBlob(base64PcmStrings, sampleRate = 24000) {
    let totalLength = 0;
    const buffers = base64PcmStrings.map(b64 => {
        const binaryString = window.atob(b64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        totalLength += len;
        return bytes;
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
    const promptText = `Read aloud in an analytical tone:\n\n${chunkText}`;
    
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
                 await sleep(5000);
                 continue;
             }
             if (r === retries - 1) throw e;
        }
    }
}

generateAudioBtn.addEventListener('click', async () => {
    if (!window.whiskReadyScriptText) return;
    
    generateAudioBtn.disabled = true;
    generateAudioBtn.textContent = "Generating... Please wait";
    audioLog.innerHTML = "";
    audioResultContainer.innerHTML = "";
    
    // Chunk under 800 chars to avoid TTS cutoff/noise anomalies at tail
    const chunks = splitTextIntoChunks(window.whiskReadyScriptText, 800);
    alog(`✅ 전체 대본을 ${chunks.length}개의 조각(Chunk)으로 분할했습니다 (소음 끊김 방지용 최대 800자).\n`);
    
    const base64AudioArray = [];
    const _apiKey = document.getElementById('geminiApiKeyInput').value.trim();
    
    if (!_apiKey) {
        alog(`\n🚨 ERROR: API Key가 누락되었습니다.`);
        generateAudioBtn.disabled = false;
        generateAudioBtn.textContent = "Generate Full Audio (enceladus)";
        return;
    }
    
    try {
        for(let i=0; i<chunks.length; i++) {
           alog(`▶ Generating Audio Part ${i+1}/${chunks.length}...\n`);
           const b64 = await callGeminiAudio(_apiKey, chunks[i]);
           base64AudioArray.push(b64);
           alog(`✅ Part ${i+1} 오디오 생성 완료.\n`);
           
           if (i < chunks.length - 1) {
               alog(`⏳ 구글 서버 과열 방지를 위해 15초간 대기합니다...\n`);
               await new Promise(r => setTimeout(r, 15000));
           }
        }
        
        alog(`\n🚀 ${chunks.length}개의 조각난 오디오 파일을 1개의 무손실 WAV 파일로 병합합니다...`);
        const finalWavBlob = convertPcmBase64ToWavBlob(base64AudioArray, 24000);
        const finalWavUrl = URL.createObjectURL(finalWavBlob);
        
        audioResultContainer.innerHTML = `
            <div style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; border: 1px solid var(--glass-border);">
                <audio controls src="${finalWavUrl}" style="width: 100%; margin-bottom: 10px;"></audio>
                <a href="${finalWavUrl}" download="YT_Script_Voice_Enceladus.wav" style="display: block; background: var(--success, #27ae60); color: white; text-align: center; padding: 0.75rem; border-radius: 6px; text-decoration: none; font-weight: 600; box-shadow: 0 2px 10px rgba(39,174,96,0.3);">⬇️ 전체 오디오 파일 다운로드 (.wav)</a>
            </div>
        `;
        alog(`\n✅ 오디오 생성 및 병합 완벽히 성공! 결과물을 다운로드하거나 재생하세요.`);
        
    } catch(e) {
        alog(`\n🚨 ERROR: ${e.message}`);
    }
    generateAudioBtn.disabled = false;
    generateAudioBtn.textContent = "Generate Full Audio (enceladus)";
});

init();
