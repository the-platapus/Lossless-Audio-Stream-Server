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
# Known Bugs
- Slight audio artifacts on pre-2011 Apple Devices due to pushing those damn things to their limits.
- FFmpeg audio config flags other than Input Source not working.
<br><br>
Developed with ❤️ for old and iconic Media Players of the golden age.