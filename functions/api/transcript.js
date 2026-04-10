import { YoutubeTranscript } from 'youtube-transcript';

export async function onRequest(context) {
    if (context.request.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            }
        });
    }

    try {
        const url = new URL(context.request.url);
        const videoId = url.searchParams.get("videoId");

        if (!videoId) {
            return new Response(JSON.stringify({ error: "videoId is required" }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }

        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        
        let text = "";
        for (const item of transcript) {
            text += item.text + " ";
        }

        return new Response(JSON.stringify({ transcript: text.trim() }), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    }
}
