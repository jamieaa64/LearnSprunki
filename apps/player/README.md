# NeoKeys 🎹

> LearnSprunki tablet baseline, derived from NeoKeys commit
> `50235a332ddcffb0a3567f48a77d8c6b6d70f07e`. NeoKeys remains credited to
> ArtinSHF under CC BY-NC 4.0. This branch pins its browser dependencies locally
> and adds explicit fullscreen controls, separated source files, and an external
> song catalogue.

<img width="1861" height="927" alt="Screenshot" src="https://github.com/user-attachments/assets/86ffb06a-8490-4da8-8d05-52731d9d6398" />

---

NeoKeys is a web-based MIDI piano trainer and interactive musical workstation featuring falling notes, an inverted arcade Freeplay mode, full session recording, hardware MIDI output pass-through, and a responsive, mobile-friendly interface.

The project is inspired by desktop piano learning applications, built as a personal experiment to learn advanced frontend engineering, browser-based hardware communication, audio synthesis, dynamic canvas rendering, and complex game-state architecture.

## 🌐 Live Website

NeoKeys runs online using Vercel.

**Live site:** https://neo-keys.vercel.app

## 🎮 About the Project

NeoKeys renders a responsive 88-key piano at the bottom of the screen with a high-performance cyber-neon visualizer grid.

The application is a full duplex audio tool: it captures incoming physical or wireless MIDI keyboard inputs via the Web MIDI API and can route auto-play data back out into a physical piano's sound engine.

It supports local MIDI file loading, a built-in track library, real-time note name translation, standalone session recording, and downloadable MIDI exports.

The LearnSprunki fork loads game manifests separately from its ordinary track
library. The LearnSprunki button opens a phase-grouped character browser; a
locked tile means that character/phase does not yet have a reviewed lesson.
Its first playable vertical slice is Mr Sun Phase 1, with animation synced to
the lesson timeline, character-coloured notes, original-loop playback and a
visibly labelled draft transcription. Infinite playback is a Sprunki-only
setting and never changes the completion behaviour of ordinary MIDI tracks.

Player content is separated into `content/games`, `content/tracks`,
`content/instruments` and `content/effects`. Lessons refer to reusable
instrument and visual-effect definitions by ID; Mr Sun currently uses the
data-driven Sun Sparks note effect.

Original Sprunki currently includes 20 Basic Pitch piano/vocal drafts and 10
single-lane percussion drafts. Percussion lessons replace the piano with a
large labelled rhythm pad that works with touch or the space bar. All generated
lessons remain explicitly marked as drafts until they are reviewed against the
source loop.

For tablet performance, character SVGs are preloaded once and drawn through a
fixed canvas instead of repeatedly replacing an image URL. Coarse-pointer
devices use a 1.5× canvas pixel-ratio cap, disable large live backdrop blurs and
collapse the settings panel after lesson selection; the gear button reopens it.

---

## 🚀 Features

### Core Visualizer & Rendering Engine

* **88-Key Cyber Piano Bed:** High-fidelity virtual piano with real-time key highlighting.
* **Bi-Directional Waterfall Animations:**

  * **Standard Mode:** Notes cascade downward toward the hitline.
  * **Freeplay Mode:** Notes shoot upwards from the piano bed and stop on key release.
* **Responsive Font Scaling:** Note labels automatically resize to remain readable on mobile landscape screens.
* **Timeline Scrubbing:** A styled neon range slider lets users jump to any part of a song instantly.

### Advanced Audio & Hardware Systems

* **Multi-Instrument Sound Selector:** Swap between 4 custom Tone.js audio engines:

  * Grand Piano
  * Cyber Synth
  * 8-Bit Arcade
  * Ambient Strings
* **Hardware MIDI Output Pass-Through:** Sends MIDI Note On/Off commands back to a digital keyboard, allowing auto-playing tracks to play through the keyboard's physical speakers.
* **Hardware Synth Muter:** A toggle to silence browser audio when using a real piano's internal sound engine.

### Gamified Practice & Learning Tools

* **Built-In Tracks Menu:** Includes a built-in selection menu with pre-loaded classical pieces such as:

  * Beethoven's Moonlight Sonata
  * Für Elise
  * Clair de Lune
* **Intelligent Practice Mode:** The waterfall pauses automatically until the correct key is pressed.
* **Fast-Playing Patch:** Uses active key scanning to prevent lock-ups during rapid runs, trills, and arpeggios.
* **Smart Hand-Splitting Heuristics:** Detects left/right hand tracks from MIDI channels or calculates a median pitch split.
* **Internationalization Toggle:** Switches note names between English notation and French solfège.
* **Gamified Scoring Engine:** Tracks player accuracy with timing-based scoring and penalties for wrong notes.
* **Dynamic Performance Review:** Shows an end-of-song review with score, wrong notes, and feedback.

