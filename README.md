# 🎧 Minimal AAC Audio Streaming Server

This is a low-latency audio streaming server that captures system audio (e.g., Stereo Mix or Microphone) and streams it live in AAC format — perfect for old iOS devices like the iPod Touch 4th Gen.

## ✅ Features

- Streams live audio via FFmpeg over HTTP
- Optimized for compatibility with iOS 6 Safari
- Minimal HTML UI for selecting audio input and adjusting FFmpeg settings
- Supports persistent configuration via `config.json`
- Cross-platform (Windows/macOS/Linux)

## 🛠 Requirements

- Node.js (v14 or later recommended)
- FFmpeg installed and accessible in system PATH
- For Windows: `Stereo Mix` or microphone input available via DirectShow (`dshow`)
- For Linux/macOS: Use `avfoundation` (macOS) or `alsa` (Linux)

## 🚀 Getting Started
### 1. Clone the Repo

```bash
git clone https://github.com/yourusername/audio-stream-server.git
cd audio-stream-server
```
2. Install Dependencies
```bash
yarn install
```
3. Run the Server
```bash
yarn start
```

<br><br>
Developed with ❤️ for old and iconic Media Players of the golden age. Made with FFmpeg and Node.js.