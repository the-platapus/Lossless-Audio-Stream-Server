const express = require('express');
const { spawn } = require('child_process');
const { PassThrough } = require('stream');
const os = require('os');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const app = express();
const PORT = 6160;
const CONFIG_PATH = path.join(__dirname, 'config.json');
let logs = [];

// Ensure config exists
if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({
        selectedDevice: null,
        ffmpeg: [
            "-f", "dshow",
            "-i", "audio=default",
            "-c:a", "aac",
            "-b:a", "320k",
            "-fflags", "+bitexact",
            "-f", "adts",
            "pipe:1"
        ]
    }, null, 2));
}

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// Logging helper
function log(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}`;
    console.log(line);
    logs.push(line);
    if (logs.length > 200) logs.shift(); // Limit logs in memory
}

// Load config
function loadConfig() {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// List audio devices
function listAudioDevices() {
    return new Promise((resolve, reject) => {
        const probe = spawn("ffmpeg", ["-list_devices", "true", "-f", "dshow", "-i", "dummy"]);
        let stderr = "";

        probe.stderr.on("data", data => stderr += data.toString());
        probe.on("close", () => {
            const lines = stderr.split("\n");
            const audioLines = lines.filter(line => line.includes("(audio)") && line.includes("\""));
            const devices = audioLines.map(line => {
                const match = line.match(/"(.*?)"/);
                return match?.[1];
            }).filter(Boolean);
            resolve(devices);
        });
    });
}

// APIs

app.get("/devices", async (req, res) => {
    const config = loadConfig();
    try {
        const devices = await listAudioDevices();
        res.json({ devices, selected: config.selectedDevice });
    } catch (err) {
        res.status(500).send("Device listing failed.");
    }
});

app.post("/set-device", (req, res) => {
    const config = loadConfig();
    config.selectedDevice = req.body.device;
    config.ffmpeg = config.ffmpeg.map(arg =>
        arg.startsWith("audio=") ? `audio=${req.body.device}` : arg
    );
    saveConfig(config);
    log(`🎙️ Device updated to: ${req.body.device}`);
    res.redirect("/settings.html");
});

app.post("/set-ffmpeg", (req, res) => {
    const config = loadConfig();
    const newArgs = req.body.args.trim().split(/\s+/);
    const inputArg = `audio=${config.selectedDevice || 'default'}`;

    const driver = os.platform() === "win32" ? "dshow"
                 : os.platform() === "darwin" ? "avfoundation"
                 : "pulse";

    config.ffmpeg = ["-f", driver, "-i", inputArg, ...newArgs];
    saveConfig(config);
    log(`⚙️ FFmpeg args updated: ${config.ffmpeg.join(' ')}`);
    res.redirect("/settings.html");
});

// Stream route
app.get("/stream", (req, res) => {
    const config = loadConfig();
    if (!config.selectedDevice) return res.status(400).send("No audio input selected.");

    res.setHeader("Content-Type", "audio/aac");
    res.setHeader("Connection", "keep-alive");

    const pass = new PassThrough();
    const ffmpeg = spawn("ffmpeg", config.ffmpeg);

    log("🔊 FFmpeg streaming started...");

    ffmpeg.stdout.pipe(pass).pipe(res);

    ffmpeg.stderr.on("data", data => {
        const msg = data.toString();
        if (msg.toLowerCase().includes("error")) log(`❗ FFmpeg: ${msg}`);
    });

    req.on("close", () => {
        log("❌ Client disconnected, killing FFmpeg.");
        ffmpeg.kill('SIGINT');
    });
});

// Symbian stream route (AAC-LC)
// app.get("/stream-symbian", (req, res) => {
//     const config = loadConfig();
//     if (!config.selectedDevice) return res.status(400).send("No audio input selected.");

//     res.setHeader("Content-Type", "audio/aac");
//     res.setHeader("Connection", "keep-alive");

//     const pass = new PassThrough();
//     const ffmpeg = spawn("ffmpeg", [
//         "-f", os.platform() === "win32" ? "dshow" :
//               os.platform() === "darwin" ? "avfoundation" : "pulse",
//         "-i", `audio=${config.selectedDevice || 'default'}`,
//         "-c:a", "aac",         // AAC-LC (baseline profile)
//         "-profile:a", "aac_low",
//         "-b:a", "320k",        // more Symbian-friendly bitrate
//         "-f", "adts", "pipe:1"
//     ]);

//     log("📱 Symbian stream started...");

//     ffmpeg.stdout.pipe(pass).pipe(res);

//     ffmpeg.stderr.on("data", data => {
//         const msg = data.toString();
//         if (msg.toLowerCase().includes("error")) log(`❗ FFmpeg(Symbian): ${msg}`);
//     });

//     req.on("close", () => {
//         log("❌ Symbian client disconnected, killing FFmpeg.");
//         ffmpeg.kill('SIGINT');
//     });
// });


// Log endpoint
app.get("/logs", (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.send(logs.join("\n"));
});

// Prefill args for settings.html
app.get("/ffmpeg-args", (req, res) => {
    const config = loadConfig();
    const userArgs = config.ffmpeg.slice(4); // Skip: -f dshow -i audio=...
    res.send(userArgs.join(" "));
});

app.post("/reset-config", (req, res) => {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            fs.unlinkSync(CONFIG_PATH);
            log("🗑️ config.json deleted.");
        }
        // Recreate with default values
        fs.writeFileSync(CONFIG_PATH, JSON.stringify({
            selectedDevice: null,
            ffmpeg: [
                "-f", "dshow",
                "-i", "audio=default",
                "-c:a", "aac",
                "-b:a", "320k",
                "-fflags", "+bitexact",
                "-f", "adts",
                "pipe:1"
            ]
        }, null, 2));
        log("📝 config.json recreated with default values.");
        res.sendStatus(200);
    } catch (error) {
        log(`❗ Failed to reset configuration: ${error.message}`);
        res.status(500).send("Failed to reset configuration.");
    }
});

// Server
app.listen(PORT, () => {
    const ip = Object.values(os.networkInterfaces()).flat().find(x => x.family === 'IPv4' && !x.internal)?.address;
    log(`✅ Server running at: http://${ip}:${PORT}, press Q to stop server.`);
});

// Graceful shutdown
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
}
process.stdin.on('keypress', (str, key) => {
    if (key.name === 'q') {
        log("🛑 Quitting server...");
        process.exit();
    }
});