### Custom Session Recording & Exporting

* **Freeplay Studio Recording:** Captures live MIDI input while in Freeplay mode, including note values, velocities, timestamps, and durations.
* **Instant Sandbox Playback:** Converts recordings into playable in-app tracks for instant review.
* **MIDI File Downloader:** Generates a downloadable `.mid` file from custom recordings using MidiWriterJS.

---

## 🛠 Tools & Technologies Used

* **HTML5:** Structure and Canvas API
* **CSS3:** Custom properties and neon cyber styling
* **JavaScript:** ES6+, async Web MIDI, and state machines
* **Web MIDI API:** MIDI input/output hardware routing
* **Tone.js:** Audio synthesis, polyphonic mapping, and samplers
* **MidiWriterJS:** MIDI file compiling and encoding
* **VS Code:** Development environment
* **Vercel:** Deployment
* **AI Assistance:** Planning, debugging, and optimization

---

## ▶️ How to Run Locally

This project is a static web app and can be opened using any local server environment.

Recommended method:

1. Install the pinned dependencies: `npm install`.
2. Start the local server: `npm run dev`.
3. Open `http://127.0.0.1:4173/index.html`.

The site should open in your browser at:

```text
http://127.0.0.1:4173/index.html
```

The launch overlay and transport both provide a fullscreen control for tablet
play. Browser fullscreen must be entered from a user tap. Touch is the primary
LearnSprunki input. The inherited Web MIDI implementation remains in the
codebase for future optional keyboard support, but startup no longer requests
hardware access or waits on MIDI permission.

## Deploying from the LearnSprunki monorepo

When importing `jamieaa64/LearnSprunki` into Vercel, use:

- Root Directory: `apps/player`
- Framework Preset: Other
- Build Command: `npm run build`
- Output Directory: `dist`

The included `vercel.json` records the build and output settings. The production
build copies the three pinned browser libraries into `dist/vendor` and the song
catalogue into `dist/content`, so the deployed player does not expose or depend
on `node_modules` URLs.

Run `npm run validate:content` to check catalogue references and required assets
before building. `npm run build` performs the same validation automatically.

---

## 🎹 MIDI Keyboard Support

NeoKeys uses the browser's native Web MIDI API.

For the interactive MIDI features to work properly:

* Use a Web MIDI compatible browser such as Google Chrome, Opera, or Microsoft Edge.
* Connect your digital piano using USB-MIDI or a wireless MIDI/Bluetooth adapter before launching the page.
* Grant MIDI permissions when prompted by your browser.
* To hear playback through your piano, make sure your keyboard's MIDI receive channels are active.
* Use the **Mute Web Audio Synth** toggle when you want audio to come from your physical keyboard instead of the browser.

---

## 📁 Project Structure

```text
apps/player/
├── index.html              # Page structure
├── styles.css              # Player presentation
├── app.js                  # Piano, playback and interaction logic
├── content/
│   ├── catalog.json        # Data-driven song menu
│   └── midi/               # Playable MIDI files
└── scripts/build.mjs       # Static Vercel build
```

---

## 📌 Status

This is an actively maintained experimental portfolio project.

Updates are focused on expanding practice mechanics, improving audio latency, refining MIDI hardware support, and optimizing canvas performance across different devices.

---

## ⚠️ Note

NeoKeys is a standalone, independent web application.

It is a personal development and game-design music training experiment made for educational purposes and to showcase frontend, hardware API, and canvas-rendered audio programming skills.

NeoKeys is not affiliated with Synthesia or any other piano learning software.

---

## 🧠 What I Learned

While building NeoKeys, I gained hands-on experience with:

* **Monolithic State Management:** Managing audio, rendering loops, recording, and hardware states inside a single-file app.
* **Duplex Hardware I/O:** Using browser APIs to receive and send low-level MIDI messages.
* **Canvas Coordinate Mapping:** Building and adjusting real-time visual math for different note directions and screen sizes.
* **Asynchronous Audio Systems:** Preventing audio clipping, lag, and interaction issues during playback and user input.
* **Defensive Algorithmic Engineering:** Solving timing problems caused by fast note sequences and timeline pauses.
* **Binary File Compilation:** Turning recorded user input into valid downloadable MIDI files directly in the browser.
