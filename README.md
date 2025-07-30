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
Server will start on port 6160 by default and print your local IP:

✅ Server running at: http://192.168.x.x:6160
4. Access from Client
Open Safari (or any browser) on your iPod or other device:

 ```bash
http://<your-pc-ip>:6160
```
Click Set Input and then open:
 ```bash
http://<your-pc-ip>:6160/stream
```
⚙️ Configuration
## Audio Input Device
To change the input device:
1. Visit http://<your-pc-ip>:6160
2. Select an audio input from the dropdown
3. Press Set

## FFmpeg Settings
Visit /settings.html and adjust encoding settings:

Codec

Bitrate

Cutoff frequency

Output format (adts recommended for iOS)

These settings are saved to config.json.

🙏 Credits:
Developed with ❤️ for old and iconic Media Players of the golden age. Made with FFmpeg and Node.js.