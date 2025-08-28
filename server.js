const express = require('express');
const { spawn } = require('child_process');
const { PassThrough } = require('stream');
const os = require('os');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 6160;
const CONFIG_PATH = path.join(__dirname, 'config.json');
let logs = [];

// Hard-coded output (lossless WAV for legacy compatibility)
const HARD_CODED_ARGS = ["-c:a", "pcm_s16le", "-ar", "44100", "-ac", "2", "-f", "wav", "pipe:1"];

// Ensure config exists
if (!fs.existsSync(CONFIG_PATH)) {
    const driver = detectDriver();
    const defaultInput = defaultInputForDriver(driver);
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({
        selectedDevice: null,
        ffmpeg: [
            "-f", driver,
            "-i", defaultInput,
            ...HARD_CODED_ARGS
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
    return new Promise((resolve) => {
        const platform = os.platform();
        let args;

        if (platform === "win32") {
            // DirectShow (Windows)
            args = ["-list_devices", "true", "-f", "dshow", "-i", "dummy"];
        } else if (platform === "darwin") {
            // AVFoundation (macOS)
            args = ["-f", "avfoundation", "-list_devices", "true", "-i", ""];
        } else {
            // PulseAudio (Linux)
            args = ["-f", "pulse", "-list_devices", "true", "-i", "dummy"];
        }

        const probe = spawn("ffmpeg", args);
        let stderr = "";

        probe.stderr.on("data", data => stderr += data.toString());
        probe.on("close", () => {
            const lines = stderr.split("\n");
            const driver = detectDriver();
            let results = [];

            if (driver === "dshow") {
                // Example line: " \"Microphone (USB Audio Device)\" (audio)"
                const audioLines = lines.filter(line => line.includes("(audio)") && line.includes("\""));
                results = audioLines.map(line => {
                    const match = line.match(/"(.*?)"/);
                    const name = match?.[1];
                    if (!name) return null;
                    return { value: `audio=${name}`, label: name };
                }).filter(Boolean);
            } else if (driver === "avfoundation") {
                // Look for section "AVFoundation audio devices:"
                let inAudioSection = false;
                for (const line of lines) {
                    if (line.toLowerCase().includes("avfoundation audio devices")) {
                        inAudioSection = true;
                        continue;
                    }
                    if (inAudioSection) {
                        // Example: "[0] Built-in Microphone"
                        const m = line.match(/\[(\d+)\]\s+(.+)$/);
                        if (m) {
                            const idx = m[1];
                            const label = m[2].trim();
                            results.push({ value: `:${idx}`, label });
                        } else if (line.trim() === "" || line.includes("AVFoundation video devices")) {
                            // end of section
                            inAudioSection = false;
                        }
                    }
                }
                if (results.length === 0) {
                    results = [{ value: ":0", label: "Default (:0)" }];
                }
            } else {
                // pulse
                // Include Input devices and also add monitor sources for Output devices (system audio)
                let inInputSection = false;
                let inOutputSection = false;

                for (const line of lines) {
                    const lower = line.toLowerCase();

                    // Section switches
                    if (lower.includes("input devices")) {
                        inInputSection = true;
                        inOutputSection = false;
                        continue;
                    }
                    if (lower.includes("output devices")) {
                        inInputSection = false;
                        inOutputSection = true;
                        continue;
                    }

                    if (inInputSection) {
                        // Example: "  0: alsa_input.pci-0000_00_1f.3.analog-stereo"
                        const m = line.match(/^\s*(\d+):\s(.+)$/);
                        if (m) {
                            const dev = m[2].trim();
                            results.push({ value: dev, label: dev });
                        }
                    }

                    if (inOutputSection) {
                        // Example: "  0: alsa_output.pci-0000_00_1f.3.analog-stereo"
                        const m = line.match(/^\s*(\d+):\s(.+)$/);
                        if (m) {
                            const sink = m[2].trim();
                            const monitor = `${sink}.monitor`;
                            results.push({ value: monitor, label: `${sink} (monitor)` });
                        }
                    }
                }

                if (results.length === 0) {
                    results = [{ value: "default", label: "Default" }];
                }
            }

            resolve(results);
        });
    });
}

/**
 * Platform helpers
 */
function detectDriver() {
    return os.platform() === "win32" ? "dshow"
         : os.platform() === "darwin" ? "avfoundation"
         : "pulse";
}

function defaultInputForDriver(driver) {
    switch (driver) {
        case "dshow":
            return "audio=default";
        case "avfoundation":
            // ":<audio_index>" where 0 is usually default
            return ":0";
        case "pulse":
        default:
            return "default";
    }
}

function guessContentType(args) {
    // Find the last occurrence of -f in the full args list
    let fmt = null;
    for (let i = 0; i < args.length - 1; i++) {
        if (args[i] === "-f") {
            fmt = args[i + 1];
        }
    }
    switch ((fmt || "").toLowerCase()) {
        case "wav":
            return "audio/wav";
        case "flac":
            return "audio/flac";
        case "adts":
            return "audio/aac";
        case "mp3":
            return "audio/mpeg";
        case "ogg":
            return "audio/ogg";
        case "s16le":
        case "s24le":
        case "s32le":
            // Raw PCM; some legacy devices expect L16/L24. Fallback if needed.
            return "audio/L16";
        default:
            return "application/octet-stream";
    }
}

/**
 * Try to find a system loopback/virtual cable device for capturing system output.
 * Returns a value string usable as the ffmpeg -i input for the current driver, or null if not found.
 */
async function findSystemLoopback() {
    const devices = await listAudioDevices();
    const preferredKeywords = [
        "blackhole", "soundflower", "loopback", "vb-cable", "stereo mix",
        "what u hear", "voicemeeter", "monitor"
    ];
    for (const dev of devices) {
        const label = (dev.label || "").toLowerCase();
        if (preferredKeywords.some(k => label.includes(k))) {
            return dev.value || dev;
        }
    }

    // Linux fallback: try pactl default sink monitor if available
    if (detectDriver() === "pulse") {
        try {
            const { spawnSync } = require("child_process");
            const out = spawnSync("pactl", ["get-default-sink"], { encoding: "utf8" });
            if (out && out.status === 0) {
                const sink = out.stdout.trim();
                if (sink) return `${sink}.monitor`;
            }
        } catch (_) { /* ignore */ }
    }
    return null;
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
    const driver = detectDriver();
    config.selectedDevice = req.body.device;

    config.ffmpeg = ["-f", driver, "-i", config.selectedDevice || defaultInputForDriver(driver), ...HARD_CODED_ARGS];

    saveConfig(config);
    log(`🎙️ Device updated to: ${req.body.device}`);
    res.redirect("/");
});

app.post("/set-ffmpeg", (req, res) => {
    res.status(410).send("FFmpeg arguments are now hard-coded on the server.");
});

app.post("/select-system-audio", async (req, res) => {
    const driver = detectDriver();
    try {
        const loop = await findSystemLoopback();
        if (!loop) {
            log("⚠️ No system loopback device found.");
            return res.status(404).send("No system loopback device found on this OS. Install a virtual/loopback device (e.g., BlackHole on macOS or VB-CABLE on Windows) and retry.");
        }
        const config = loadConfig();
        config.selectedDevice = loop;
        config.ffmpeg = ["-f", driver, "-i", loop, ...HARD_CODED_ARGS];
        saveConfig(config);
        log(`🎛️ Selected system loopback device: ${loop}`);
        res.redirect("/");
    } catch (e) {
        log(`❗ System audio selection failed: ${e.message}`);
        res.status(500).send("System audio selection failed.");
    }
});

// Stream route
app.get("/stream", (req, res) => {
    const config = loadConfig();
    if (!config.selectedDevice) return res.status(400).send("No audio input selected.");

    const contentType = guessContentType(config.ffmpeg);
    res.setHeader("Content-Type", contentType);
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

// Log endpoint
app.get("/logs", (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.send(logs.join("\n"));
});

// Prefill args for settings.html
app.get("/ffmpeg-args", (req, res) => {
    // Not used by UI anymore; return hard-coded args for reference
    res.send(HARD_CODED_ARGS.join(" "));
});

// Server
app.listen(PORT, () => {
    const ip = Object.values(os.networkInterfaces()).flat().find(x => x.family === 'IPv4' && !x.internal)?.address;
    log(`✅ Server running at: http://${ip}:${PORT}`);
});
