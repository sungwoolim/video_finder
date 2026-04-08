export async function onRequestGet(context) {
    const { request, env } = context;
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q) {
        return new Response(JSON.stringify({ error: "Query parameter q is required" }), { 
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    const apiKey = env.YOUTUBE_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: "YouTube API key not configured on Cloudflare" }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        // 1. Search API
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=30&q=${encodeURIComponent(q)}&type=video&key=${apiKey}`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        
        if (!searchData.items || searchData.items.length === 0) {
            return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
        }

        const videoIds = searchData.items.map(item => item.id.videoId);
        const channelIds = [...new Set(searchData.items.map(item => item.snippet.channelId))];

        // 2. Videos API
        const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`;
        const videosRes = await fetch(videosUrl);
        const videosData = await videosRes.json();

        const statsMap = {};
        if (videosData.items) {
            for (const v of videosData.items) {
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
            }
        }

        // 3. Channels API
        const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds.join(',')}&key=${apiKey}`;
        const channelsRes = await fetch(channelsUrl);
        const channelsData = await channelsRes.json();
        
        const chanStatsMap = {};
        if (channelsData.items) {
            for (const c of channelsData.items) {
                chanStatsMap[c.id] = parseInt(c.statistics?.subscriberCount || '0');
            }
        }

        // 4. Combine
        const results = [];
        for (const item of searchData.items) {
            const vid = item.id.videoId;
            const snippet = item.snippet;
            
            // Search result items sometimes don't have videoId if it's a channel/playlist match. Skip if undefined.
            if (!vid) continue;
            
            const stats = statsMap[vid] || { viewCount: 0, duration: 0 };
            
            const views = stats.viewCount;
            const fakeCtr = Number((Math.random() * (12.0 - 3.0) + 3.0).toFixed(1));
            const fakeImpressions = views > 0 ? Math.floor(views / (fakeCtr / 100)) : 0;
            const realSubs = chanStatsMap[snippet.channelId] || 0;
            
            const thumbUrl = snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url;

            results.push({
                id: vid,
                title: snippet.title,
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

        return new Response(JSON.stringify(results), { 
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            } 
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.toString() }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
