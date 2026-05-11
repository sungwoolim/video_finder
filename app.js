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
let selectedVideosMap = new Map();
let generatedImagePrompts = []; // 이미지 프롬프트 다운로드용

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
const startGenerationBtn = document.getElementById('startGenerationBtn');
const generationLog = document.getElementById('generationLog');
const basketList = document.getElementById('basketList');
const basketCount = document.getElementById('basketCount');
const clearBasketBtn = document.getElementById('clearBasketBtn');
const recommendTopicBtn = document.getElementById('recommendTopicBtn');
const topicRecommendationResult = document.getElementById('topicRecommendationResult');
const videoTopicInput = document.getElementById('videoTopicInput');
const downloadPromptsBtn = document.getElementById('downloadPromptsBtn');

// Manual Prompt Elements
const generatePromptsOnlyBtn = document.getElementById('generatePromptsOnlyBtn');
const manualScriptInput = document.getElementById('manualScriptInput');
const manualPromptLog = document.getElementById('manualPromptLog');

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

    if (downloadPromptsBtn) {
        downloadPromptsBtn.addEventListener('click', () => {
            if (generatedImagePrompts.length === 0) {
                alert("다운로드할 프롬프트가 없습니다.");
                return;
            }
            const blob = new Blob([generatedImagePrompts.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `image_prompts_${new Date().getTime()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
};

const fetchVideos = async () => {
    const query = searchInput.value.trim();
    if (!query) return;
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) { alert("Please enter YouTube API Key!"); return; }

    filterState.search = query.toLowerCase();
    selectedVideoIds.clear();
    updateFabVisibility();

    tableBody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><h2>Loading...</h2></div></td></tr>`;

    try {
        // 날짜 필터를 publishedAfter 파라미터로 변환
        let publishedAfter = '';
        const now = new Date();
        if (filterState.date === 'week') {
            const d = new Date(now); d.setDate(d.getDate() - 7);
            publishedAfter = d.toISOString();
        } else if (filterState.date === 'month') {
            const d = new Date(now); d.setMonth(d.getMonth() - 1);
            publishedAfter = d.toISOString();
        } else if (filterState.date === 'year') {
            const d = new Date(now); d.setFullYear(d.getFullYear() - 1);
            publishedAfter = d.toISOString();
        }
        const dateParam = publishedAfter ? `&publishedAfter=${encodeURIComponent(publishedAfter)}` : '';
        const searchRes = await fetch(`http://127.0.0.1:5001/api/search?query=${encodeURIComponent(query)}&apiKey=${apiKey}${dateParam}`);
        const searchData = await searchRes.json();
        if (!searchRes.ok) throw new Error(searchData.error || "Search API Error");

        if (searchData.length === 0) { MOCK_DATA = []; applyFiltersAndSort(); return; }

        // 파이썬 서버에서 받아온 풍부한 데이터를 MOCK_DATA 형식으로 변환
        MOCK_DATA = searchData.map(item => ({
            id: item.videoId,
            title: item.title,
            channel: item.channel || "YouTube Video",
            duration: item.duration || 0,
            views: item.views || 0,
            subs: item.subs || 0,
            thumb: item.thumbnail,
            publishedAt: item.publishedAt || new Date().toISOString()
        }));

        applyFiltersAndSort();
    } catch (e) {
        tableBody.innerHTML = `<tr><td colspan="7"><div class="empty-state" style="color:var(--danger)"><h2>Error</h2><p>${e.message}</p></div></td></tr>`;
    }
};

const applyFiltersAndSort = () => {
    const now = new Date();
    let dateThreshold = null;
    if (filterState.date === 'week') {
        dateThreshold = new Date(now); dateThreshold.setDate(dateThreshold.getDate() - 7);
    } else if (filterState.date === 'month') {
        dateThreshold = new Date(now); dateThreshold.setMonth(dateThreshold.getMonth() - 1);
    } else if (filterState.date === 'year') {
        dateThreshold = new Date(now); dateThreshold.setFullYear(dateThreshold.getFullYear() - 1);
    }

    let filtered = MOCK_DATA.filter(v => {
        if (filterState.length === 'shorts' && v.duration >= 60) return false;
        if (filterState.length === 'medium' && (v.duration < 60 || v.duration > 1200)) return false;
        if (filterState.length === 'long' && v.duration <= 1200) return false;
        if (v.subs > filterState.subsMax) return false;
        if (v.views < filterState.viewsMin) return false;
        if (dateThreshold && new Date(v.publishedAt) < dateThreshold) return false;
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
            <td><div class="video-cell"><img src="${v.thumb}" class="thumbnail"><div class="video-info"><a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" style="color: white; text-decoration: none;" class="video-title">${v.title}</a><div class="channel-name">${v.channel}</div></div></div></td>
            <td class="metric-cell">${v.publishedAt.split('T')[0]}</td>
            <td class="metric-cell">${formatNumber(v.views)}</td>
            <td class="metric-cell">${formatNumber(v.subs)}</td>
            <td class="metric-cell">-</td>
            <td class="metric-cell">-</td>
        `;
        tableBody.appendChild(tr);
    });

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
            updateFabVisibility();
            updateBasketView();
        });
    });
};

const updateFabVisibility = () => {
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
    });
};

async function callGemini(apiKey, prompt) {
    const keys = apiKey.split(',').map(k => k.replace(/[\s\u200B-\u200D\uFEFF]/g, '').trim()).filter(k => k);
    if (keys.length === 0) throw new Error("API 키가 입력되지 않았습니다.");
    
    const models = ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-flash-lite-latest"];
    let allErrors = [];
    
    for (const currentKey of keys) {
        for (const modelName of models) {
            for (const ver of ["v1beta", "v1"]) {
                try {
                    // 기본 대기
                    await new Promise(r => setTimeout(r, 1000));
                    
                    const res = await fetch(`http://127.0.0.1:5001/api/gemini`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            apiKey: currentKey,
                            model: modelName,
                            version: ver,
                            payload: { contents: [{ parts: [{ text: prompt }] }] }
                        })
                    });
                    
                    const data = await res.json();
                    if (res.ok && data.candidates && data.candidates[0].content) {
                        return data.candidates[0].content.parts[0].text;
                    }
                    
                    const errDetail = data.error ? (data.error.message || JSON.stringify(data.error)) : `HTTP ${res.status}`;
                    
                    // 스마트 대기 로직: 에러 메시지에서 대기 시간(초) 추출
                    const retryMatch = errDetail.match(/Please retry in ([\d.]+)s/);
                    if (retryMatch) {
                        const waitSec = parseFloat(retryMatch[1]) + 0.5; // 여유있게 0.5초 더 대기
                        console.warn(`🛑 Quota Limit! Waiting ${waitSec}s as requested by Google...`);
                        await new Promise(r => setTimeout(r, waitSec * 1000));
                    }

                    allErrors.push(`[${ver}/${modelName}] ${errDetail}`);
                    if (res.status === 429) continue; // 429인 경우 다음 모델이나 버전으로 계속 시도
                } catch (e) {
                    allErrors.push(e.message);
                }
            }
        }
    }
    
    throw new Error(`모든 시도 실패: ${allErrors.slice(-1)[0]}\n팁: AI Studio에서 'Generative Language API'가 활성 상태인지 확인해 보세요.`);
}

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
                log("📝 이미 준비된 대본이 감지되었습니다. 기존 장면을 그대로 사용하여 매칭을 시작합니다.");
                sentences = window.whiskReadyScriptText.split(/\r?\n/)
                    .map(s => s.trim())
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
                [CRITICAL TASK: Generate a highly professional, engaging YouTube script based on the provided transcripts]
                
                # Requirements
                1. Format: Write exactly ONE SENTENCE PER LINE. No paragraphs.
                2. Style: ${template}
                3. Target Length: ${lengthOpt} (IMPORTANT: If the source transcripts do not have enough material to reach this length, do NOT force it. Prioritize density and quality over length.)
                
                # STRICT NEGATIVE CONSTRAINTS (PENALTY FOR VIOLATION)
                - DO NOT REPEAT YOURSELF: Never restate the same statistics, quotes, or structural points in different words.
                - NO INFINITE LOOPS: Do not introduce a topic (e.g., "3 key metrics"), then re-introduce the exact same topic later in the script.
                - PROGRESSIVE LOGIC: Every sentence must advance the narrative forward. If you run out of source material, naturally conclude the script rather than repeating the introduction.
                - NO HALLUCINATIONS: Do not invent facts that are not reasonably derived from the transcript or general knowledge context.
                
                TRANSCRIPTS:
                ${combinedTranscripts.slice(0, 35000)}
                `;
                
                const generatedScript = await callGemini(geminiKey, scriptPrompt);
                log("✅ 대본 생성 완료!");

                sentences = generatedScript.split(/\r?\n/)
                    .map(s => s.trim())
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
    
    const alog = (msg) => { 
        audioLog.innerHTML += msg + "<br>"; 
        audioLog.scrollTop = audioLog.scrollHeight; 
    };
    
    const _apiKey = document.getElementById('geminiApiKeyInput').value.trim();
    const openAiApiKey = document.getElementById('openAiApiKeyInput')?.value.trim();
    const engine = document.getElementById('ttsEngineSelect')?.value || 'gemini';
    
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
        
        if (audioLog) {
            audioLog.innerHTML += `<br>✅ 사용자가 직접 오디오 파일(${file.name})을 업로드했습니다.<br>`;
            audioLog.scrollTop = audioLog.scrollHeight;
        }
        
        document.getElementById('videoPanel').style.display = 'block';
        document.getElementById('videoLog').style.display = 'block';
        document.getElementById('videoLog').innerText = '✅ 오디오가 준비되었습니다! 이제 AutoWhisk 이미지들을 여러 장 선택하고 유튜브 영상 제작을 시작하세요.';
        
        // Reset input so user can re-upload if needed
        audioUploadInput.value = '';
    });
}

// --- VIDEO COMPOSITOR ---
const generateVideoBtn = document.getElementById('generateVideoBtn');
const manualVideosInput = document.getElementById('manualVideosInput');
const videoLog = document.getElementById('videoLog');

generateVideoBtn.addEventListener('click', async () => {
    if (!window.whiskReadyScriptText) {
        alert("대본이 없습니다! 대본을 업로드하거나 오디오를 먼저 생성해주세요.");
        return;
    }
    if (!window.finalWavBlob) {
        alert("오디오 파일이 없습니다! 오디오를 업로드하거나 생성해주세요.");
        return;
    }
    if (manualVideosInput.files.length === 0) {
        alert("비디오/이미지 소스가 없습니다! 렌더링할 미디어를 먼저 선택해주세요.");
        return;
    }
    
    generateVideoBtn.disabled = true;
    videoLog.style.display = 'block';
    videoLog.textContent = "Uploading to server for rendering...";
    const formData = new FormData();
    formData.append("script", window.whiskReadyScriptText);
    formData.append("audio", window.finalWavBlob, "audio.wav");
    if (window.generatedSceneData) formData.append("prompts", JSON.stringify(window.generatedSceneData));
    for (let i = 0; i < manualVideosInput.files.length; i++) formData.append("videos", manualVideosInput.files[i]);
    
    const srtFileInput = document.getElementById('srtFileInput');
    if (srtFileInput && srtFileInput.files.length > 0) {
        formData.append("srt", srtFileInput.files[0]);
    }

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
    const log = (msg) => { console.log(msg); };
    
    resultArea.innerHTML = `<div style="padding: 2rem; text-align: center; color: #3b82f6;">🚀 클래식 엔진(One-Shot) 가동 중... (총 ${sentences.length}개 장면 분석)</div>`;
    
    const validSentences = sentences.map(s => s.trim());
    let matchedPairs = [];

    try {
        log(`⏳ 4/30 스타일 One-Shot 생성 시작... (총 ${validSentences.length}개 장면)`);
        
        const pPrompt = `
        [TASK: Create cinematic image prompts in English for EACH scene]
        - Total Scenes: ${validSentences.length}
        - Format: [Number] Prompt text
        - Style: Photorealistic, 8k, cinematic, high detail, no humans.
        - Important: Provide EXACTLY ${validSentences.length} lines. Each line must start with [Scene Number].
        
        SCENES:
        ${validSentences.map((s, idx) => `[${idx + 1}] ${s}`).join('\n')}
        `;

        const resText = await callGemini(geminiKey, pPrompt);
        
        // 정밀 파싱 (번호 기준)
        const lines = resText.split('\n')
            .filter(l => /\[\d+\]/.test(l.trim()) || /^\d+[\.\)\s]/.test(l.trim()))
            .map(l => l.replace(/^\[\d+\]/, '').replace(/^\d+[\.\)\s]+/, '').trim())
            .filter(l => l.length > 5);

        // 1:1 매칭 및 누락 보정
        generatedImagePrompts = []; // 초기화
        for (let i = 0; i < validSentences.length; i++) {
            let prompt = lines[i];
            
            // 누락된 경우 개별 보충 생성 (최종 안전망)
            if (!prompt || prompt.length < 5) {
                console.warn(`⚠️ ${i+1}번 장면 누락/오류 감지, 개별 복구 중...`);
                try {
                    prompt = await callGemini(geminiKey, `Create ONE cinematic image prompt for: "${validSentences[i]}"`);
                } catch(e) {
                    prompt = `(Generation failed: ${i+1})`;
                }
            }
            
            matchedPairs.push({
                original: validSentences[i],
                prompt: prompt
            });
            generatedImagePrompts.push(prompt.replace(/\n/g, ' ')); // 줄바꿈 제거하여 한 줄로 저장
        }

        // 결과 테이블 렌더링
        window.generatedSceneData = matchedPairs.map((p, idx) => ({ index: idx, prompt: p.prompt, koreanText: p.original }));
        renderFinalMatchTable(matchedPairs);
        log("✅ 클래식 엔진 생성 완료!");

    } catch (e) {
        resultArea.innerHTML = `<div style="padding: 2rem; color: #ef4444; text-align: center;">🚨 생성 에러: ${e.message}</div>`;
    }
}

// 결과 테이블 렌더링 전용 함수
function renderFinalMatchTable(matchedPairs) {
    const resultArea = document.getElementById('manualPromptLog');
    
    // 다운로드 버튼 표시
    if (downloadPromptsBtn) downloadPromptsBtn.style.display = 'block';

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
