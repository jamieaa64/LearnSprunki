let api;
let manifest;
let tracksById;
let gamesById;
let instrumentsById;
let effectsById;
let lessonsByTrackId;
let selectedGameId;
let activeController = null;
let loopEnabled = true;
let characterLoadToken = 0;
let characterIdleImage = null;
let characterFrameImages = [];
let characterFrameIndex = -1;
let particles = [];
let spaceHeld = false;
let elements = {};

function controlsMarkup() {
  const base = './extensions/learn-sprunki/content/games/original-sprunki/characters';
  return `
    <h3>Learn Sprunki</h3>
    <button class="sprunki-browser-card" id="sprunkiBrowserBtn" type="button" aria-haspopup="dialog">
      <span class="sprunki-card-collage" aria-hidden="true">
        <img class="sprunki-card-character pinki" src="${base}/pink-pinki/phase1.svg" alt="" />
        <img class="sprunki-card-character simon" src="${base}/yellow-simon/phase1.svg" alt="" />
        <img class="sprunki-card-character gray" src="${base}/gray-gray/phase1.svg" alt="" />
      </span>
      <span class="sprunki-card-copy">
        <strong>Sprunki</strong>
        <span><span id="activeGameLabel">Original</span> · Choose a character</span>
      </span>
      <span class="sprunki-card-arrow" aria-hidden="true">›</span>
    </button>`;
}

function overlaysMarkup() {
  return `
    <section class="character-stage hidden" id="characterStage" aria-live="polite">
      <div class="character-glow"></div>
      <div class="character-status" id="characterStatus">Draft lesson</div>
      <canvas class="character-image" id="characterCanvas" role="img" aria-label=""></canvas>
      <div class="character-details"><strong id="characterName"></strong><span id="characterPhase"></span></div>
      <button class="reference-audio-btn" id="referenceAudioBtn" type="button">▶ Hear original loop</button>
      <audio id="referenceAudio" preload="metadata" loop></audio>
    </section>
    <div class="game-browser-overlay hidden" id="gameBrowserOverlay">
      <section class="game-browser-modal" role="dialog" aria-modal="true" aria-labelledby="gameBrowserTitle">
        <header class="game-browser-header">
          <div><span class="eyebrow">LearnSprunki</span><h2 id="gameBrowserTitle">Choose a game and Sprunki</h2></div>
          <button class="game-browser-close" id="gameBrowserClose" type="button" aria-label="Close character browser">×</button>
        </header>
        <nav class="game-picker" id="gamePicker" aria-label="Sprunki games"></nav>
        <div class="game-browser-content">
          <section class="phase-browser-section"><div class="phase-browser-heading"><h3>Phase 1</h3><span>Original</span></div><div class="character-grid" id="phase1Grid"></div></section>
          <section class="phase-browser-section phase-two"><div class="phase-browser-heading"><h3>Phase 2</h3><span>Darker versions</span></div><div class="character-grid" id="phase2Grid"></div></section>
        </div>
        <footer class="game-browser-footer">
          <div><strong>Sprunki infinite loop</strong><span>Repeat Sprunki lessons like the original game. This never affects ordinary tracks.</span></div>
          <label class="switch" aria-label="Loop Sprunki lessons"><input type="checkbox" id="sprunkiLoopToggle" checked /><span class="slider-track"></span></label>
        </footer>
      </section>
    </div>`;
}

function collectElements() {
  for (const id of [
    'sprunkiBrowserBtn', 'activeGameLabel', 'characterStage', 'characterStatus',
    'characterCanvas', 'characterName', 'characterPhase', 'referenceAudio',
    'referenceAudioBtn', 'gameBrowserOverlay', 'gameBrowserClose', 'gamePicker',
    'phase1Grid', 'phase2Grid', 'sprunkiLoopToggle',
  ]) elements[id] = document.getElementById(id);
  elements.characterContext = elements.characterCanvas.getContext('2d', { alpha: true });
}

function indexLessons() {
  lessonsByTrackId = new Map();
  for (const track of tracksById.values()) {
    const lesson = track.lesson;
    if (!lesson) continue;
    const game = gamesById.get(lesson.gameId);
    const character = game?.characters.find(item => item.id === lesson.characterId);
    const phase = character?.phases.find(item => item.id === lesson.phaseId);
    if (!game || !character || !phase) continue;
    lessonsByTrackId.set(track.id, {
      game, character, phase, track, lesson,
      instrument: instrumentsById.get(lesson.instrumentId) || null,
      effect: effectsById.get(lesson.effectId) || null,
    });
  }
}

