const express = require('express');
const { spawn } = require('child_process');
const { PassThrough } = require('stream');
const os = require('os');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 6160;
const CONFIG_PATH = path.join(__dirname, 'config.json');

// Ensure config file exists
if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({
        selectedDevice: null,
        ffmpeg: [
            "-f", "dshow",
            "-i", "audio=default",
            "-c:a", "aac",
            "-b:a", "320k",
            "-cutoff", "19000",
            "-f", "adts",
            "pipe:1"
        ]
    }, null, 2));
}

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// Load config
function loadConfig() {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// Detect available audio devices
function listAudioDevices() {
    return new Promise((resolve, reject) => {
        const probe = spawn("ffmpeg", [
            "-list_devices", "true",
            "-f", "dshow",
            "-i", "dummy"
        ]);

        let stderr = "";
        probe.stderr.on("data", data => stderr += data.toString());

        probe.on("close", () => {
            const lines = stderr.split("\n");
            const audioLines = lines.filter(line =>
                line.includes("(audio)") && line.includes("\"")
            );

            const devices = audioLines.map(line => {
                const match = line.match(/"(.*?)"/);
                return match?.[1];
            }).filter(Boolean);

            resolve(devices);
        });
    });
}

// List devices API
app.get("/devices", async (req, res) => {
    const config = loadConfig();
    try {
        const devices = await listAudioDevices();
        res.json({ devices, selected: config.selectedDevice });
    } catch (err) {
        res.status(500).send("Device listing failed.");
    }
});

// Set selected device
app.post("/set-device", (req, res) => {
    const config = loadConfig();
    config.selectedDevice = req.body.device;
    // Update input in ffmpeg args
    config.ffmpeg = config.ffmpeg.map(arg =>
        arg.startsWith("audio=") ? `audio=${req.body.device}` : arg
    );
    saveConfig(config);
    console.log("🎙️ Device updated to:", req.body.device);
    res.redirect("/settings.html");
});

// Set FFmpeg args via dropdowns
app.post("/set-ffmpeg", (req, res) => {
    const { bitrate, cutoff, format } = req.body;
    const config = loadConfig();

    const inputDriver = os.platform() === "win32" ? "dshow"
                      : os.platform() === "darwin" ? "avfoundation"
                      : "pulse";

    config.ffmpeg = [
        "-f", inputDriver,
        "-i", `audio=${config.selectedDevice || 'default'}`,
        "-c:a", "aac",
        "-b:a", bitrate,
        "-cutoff", cutoff,
        "-f", format,
        "pipe:1"
    ];

    saveConfig(config);
    console.log("⚙️ FFmpeg config updated:", config.ffmpeg);
    res.redirect("/settings.html");
});

// Audio streaming route
app.get("/stream", (req, res) => {
    const config = loadConfig();

    if (!config.selectedDevice) {
        return res.status(400).send("No audio input device selected.");
    }

    res.setHeader("Content-Type", "audio/aac");
    res.setHeader("Connection", "keep-alive");

    const pass = new PassThrough();
    const ffmpeg = spawn("ffmpeg", config.ffmpeg);

    console.log("🔊 FFmpeg streaming started...");

    ffmpeg.stdout.pipe(pass).pipe(res);

    ffmpeg.stderr.on("data", data => {
        const msg = data.toString();
        if (msg.toLowerCase().includes("error")) {
            console.error("FFmpeg:", msg);
        }
    });

    req.on("close", () => {
        console.log("❌ Client disconnected, killing FFmpeg.");
        ffmpeg.kill('SIGINT');
    });
});

// Start server
app.listen(PORT, () => {
    const ip = Object.values(os.networkInterfaces())
        .flat().find(x => x.family === 'IPv4' && !x.internal)?.address;
    console.log(`✅ Server running at: http://${ip}:${PORT}`);
});
