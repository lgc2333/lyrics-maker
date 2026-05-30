<!-- markdownlint-disable MD028 MD033 -->

# Lyrics Maker

[简体中文](README.md) | **English**

> [!WARNING]
> This project is purely an AI Vibe Coding output. The code quality may not be ideal — it serves as a beginner's practice attempt at Vibe Coding.

> [!NOTE]
> That said, I have put time and effort into polishing many of this project's details.  
> If no one takes an interest in what I've made, I'd be quite disheartened — all the tokens burned and time wasted on this project would feel meaningless.  
> If you like this project, thank you from the bottom of my heart. Feedback and suggestions are always welcome.

Lyrics Maker is a web tool focused on lyrics timeline creation. Import audio, paste lyrics, then mark and edit line-by-line and word-by-word timings on a waveform or spectrogram timeline, and finally export to standard lyrics/subtitle formats.

**✨ Try it now: [lrc.lgck.cc](https://lrc.lgck.cc)**

## 📸 Preview

<div align="center">
  <img src="./docs/assets/preview-1.png" alt="Timing interface, waveform view" style="width: 75%;" />
  <img src="./docs/assets/preview-2.png" alt="Lyrics editing interface, spectrogram view" style="width: 75%;" />
</div>

## ✨ Features

### 🥁 Beat Grid Timing

Inspired by the osu!lazer Editor Timing system, lyrics boundaries snap to a beat grid generated from BPM, time signature, offset, and subdivision — ideal for songs with clear rhythms.

- **Timing Point Management**: Insert BPM changes or time signature changes anywhere, flexible for songs with tempo shifts
- **Tap BPM**: Tap along with the music to auto-estimate BPM
- **Flexible Snapping**: Supports 1/2, 1/4, 1/8, 1/16 subdivisions, plus triplets

### 🎛️ Waveform & Spectrogram Dual View

Freely switch between waveform and spectrogram views in the main timeline area, complemented by multiple overlays for precise editing:

- **Playhead**: Follows playback position in real time
- **Beat Grid Overlay**: Visualizes measure lines and beat lines for intuitive snapping
- **Lyrics Overlay**: Displays timed lyric lines and word blocks directly on the timeline, with drag-to-adjust boundaries
- **Cursor Time Preview**: Preview the time at the current mouse position while hovering

### ✍️ Line-by-Line & Word-by-Word Editing

Full two-level editing — from whole lines down to individual words:

- **Line Timing**: Mark start and end times for each lyric line
- **Word Timing**: Fine-grained timing for each word within a line
- **Free Word Splitting**: Auto-split English by spaces, with manual adjustment supported
- **Drag Editing**: Drag line or word boundaries directly on the timeline overlay — what you see is what you get
- **Full Undo/Redo**: Every edit operation can be undone and redone

### 📂 Multi-Format Import & Export

Rich support for lyrics and subtitle formats, bridging different toolchains:

| Category   | Formats                                     |
| ---------- | ------------------------------------------- |
| Plain Text | TXT                                         |
| Lyrics     | LRC (plain / enhanced / ESLyric), AMLL TTML |
| Subtitles  | ASS, SRT, VTT                               |
| Project    | JSON (saves complete editing state)         |

### 🎨 Customizable Editing Experience

Tailor the editor to your liking:

- **Theme**: Light / Dark / Follow System
- **Language**: English / Simplified Chinese
- **Shortcuts**: The vast majority of shortcuts are customizable, with settings backup & restore

### 💾 Local-First

Your data stays safe — all operations happen locally in your browser:

- Save / Save As (File System Access API), auto-save to local file every minute
- Open existing project files
- Real-time browser draft saving with automatic recovery
- Unsaved changes prompt

## 🚀 Quick Start

1. **Import Audio** — Click "File → Open Audio" in the menu bar, or drag an audio file directly into the window
2. **Set Up Beat Grid** — Switch to "Timing Mode", use Tap BPM to tap along with the music, or manually set BPM and time signature
3. **Import Lyrics** — Switch to "Lyrics Mode", paste or import lyrics text, use `Ctrl+D` to auto-split words
4. **Start Timing** — Play the audio, press `D` to mark word timings, press `Enter` to finish the current line
5. **Fine-Tune** — Drag lyrics boundaries on the timeline overlay for precise adjustments
6. **Export** — Click "File → Save As" and choose LRC or another format to export

> 💡 All shortcuts can be customized in Preferences. Some browser-reserved shortcuts (e.g., `Ctrl+D`) may be intercepted — bind alternative keys in settings if needed.

## 📊 Current Status

The core editing workflow is fully functional. The following features are available:

- Audio playback, seek, volume control, metronome, speed adjustment (25%/50%/75%/100%)
- Timing Point management, Tap BPM, snap grid & grid display control
- Lyrics paste, import, word split, word merge, line editing, insert, delete
- Waveform / spectrogram timeline, lyrics overlay, overlay drag editing
- Project save, auto-draft, unsaved changes confirmation, project validation
- Theme switching, language switching, shortcut customization, settings backup & restore

> 📝 If anyone uses this project and gives feedback, I will continue refining the details based on it. Detailed design notes can be found in [docs/design.md](docs/design.md).

## 💬 Feedback

If you've tried this project, feel free to share issues, suggestions, and feedback:

- **GitHub Issues**: [Submit an Issue](https://github.com/lgc2333/lyrics-maker/issues)
- **QQ**: 3076823485 / Group: [168603371](https://qm.qq.com/q/EikuZ5sP4G)
- **Telegram**: [@lgc2333](https://t.me/lgc2333)
- **Email**: [lgc2333@126.com](mailto:lgc2333@126.com)