function characterChoice(character, phaseId) {
  const phase = character.phases.find(item => item.id === phaseId);
  if (!phase) return null;
  const track = phase.lessonTrackId ? tracksById.get(phase.lessonTrackId) : null;
  const instrument = instrumentsById.get(phase.instrumentId);
  const locked = phase.locked || !track;
  const item = document.createElement('button');
  item.className = 'character-choice';
  item.type = 'button';
  item.disabled = locked;
  item.style.setProperty('--character-color', character.color);
  if (track) item.dataset.trackId = track.id;
  item.setAttribute('aria-label', `${character.name}, ${phase.title}${locked ? ', locked' : ', lesson available'}`);
  const portrait = document.createElement('img');
  portrait.src = phase.portrait;
  portrait.alt = '';
  portrait.loading = 'lazy';
  const name = document.createElement('strong');
  name.textContent = character.name;
  const detail = document.createElement('small');
  detail.textContent = phase.playerMode === 'rhythm' ? `Rhythm · ${phase.rhythmLabel}` : (instrument?.label || 'Lesson');
  item.append(portrait, name, detail);
  if (locked) {
    const lock = document.createElement('span');
    lock.className = 'character-lock';
    lock.setAttribute('aria-hidden', 'true');
    lock.textContent = 'Locked';
    item.append(lock);
  }
  return item;
}

function renderBrowser() {
  const game = gamesById.get(selectedGameId);
  if (!game) return;
  elements.activeGameLabel.textContent = game.title.replace(/ Sprunki$/i, '');
  elements.gamePicker.replaceChildren();
  for (const candidate of gamesById.values()) {
    const button = document.createElement('button');
    button.className = 'game-picker-btn';
    button.type = 'button';
    button.dataset.gameId = candidate.id;
    button.textContent = candidate.title;
    button.classList.toggle('active', candidate.id === selectedGameId);
    elements.gamePicker.append(button);
  }
  for (const [phaseId, grid] of [['phase1', elements.phase1Grid], ['phase2', elements.phase2Grid]]) {
    grid.replaceChildren();
    for (const character of game.characters || []) {
      const choice = characterChoice(character, phaseId);
      if (choice) grid.append(choice);
    }
  }
  updateActiveChoice(api.getCurrentTrackId());
}

function openBrowser() {
  renderBrowser();
  elements.gameBrowserOverlay.classList.remove('hidden');
  elements.gameBrowserClose.focus();
}

function closeBrowser() {
  elements.gameBrowserOverlay.classList.add('hidden');
  elements.sprunkiBrowserBtn.focus();
}

function updateActiveChoice(trackId) {
  for (const grid of [elements.phase1Grid, elements.phase2Grid]) {
    grid.querySelectorAll('.character-choice').forEach(item => {
      item.classList.toggle('active', item.dataset.trackId === trackId);
    });
  }
}

function preloadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Character frame failed to load: ${url}`));
    image.src = url;
  });
}

async function prepareFrames(animation, token) {
  try {
    const images = await Promise.all([preloadImage(animation.idle), ...(animation.frames || []).map(preloadImage)]);
    if (token !== characterLoadToken) return;
    characterIdleImage = images[0];
    characterFrameImages = images.slice(1);
    characterFrameIndex = -2;
    drawCharacterFrame();
  } catch (error) {
    console.warn('Character animation could not be prepared:', error);
  }
}

function drawCharacterFrame() {
  const image = characterFrameIndex < 0 ? characterIdleImage : characterFrameImages[characterFrameIndex];
  if (!image) return;
  const canvas = elements.characterCanvas;
  const context = elements.characterContext;
  const cssWidth = Math.max(1, canvas.clientWidth);
  const cssHeight = Math.max(1, canvas.clientHeight);
  const dpr = api.preferredCanvasDpr();
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);
  const scale = Math.min(cssWidth / image.naturalWidth, cssHeight / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (cssWidth - width) / 2, cssHeight - height, width, height);
}

function hidePresentation() {
  characterLoadToken++;
  elements.referenceAudio.pause();
  elements.referenceAudio.currentTime = 0;
  elements.referenceAudio.removeAttribute('src');
  elements.characterStage.classList.add('hidden');
  characterIdleImage = null;
  characterFrameImages = [];
  particles = [];
}

function spawnParticles(note, effect, context) {
  if (!effect || effect.type !== 'note-sparks') return;
  const key = context.getKey(note.midi);
  if (!key) return;
  const count = Math.max(1, Math.min(10, effect.particlesPerNote || 4));
  const colors = effect.colors?.length ? effect.colors : [context.theme.rh];
  for (let index = 0; index < count; index++) {
    const angle = Math.PI * (1.08 + Math.random() * 0.84);
    const speed = (effect.speed || 0.14) * (0.65 + Math.random() * 0.7);
    particles.push({
      x: key.x + key.w * (0.25 + Math.random() * 0.5), y: context.pianoY - 2,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 0, maxLife: effect.lifetimeMs || 480,
      color: colors[index % colors.length], size: (effect.size || 3) * (0.7 + Math.random() * 0.6),
    });
  }
  if (particles.length > 220) particles.splice(0, particles.length - 220);
}

function drawRhythmPad(lesson, litInfo, context) {
  const { ctx, width, pianoY, pianoH, theme, roundRect, hexToRgba } = context;
  ctx.fillStyle = '#090a12';
  ctx.fillRect(0, pianoY, width, pianoH);
  const x = width * 0.2;
  const padWidth = width * 0.6;
  const y = pianoY + 12;
  const height = Math.max(58, pianoH - 24);
  const color = litInfo?.color || theme.rh;
  const gradient = ctx.createLinearGradient(0, y, 0, y + height);
  gradient.addColorStop(0, hexToRgba(color, litInfo ? 0.95 : 0.42));
  gradient.addColorStop(1, hexToRgba(color, litInfo ? 0.48 : 0.12));
  ctx.fillStyle = gradient;
  ctx.shadowColor = litInfo ? color : 'transparent';
  ctx.shadowBlur = litInfo ? 22 : 0;
  roundRect(ctx, x, y, padWidth, height, 18); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = hexToRgba(color, 0.8); ctx.lineWidth = 2;
  roundRect(ctx, x, y, padWidth, height, 18); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '800 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(lesson.rhythmLabel.toUpperCase(), width / 2, y + height / 2 - 8);
  ctx.fillStyle = 'rgba(255,255,255,0.68)';
  ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('TAP THE PAD · OR PRESS SPACE', width / 2, y + height / 2 + 17);
}

function createController(metadata) {
  const { character, phase, track, lesson, instrument, effect } = metadata;
  characterLoadToken++;
  characterFrameIndex = -1;
  particles = [];
  api.setTheme(lesson.theme);
  if (instrument) api.setInstrument(instrument.playerVoice, instrument.label);
  elements.characterStage.classList.remove('hidden');
  elements.characterCanvas.setAttribute('aria-label', `${character.name}, ${phase.title}`);
  elements.characterName.textContent = character.name;
  elements.characterPhase.textContent = phase.title;
  elements.characterStatus.textContent = track.reviewStatus === 'draft'
    ? (lesson.playerMode === 'rhythm' ? 'Draft rhythm lesson' : 'Draft transcription')
    : 'Lesson ready';
  elements.referenceAudio.src = lesson.referenceAudio;
  elements.referenceAudio.loop = loopEnabled;
  prepareFrames(lesson.animation, characterLoadToken);

  const controller = {
    songDurationMs: lesson.loopDurationMs,
    collapsePanelOnTablet: true,
    loadLabel: track.reviewStatus === 'draft'
      ? (lesson.playerMode === 'rhythm' ? ' · draft rhythm lesson' : ' · draft transcription') : '',
    hidesKeyboardGuides: lesson.playerMode === 'rhythm',
    getKey(midi, context) {
      if (lesson.playerMode === 'rhythm' && midi === lesson.rhythmMidiNote) {
        return { midi, isBlack: false, x: context.width * 0.2, w: context.width * 0.6 };
      }
      return null;
    },
    hitTest(_x, _y, _context) {
      return lesson.playerMode === 'rhythm' ? lesson.rhythmMidiNote : undefined;
    },
    drawInputSurface(lit, context) {
      if (lesson.playerMode !== 'rhythm') return false;
      drawRhythmPad(lesson, lit.get(lesson.rhythmMidiNote), context);
      return true;
    },
    noteTriggered(note, context) { spawnParticles(note, effect, context); },
    frame(dt) {
      const playback = api.getPlaybackState();
      const nextFrame = playback.playing && characterFrameImages.length
        ? Math.floor(playback.songTime / lesson.animation.frameDurationMs) % characterFrameImages.length : -1;
      if (nextFrame !== characterFrameIndex) { characterFrameIndex = nextFrame; drawCharacterFrame(); }
      for (const particle of particles) {
        particle.life += dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 0.00018 * dt;
      }
      particles = particles.filter(particle => particle.life < particle.maxLife);
    },
    drawOverlay({ ctx }) {
      for (const particle of particles) {
        const opacity = Math.max(0, 1 - particle.life / particle.maxLife);
        ctx.save(); ctx.globalAlpha = opacity; ctx.fillStyle = particle.color;
        ctx.shadowColor = particle.color; ctx.shadowBlur = 8; ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * (0.55 + opacity * 0.45), 0, Math.PI * 2);
        ctx.fill(); ctx.restore();
      }
    },
    shouldLoop: () => loopEnabled,
    resize() { characterFrameIndex = -2; },
    deactivate() { hidePresentation(); if (activeController === controller) activeController = null; },
  };
  activeController = controller;
  return controller;
}

function wireUi() {
  elements.sprunkiBrowserBtn.addEventListener('click', openBrowser);
  elements.gameBrowserClose.addEventListener('click', closeBrowser);
  elements.gameBrowserOverlay.addEventListener('click', event => { if (event.target === elements.gameBrowserOverlay) closeBrowser(); });
  elements.gamePicker.addEventListener('click', event => {
    const button = event.target.closest('[data-game-id]');
    if (!button) return;
    selectedGameId = button.dataset.gameId;
    renderBrowser();
  });
  for (const grid of [elements.phase1Grid, elements.phase2Grid]) {
    grid.addEventListener('click', async event => {
      const item = event.target.closest('.character-choice[data-track-id]');
      if (!item || item.disabled) return;
      closeBrowser();
      await api.loadTrack(item.dataset.trackId);
    });
  }
  elements.sprunkiLoopToggle.addEventListener('change', () => {
    loopEnabled = elements.sprunkiLoopToggle.checked;
    elements.referenceAudio.loop = loopEnabled;
    api.showToast(loopEnabled ? 'Sprunki lessons will loop' : 'Sprunki looping is off', 'ok');
  });
  elements.referenceAudioBtn.addEventListener('click', async () => {
    if (elements.referenceAudio.paused) {
      api.setPlaying(false);
      try { await elements.referenceAudio.play(); }
      catch { api.showToast('The original loop could not be played', 'err'); }
    } else {
      elements.referenceAudio.pause(); elements.referenceAudio.currentTime = 0;
    }
  });
  elements.referenceAudio.addEventListener('play', () => {
    elements.referenceAudioBtn.classList.add('playing'); elements.referenceAudioBtn.textContent = '■ Stop original loop';
  });
  elements.referenceAudio.addEventListener('pause', () => {
    elements.referenceAudioBtn.classList.remove('playing'); elements.referenceAudioBtn.textContent = '▶ Hear original loop';
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !elements.gameBrowserOverlay.classList.contains('hidden')) closeBrowser();
    const lesson = activeController && lessonsByTrackId.get(api.getCurrentTrackId())?.lesson;
    const tagName = event.target?.tagName?.toLowerCase();
    if (event.code !== 'Space' || lesson?.playerMode !== 'rhythm' || event.repeat || ['input', 'select', 'button'].includes(tagName)) return;
    event.preventDefault(); spaceHeld = true; api.noteOn(lesson.rhythmMidiNote);
  });
  document.addEventListener('keyup', event => {
    const lesson = activeController && lessonsByTrackId.get(api.getCurrentTrackId())?.lesson;
    if (event.code !== 'Space' || !spaceHeld || lesson?.playerMode !== 'rhythm') return;
    event.preventDefault(); spaceHeld = false; api.noteOff(lesson.rhythmMidiNote);
  });
}

export async function activate(coreApi, extensionManifest) {
  api = coreApi;
  manifest = extensionManifest;
  const catalog = await api.fetchJson(manifest.catalog);
  tracksById = new Map(catalog.tracks.map(track => [track.id, track]));
  api.registerTracks(catalog.tracks);
  const [instrumentCatalog, effectCatalog, ...games] = await Promise.all([
    api.fetchJson(catalog.resources.instruments),
    api.fetchJson(catalog.resources.effects),
    ...(catalog.games || []).map(game => api.fetchJson(game.manifest)),
  ]);
  instrumentsById = new Map(instrumentCatalog.instruments.map(item => [item.id, item]));
  effectsById = new Map(effectCatalog.effects.map(item => [item.id, item]));
  gamesById = new Map(games.map(game => [game.id, game]));
  selectedGameId = catalog.games?.[0]?.id || games[0]?.id;
  indexLessons();
  api.slots.controls.innerHTML = controlsMarkup();
  api.slots.overlays.innerHTML = overlaysMarkup();
  collectElements();
  wireUi();
  renderBrowser();
  api.setBrand({
    label: 'NeoKeys - Learn Sprunki',
    startTitle: '☀️ LearnSprunki Piano',
    startDescription: 'Learn real Sprunki parts with animated characters and falling piano notes. Tap below to start.',
  });
  return {
    canHandleTrack: track => track?.kind === 'sprunki-lesson' && lessonsByTrackId.has(track.id),
    activateTrack: track => createController(lessonsByTrackId.get(track.id)),
    onTrackChanged: updateActiveChoice,
  };
}
