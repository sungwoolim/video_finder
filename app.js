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
    length: 'all', // 'all', 'shorts', 'medium', 'long'
    subsMax: Infinity
};

let sortState = {
    column: 'ctr',
    descending: true
};

// Elements
const tableBody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const lengthChips = document.querySelectorAll('#lengthFilters .chip');
const subsRange = document.getElementById('subsRange');
const subsValDisplay = document.getElementById('subsValDisplay');
const headers = document.querySelectorAll('th.sortable');

// Initialization
const init = () => {
    setupEventListeners();
    updateUI();
};

const setupEventListeners = () => {
    // Search
    searchBtn.addEventListener('click', fetchVideos);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') fetchVideos();
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

    filterState.search = query.toLowerCase();

    // Show loading
    tableBody.innerHTML = `
        <tr>
            <td colspan="5">
                <div class="empty-state">
                    <h2>Loading data from YouTube...</h2>
                </div>
            </td>
        </tr>
    `;

    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) {
            const errDetails = await res.text();
            throw new Error(`Failed to fetch data: ${errDetails}`);
        }
        
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const escapeHTML = (str) => {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        };
        
        MOCK_DATA = data.map(item => ({
            ...item,
            title: escapeHTML(item.title)
        }));

        applyFiltersAndSort();

    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="5">
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

        // Apply new Maximum Sub slider
        if (video.subs > filterState.subsMax) return false;

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
                <td colspan="5">
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
