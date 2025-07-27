const express = require("express");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const app = express();
const server = http.createServer(app);

const AUDIO_DEVICE = "audio=Stereo Mix (Realtek(R) Audio)"; // Change this to your input

app.use(express.static("public"));

app.get("/stream", (req, res) => {
    res.set({
        "Content-Type": "audio/wav",
        "Transfer-Encoding": "chunked",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache"
    });

    const ffmpeg = spawn("ffmpeg", [
        "-f", "dshow",
        "-i", AUDIO_DEVICE,
        "-ac", "2",                 // Stereo
        "-ar", "44100",             // 44.1 kHz sample rate
        "-c:a", "pcm_s16le",        // 16-bit PCM (WAV)
        "-f", "wav",                // WAV format
        "-"
    ]);

    console.log("FFmpeg started for streaming...");

    ffmpeg.stdout.pipe(res);

    ffmpeg.stderr.on("data", data => {
        console.error("FFmpeg:", data.toString());
    });

    res.on("close", () => {
        console.log("Client disconnected, killing FFmpeg.");
        ffmpeg.kill("SIGINT");
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
