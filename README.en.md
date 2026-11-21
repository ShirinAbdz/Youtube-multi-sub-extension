<p align="center">
  <a href="README.en.md"><img alt="English" src="https://img.shields.io/badge/English-E50914?style=for-the-badge"></a>
  <a href="README.md"><img alt="Persian" src="https://img.shields.io/badge/Persian-grey?style=for-the-badge"></a>
</p>
<h1 align="center">🌐 Multi Subtitles for YouTube</h1>

<p align="center">
  <b>Multiple subtitles. One video. At the same time.</b><br>
  Original language + Persian translation + any other language you want, stacked on screen.
</p>

<p align="center">
  <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-4285F4?logo=googlechrome&logoColor=white">
  <img alt="Chrome 111+" src="https://img.shields.io/badge/Chrome-111%2B-34A853">
  <img alt="Dependencies" src="https://img.shields.io/badge/Dependencies-0-brightgreen">
  <img alt="Vanilla JS" src="https://img.shields.io/badge/Vanilla-JavaScript-F7DF1E?logo=javascript&logoColor=black">
</p>

---

## ✨ What does it do?

When you watch a foreign-language video, YouTube makes you pick one subtitle track: the original _or_ a translation.
This extension lets you show **up to 4 subtitles at once**, for example English and Persian together, so you can learn a language without missing a word.

### Features

- 🗂 **Up to 4 subtitles at the same time**, each in its own color
- 🌍 **Auto-translation into dozens of languages** (Persian, Arabic, Turkish, German, Spanish, and more) using YouTube's built-in translation
- 🏷 Clear labels telling **original** tracks apart from **auto-translated** ones
- 🔍 **Quick language search**
- ↕️ **Reorder** subtitles with up/down buttons
- 🎛 Adjustable **text size** and **distance from the bottom** of the video
- 🙈 Option to **hide YouTube's own captions** so they don't overlap
- 💾 **Settings are remembered**, so your choices carry over to the next video
- 🖥 Works in **fullscreen**
- 🔒 **No server, no data collection** (details below)

---

## 📦 Installation

The extension isn't on the Chrome Web Store, so you install it manually. It takes under a minute:

1. Download this project (or extract the zip).
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the `yt-multi-subs` folder.
5. Open any YouTube video. If it was already open, hard-refresh with `Ctrl + Shift + R`.

> 💡 Other Chromium-based browsers such as Edge, Brave and Opera should work too.

---

## 🚀 Usage

1. On a video, find the **🌐** button next to the player controls at the bottom.
2. Click it to open the settings panel.
3. Under **Add language**, pick the languages you want (up to 4).
4. Wait a few seconds until a ✓ appears next to each one. The subtitles then show up on the video.

### Status icons next to each language

| Icon | Meaning                                   |
| :--: | ----------------------------------------- |
|  ⏳  | Loading the subtitles                     |
|  ✓   | Ready and displayed                       |
|  ⚠️  | Couldn't be fetched (see Troubleshooting) |

### Panel controls

| Control                   | What it does                                       |
| ------------------------- | -------------------------------------------------- |
| **Enabled**               | Turns the whole extension on or off                |
| **↑ / ↓**                 | Reorders subtitles (the first one is shown on top) |
| **✕**                     | Removes a language from the list                   |
| **Text size**             | Makes the subtitles bigger or smaller              |
| **Distance from bottom**  | Moves the subtitles up or down on the video        |
| **Hide YouTube captions** | Prevents YouTube's own captions from showing again |

---

## ⚙️ How it works

```
 YouTube video
      │
      ▼
 1. The list of available caption tracks is read from the player data
      │
      ▼
 2. For each selected language, the caption file (json3) is requested from YouTube
    • Language exists in the video  → fetched directly
    • Language doesn't exist        → YouTube's auto-translation via the tlang parameter
      │
      ▼
 3. On every frame, the cue matching the current playback time is found (binary search)
      │
      ▼
 4. Subtitles are drawn on top of the player
```

Technical note: YouTube requires a token (`pot`) to fetch captions. The extension picks up that token from the player's own request and reuses it. That's why you sometimes need to turn on YouTube's own **CC** button once (see below).

---

## 🛠 Troubleshooting

<details>
<summary><b>The 🌐 button doesn't appear</b></summary>

- Hard-refresh the page with `Ctrl + Shift + R`.
- On `chrome://extensions`, make sure the extension is enabled and click the reload icon (⟳).
- Your Chrome version must be **111 or newer** (check `chrome://version`).
- Press F12 and look in the Console for messages starting with `[Multi Subs]`.

</details>

<details>
<summary><b>A language shows ⚠️ and no subtitles appear</b></summary>

YouTube sometimes refuses to serve captions without a valid token.
Turn on YouTube's own **CC** button once. The extension picks up the token and retries automatically. You can turn CC off afterwards.

</details>

<details>
<summary><b>I see "This video has no subtitles"</b></summary>

The video has neither manual nor auto-generated captions, so there's nothing to translate. This case isn't supported.

</details>

<details>
<summary><b>YouTube's captions and the extension's captions overlap</b></summary>

Turn on **Hide YouTube captions** in the panel.

</details>

<details>
<summary><b>Subtitles don't show after moving to another video</b></summary>

The extension checks for video changes every second, so it usually loads within a second or two. If it doesn't, open the panel and read the message at the bottom.

</details>

---

## 🔐 Privacy

- The extension **does not collect or send any data**.
- The only network requests it makes are caption requests to **YouTube itself**.
- Settings are stored only in your browser's `localStorage`.
- No servers, analytics or external libraries are involved.

---

## 🗂 Project structure

```
yt-multi-subs/
├── manifest.json   ← extension config (Manifest V3)
├── content.js      ← all the logic: fetching, rendering, UI
├── README.md       ← Persian README
└── README.en.md    ← this file
```

The code is **plain JavaScript** with no dependencies and no build step.

### Notes for developers

- The script runs with `"world": "MAIN"` so it can access `movie_player` and YouTube's own network requests.
- YouTube enforces **Trusted Types**, so `innerHTML` doesn't work. The whole UI is built with `document.createElement`.
- Each language's subtitles are fetched once per video and kept in memory.

---

## ⚠️ Limitations

- YouTube occasionally changes its page structure or how captions are served, so the extension may need updates.
- Auto-translation quality depends on YouTube and may not be accurate.
- Videos with no captions at all aren't supported.
- Currently works only on `www.youtube.com` (not mobile web, not Shorts).

---

## 🗺 Roadmap

- [ ] Per-subtitle color and font settings
- [ ] Export subtitles as `.srt`
- [ ] Keyboard shortcut to toggle
- [ ] Firefox support

