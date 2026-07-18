import { access, readFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateExtensionManifest } from "../core/extension-host.js";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

function requireValue(condition, message) {
  if (!condition) throw new Error(`Invalid player content: ${message}`);
}

async function requireAsset(projectDirectory, assetPath, allowedRoot = projectDirectory) {
  requireValue(typeof assetPath === "string" && assetPath.startsWith("./"), `invalid asset path ${assetPath}`);
  const absolutePath = resolve(projectDirectory, assetPath);
  requireValue(
    absolutePath === allowedRoot || absolutePath.startsWith(`${allowedRoot}${sep}`),
    `asset escapes its package: ${assetPath}`
  );
  await access(absolutePath);
  return absolutePath;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function validateCoreCatalogue(projectDirectory) {
  const path = resolve(projectDirectory, "content/catalog.json");
  const catalogue = await readJson(path);
  requireValue(catalogue.schemaVersion === "1.0.0", "core catalogue schemaVersion must be 1.0.0");
  requireValue(Array.isArray(catalogue.tracks), "core tracks must be an array");
  const ids = new Set();
  for (const track of catalogue.tracks) {
    requireValue(track.id && !ids.has(track.id), `duplicate or missing core track id ${track.id}`);
    requireValue(track.kind === "demo", `core track ${track.id} must be a demo`);
    ids.add(track.id);
    await requireAsset(projectDirectory, track.midi, resolve(projectDirectory, "content"));
  }
  return { catalogue: relative(projectDirectory, path), tracks: ids.size };
}

async function validateLearnSprunki(projectDirectory, manifest) {
  const extensionRoot = resolve(projectDirectory, "extensions/learn-sprunki");
  const catalogue = await readJson(await requireAsset(projectDirectory, manifest.catalog, extensionRoot));
  requireValue(catalogue.schemaVersion === "3.0.0", "Learn Sprunki catalogue schemaVersion must be 3.0.0");
  requireValue(Array.isArray(catalogue.tracks), "Learn Sprunki tracks must be an array");
  requireValue(Array.isArray(catalogue.games), "Learn Sprunki games must be an array");

  const instrumentCatalogue = await readJson(await requireAsset(projectDirectory, catalogue.resources?.instruments, extensionRoot));
  const effectCatalogue = await readJson(await requireAsset(projectDirectory, catalogue.resources?.effects, extensionRoot));
  const instruments = new Map((instrumentCatalogue.instruments || []).map(item => [item.id, item]));
  const effects = new Map((effectCatalogue.effects || []).map(item => [item.id, item]));
  requireValue(instruments.size > 0, "Learn Sprunki instrument catalogue is empty");
  requireValue(effects.size > 0, "Learn Sprunki effect catalogue is empty");

  const tracks = new Map();
  for (const track of catalogue.tracks) {
    requireValue(track.id && !tracks.has(track.id), `duplicate or missing extension track id ${track.id}`);
    requireValue(track.kind === "sprunki-lesson", `${track.id} has unsupported kind ${track.kind}`);
    tracks.set(track.id, track);
    await requireAsset(projectDirectory, track.midi, extensionRoot);
  }

  const games = new Map();
  for (const reference of catalogue.games) {
    const game = await readJson(await requireAsset(projectDirectory, reference.manifest, extensionRoot));
    requireValue(game.id === reference.id, `game manifest id mismatch for ${reference.id}`);
    games.set(game.id, game);
    for (const character of game.characters || []) {
      for (const phase of character.phases || []) {
        await requireAsset(projectDirectory, phase.portrait, extensionRoot);
        requireValue(instruments.has(phase.instrumentId), `unknown instrument ${phase.instrumentId}`);
        requireValue(effects.has(phase.effectId), `unknown effect ${phase.effectId}`);
        requireValue(typeof phase.category === "string" && phase.category.length > 0, `${character.id}/${phase.id} has no category`);
        if (phase.locked) requireValue(phase.lessonTrackId === null, `${character.id}/${phase.id} is locked but has a track`);
        else requireValue(tracks.has(phase.lessonTrackId), `${character.id}/${phase.id} references a missing track`);
      }
    }
  }

  for (const track of tracks.values()) {
    const lesson = track.lesson;
    requireValue(lesson && games.has(lesson.gameId), `${track.id} references an unknown game`);
    requireValue(instruments.has(lesson.instrumentId), `${track.id} references an unknown instrument`);
    requireValue(effects.has(lesson.effectId), `${track.id} references an unknown effect`);
    requireValue(["piano", "rhythm"].includes(lesson.playerMode), `${track.id} has an invalid player mode`);
    if (lesson.playerMode === "rhythm") {
      requireValue(typeof lesson.rhythmLabel === "string" && lesson.rhythmLabel.length > 0, `${track.id} has no rhythm label`);
      requireValue(Number.isInteger(lesson.rhythmMidiNote), `${track.id} has no rhythm MIDI note`);
    }
    requireValue(typeof lesson.loopByDefault === "boolean", `${track.id} is missing its loop default`);
    requireValue(Number.isFinite(lesson.loopDurationMs) && lesson.loopDurationMs > 0, `${track.id} has an invalid loop duration`);
    await requireAsset(projectDirectory, lesson.referenceAudio, extensionRoot);
    await requireAsset(projectDirectory, lesson.animation.idle, extensionRoot);
    for (const frame of lesson.animation.frames || []) await requireAsset(projectDirectory, frame, extensionRoot);
    const game = games.get(lesson.gameId);
    const character = game.characters.find(item => item.id === lesson.characterId);
    const phase = character?.phases.find(item => item.id === lesson.phaseId);
    requireValue(phase?.lessonTrackId === track.id, `${track.id} does not match its character/phase`);
  }
  return { tracks: tracks.size, games: games.size, instruments: instruments.size, effects: effects.size };
}

export async function validateCatalogue(projectDirectory) {
  const core = await validateCoreCatalogue(projectDirectory);
  const registry = await readJson(resolve(projectDirectory, "extensions/registry.json"));
  requireValue(registry.schemaVersion === "1.0.0", "extension registry schemaVersion must be 1.0.0");
  requireValue(Array.isArray(registry.extensions), "extension registry must contain extensions");
  const extensions = [];
  for (const reference of registry.extensions) {
    const manifestPath = await requireAsset(projectDirectory, reference.manifest, resolve(projectDirectory, "extensions"));
    const manifest = validateExtensionManifest(await readJson(manifestPath));
    await requireAsset(projectDirectory, manifest.entry, resolve(projectDirectory, "extensions"));
    if (manifest.stylesheet) await requireAsset(projectDirectory, manifest.stylesheet, resolve(projectDirectory, "extensions"));
    const detail = manifest.id === "learn-sprunki" ? await validateLearnSprunki(projectDirectory, manifest) : {};
    extensions.push({ id: manifest.id, ...detail });
  }
  return { ...core, extensions };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const projectDirectory = resolve(scriptDirectory, "..");
  const result = await validateCatalogue(projectDirectory);
  const extensionSummary = result.extensions.map(item => `${item.id}: ${item.tracks || 0} tracks`).join(", ");
  console.log(`Validated ${result.tracks} core tracks and ${result.extensions.length} extension(s) (${extensionSummary}).`);
}
