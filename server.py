import os
import json
import re
import urllib.request
import urllib.parse
from http.server import SimpleHTTPRequestHandler, HTTPServer
from urllib.error import URLError, HTTPError
import random

ENV_PATH = "/Users/sungwoo/.gemini/antigravity/scratch/yt-gem-finder/.env"

def load_api_key():
    if not os.path.exists(ENV_PATH):
        raise Exception(f".env file not found at {ENV_PATH}")
    
    with open(ENV_PATH, 'r') as f:
        for line in f:
            line = line.strip()
            if line.startswith('YOUTUBE_API_KEY='):
                return line.split('=', 1)[1].strip('"\'')
    
    raise Exception("YOUTUBE_API_KEY not found in .env")

def parse_yt_duration(duration_str):
    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration_str)
    if not match:
        return 0
    h, m, s = match.groups()
    total = 0
    if h: total += int(h) * 3600
    if m: total += int(m) * 60
    if s: total += int(s)
    return total

class YTHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/api/search'):
            self.handle_api_search()
        else:
            super().do_GET()

    def handle_api_search(self):
        try:
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            q = query.get('q', [''])[0]
            
            if not q:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error": "Query parameter q is required"}')
                return

            api_key = load_api_key()

            # 1. Search API
            search_url = f"https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=30&q={urllib.parse.quote(q)}&type=video&key={api_key}"
            search_req = urllib.request.Request(search_url)
            with urllib.request.urlopen(search_req) as response:
                search_data = json.loads(response.read().decode())
            
            video_ids = [item['id']['videoId'] for item in search_data.get('items', [])]
            if not video_ids:
                self.send_json([])
                return

            channel_ids = list(set([item['snippet']['channelId'] for item in search_data.get('items', [])]))

            # 2. Videos API
            videos_url = f"https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id={','.join(video_ids)}&key={api_key}"
            videos_req = urllib.request.Request(videos_url)
            with urllib.request.urlopen(videos_req) as response:
                videos_data = json.loads(response.read().decode())
            
            # Map video stats by id
            stats_map = {}
            for v in videos_data.get('items', []):
                stats_map[v['id']] = {
                    'viewCount': int(v['statistics'].get('viewCount', 0)),
                    'duration': parse_yt_duration(v['contentDetails'].get('duration', 'PT0S'))
                }

            # 3. Channels API to get accurate subscriber counts
            channels_url = f"https://www.googleapis.com/youtube/v3/channels?part=statistics&id={','.join(channel_ids)}&key={api_key}"
            channels_req = urllib.request.Request(channels_url)
            with urllib.request.urlopen(channels_req) as response:
                channels_data = json.loads(response.read().decode())
            
            chan_stats_map = {}
            for c in channels_data.get('items', []):
                chan_stats_map[c['id']] = int(c['statistics'].get('subscriberCount', 0))

            # 4. Combine
            results = []
            for item in search_data.get('items', []):
                vid = item['id']['videoId']
                snippet = item['snippet']
                stats = stats_map.get(vid, {'viewCount': 0, 'duration': 0})
                
                views = stats['viewCount']
                fake_ctr = round(random.uniform(3.0, 12.0), 1)
                fake_impressions = int(views / (fake_ctr / 100)) if views > 0 else 0
                
                # REAL Subs!
                real_subs = chan_stats_map.get(snippet['channelId'], 0)
                
                thumb_url = snippet['thumbnails'].get('medium', snippet['thumbnails'].get('default'))['url']

                results.append({
                    'id': vid,
                    'title': snippet['title'],
                    'channel': snippet['channelTitle'],
                    'category': '',
                    'duration': stats['duration'],
                    'views': views,
                    'subs': real_subs,
                    'impressions': fake_impressions,
                    'ctr': fake_ctr,
                    'thumb': thumb_url,
                    'publishedAt': snippet.get('publishedAt', '')
                })

            self.send_json(results)

        except HTTPError as e:
            error_data = e.read().decode()
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'YouTube API error', 'details': error_data}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def send_json(self, data):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

if __name__ == '__main__':
    port = 8000
    server_address = ('', port)
    httpd = HTTPServer(server_address, YTHandler)
    print(f"Starting server on port {port}...")
    httpd.serve_forever()
