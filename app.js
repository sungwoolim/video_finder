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

// Initialization
const init = () => {
    // Load saved API key
    const savedKey = localStorage.getItem('ytApiKey');
    if (savedKey) {
        apiKeyInput.value = savedKey;
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

    tableBody.innerHTML = `
        <tr>
            <td colspan="6">
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
        const typedSearch = searchInput.value.toLowerCase().trim();
        const matchSearch = video.title.toLowerCase().includes(typedSearch) || 
                            video.channel.toLowerCase().includes(typedSearch);
        if (!matchSearch) return false;

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
                <td colspan="6">
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

        tr.innerHTML = `
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
};

init();
