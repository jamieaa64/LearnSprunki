import { access, readFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

function requireValue(condition, message) {
  if (!condition) throw new Error(`Invalid content catalogue: ${message}`);
}

async function requireAsset(projectDirectory, assetPath) {
  requireValue(typeof assetPath === "string" && assetPath.startsWith("./content/"), `invalid asset path ${assetPath}`);
  const contentDirectory = resolve(projectDirectory, "content");
  const absolutePath = resolve(projectDirectory, assetPath);
  requireValue(
    absolutePath === contentDirectory || absolutePath.startsWith(`${contentDirectory}${sep}`),
    `asset escapes content directory: ${assetPath}`
  );
  await access(absolutePath);
  return absolutePath;
}

async function readJsonAsset(projectDirectory, assetPath) {
  return JSON.parse(await readFile(await requireAsset(projectDirectory, assetPath), "utf8"));
}

export async function validateCatalogue(projectDirectory) {
  const cataloguePath = resolve(projectDirectory, "content/catalog.json");
  const catalogue = JSON.parse(await readFile(cataloguePath, "utf8"));
  requireValue(catalogue.schemaVersion === "3.0.0", "expected schemaVersion 3.0.0");
  requireValue(Array.isArray(catalogue.tracks), "tracks must be an array");
  requireValue(Array.isArray(catalogue.games), "games must be an array");

  const instrumentCatalogue = await readJsonAsset(projectDirectory, catalogue.resources?.instruments);
  const effectCatalogue = await readJsonAsset(projectDirectory, catalogue.resources?.effects);
  const instrumentsById = new Map((instrumentCatalogue.instruments || []).map(item => [item.id, item]));
  const effectsById = new Map((effectCatalogue.effects || []).map(item => [item.id, item]));
  requireValue(instrumentsById.size > 0, "instrument catalogue is empty");
  requireValue(effectsById.size > 0, "effect catalogue is empty");

  const tracksById = new Map();
  for (const track of catalogue.tracks) {
    requireValue(track.id && !tracksById.has(track.id), `duplicate or missing track id ${track.id}`);
    tracksById.set(track.id, track);
    await requireAsset(projectDirectory, track.midi);
  }

  const gamesById = new Map();
  for (const gameReference of catalogue.games) {
    requireValue(!gamesById.has(gameReference.id), `duplicate game id ${gameReference.id}`);
    const game = await readJsonAsset(projectDirectory, gameReference.manifest);
    requireValue(game.id === gameReference.id, `game manifest id mismatch for ${gameReference.id}`);
    gamesById.set(game.id, game);

    for (const character of game.characters || []) {
      for (const phase of character.phases || []) {
        await requireAsset(projectDirectory, phase.portrait);
        requireValue(instrumentsById.has(phase.instrumentId), `unknown instrument ${phase.instrumentId}`);
        requireValue(effectsById.has(phase.effectId), `unknown effect ${phase.effectId}`);
        if (phase.locked) {
          requireValue(phase.lessonTrackId === null, `${character.id}/${phase.id} is locked but has a track`);
        } else {
          requireValue(tracksById.has(phase.lessonTrackId), `${character.id}/${phase.id} references missing track ${phase.lessonTrackId}`);
        }
      }
    }
  }

  for (const track of tracksById.values()) {
    if (track.kind !== "sprunki-lesson") continue;
    const lesson = track.lesson;
    requireValue(lesson && gamesById.has(lesson.gameId), `${track.id} references an unknown game`);
    requireValue(instrumentsById.has(lesson.instrumentId), `${track.id} references an unknown instrument`);
    requireValue(effectsById.has(lesson.effectId), `${track.id} references an unknown effect`);
    requireValue(typeof lesson.loopByDefault === "boolean", `${track.id} is missing its loop default`);
    requireValue(Number.isFinite(lesson.loopDurationMs) && lesson.loopDurationMs > 0, `${track.id} has an invalid loop duration`);
    await requireAsset(projectDirectory, lesson.referenceAudio);
    await requireAsset(projectDirectory, lesson.animation.idle);
    requireValue(Array.isArray(lesson.animation.frames) && lesson.animation.frames.length > 0, `${track.id} has no animation frames`);
    for (const frame of lesson.animation.frames) await requireAsset(projectDirectory, frame);

    const game = gamesById.get(lesson.gameId);
    const character = game.characters.find(item => item.id === lesson.characterId);
    const phase = character?.phases.find(item => item.id === lesson.phaseId);
    requireValue(phase?.lessonTrackId === track.id, `${track.id} does not match its game character/phase entry`);
  }

  return {
    catalogue: relative(projectDirectory, cataloguePath),
    tracks: tracksById.size,
    games: gamesById.size,
    instruments: instrumentsById.size,
    effects: effectsById.size,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const projectDirectory = resolve(scriptDirectory, "..");
  const result = await validateCatalogue(projectDirectory);
  console.log(
    `Validated ${result.tracks} tracks, ${result.games} game(s), ` +
    `${result.instruments} instruments and ${result.effects} effects.`
  );
}
