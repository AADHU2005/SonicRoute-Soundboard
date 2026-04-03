# 🌊 SonicRoute

**SonicRoute** is a highly efficient, premium desktop soundboard designed for streamers, gamers, and content creators. Built with Electron, it features advanced dual-audio routing through Virtual Audio Cables, a built-in mobile web remote via an embedded local Express server, and a sleek dark-mode aesthetic.

![SonicRoute Logo](build/icon.png)

## Overview & Features
- **🚀 Virtual Audio Routing:** A custom dual-audio engine allows you to monitor sounds locally in your headphones while simultaneously routing them to a specific Virtual Audio Cable (VAC) for integration into Discord or your Twitch microphone feed.
- **📱 Built-In Mobile Remote:** SonicRoute seamlessly runs an instance of Express on your local network. Scan the in-app QR code to instantly pull up a touch-friendly remote on your smartphone and trigger audio over WiFi!
- **⌨️ Global Hotkeys:** Control your board instantly from inside full-screen games without alt-tabbing.
- **🛑 Panic Kill-Switch:** A global `Ctrl+Shift+End` panic button halts all overlapping audio immediately.
- **🎚️ Individual Volume Memory:** Persisted volume sliders let you normalize wildly different MP3 tracks so you never blow out your viewers' ears.
- **🥷 Stealth Mode (System Tray):** Minimizes completely to the Windows System Tray to prevent taskbar bloat while keeping your global commands and mobile web server invisibly active.
- **📂 Drag & Drop Engine:** Add massive libraries of sounds instantly by dragging MP3s directly into the app window.

## Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/sonicroute.git
   cd sonicroute
   ```
2. **Install dependencies:**
   Ensure you have Node.js installed, then run:
   ```bash
   npm install
   ```
3. **Run the local development server:**
   ```bash
   npm start
   ```

## Compiling to Standalone Executable
You can compile SonicRoute into a lightweight Windows `.exe` using the built-in fast packager:
```bash
npx @electron/packager . SonicRoute --platform=win32 --arch=x64 --out=dist --icon=build/icon.png --overwrite
```
The standalone app will be outputted to `/dist/SonicRoute-win32-x64/`.

## License
Distributed under the [MIT License](LICENSE).
