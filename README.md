# iPod Touch Revival Project

My biggest project yet. This repo is devoted to my lovely little iPod Touch 4th gen, aimed to do justice to old iconic media players.
Many plans to make this device a media/infotainment beast in the future.

Currently this project only streams uncompressed 16-bit 44.1kHz stereo audio (WAV format) from your Windows PC over LAN.

## Features

- Uses FFmpeg and Node.js
- HTML5 `<audio>` player on the frontend
- Uncompressed WAV (1.4 Mbps) — audiophile-grade quality

## Prerequisites

- Windows PC with `Stereo Mix` or other system audio capture enabled
- [FFmpeg](https://ffmpeg.org/download.html) installed and in system PATH
- [Node.js](https://nodejs.org/) installed

## Setup

1. Clone this repo or copy the files
2. Run:

```bash
npm install
npm start

Keep vibing.

## FFmpeg Tweaks for Audiophiles

| Quality | FFmpeg Change    |
| ------- | ---------------- |
| 16-bit  | `-c:a pcm_s16le` |
| 24-bit  | `-c:a pcm_s24le` |
| 32-bit  | `-c:a pcm_s32le` |
| 48kHz   | `-ar 48000`      |

