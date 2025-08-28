# FFmpeg Lossless Audio Streaming Server


## Features

- Optimized for compatibility with old-ass hardware like the 4th Gen iPod Touch.
- Cross-platform (Windows/macOS/Linux)

## Requirements

- Node.js
- FFmpeg installed AND in system PATH
- For Windows: Make sure you enable and set the input as the Default input.


### Instructions

1. Clone the Repo
```bash
git clone https://github.com/the-platapus/Lossless-Audio-Stream-Server.git
cd Lossless-Audio-Stream-Server
```
2. Install Dependencies
```bash
npm install
```
3. Run the Server
```bash
npm start
```

## Usage (Merged Clock + Lossless Stream)

1. Visit http://<LAN_IP>:6160 on your device.
2. Open Audio Settings to select input device (works on Windows/macOS/Linux).
3. For lossless streaming, set FFmpeg args to one of:
   - WAV (PCM 16-bit): `-c:a pcm_s16le -ar 44100 -ac 2 -f wav pipe:1`
   - FLAC (compressed lossless): `-c:a flac -compression_level 5 -f flac pipe:1`
4. Return to the home page and press Play to start the stream. The page shows a full-screen digital clock and weather (Webclock theme).

Notes:
- Content-Type is set dynamically from `-f` (wav/flac/adts/mp3/ogg).
- Autoplay may require a tap on older browsers. Use the Play button.

# Known Bugs
- Slight audio artifacts on pre-2011 Apple Devices due to pushing those damn things to their limits.
- If the stream fails after moving `config.json` between OSes, open Settings and reselect the input device to regenerate ffmpeg args.
<br><br>
Developed with ❤️ for old and iconic Media Players of the golden age.