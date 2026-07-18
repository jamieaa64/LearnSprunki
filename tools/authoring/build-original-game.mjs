import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const sourceRoot = resolve(repositoryRoot, "SprunkiAssets/sprunkis");
const playerRoot = resolve(repositoryRoot, "apps/player");
const extensionRoot = resolve(playerRoot, "extensions/learn-sprunki");
const outputRoot = resolve(extensionRoot, "content/games/original-sprunki");
const plan = JSON.parse(await readFile(resolve(scriptDirectory, "original-sprunki-plan.json"), "utf8"));

const characters = [
  ["orange-oren", "Oren", "#ff7a00", "percussion", "impact-sparks", "🥁"],
  ["red-raddy", "Raddy", "#ed3434", "percussion", "impact-sparks", "🥁"],
  ["silver-clukr", "Clukr", "#b7c1cc", "percussion", "bright-sparks", "🔔"],
  ["fun-bot", "Fun Bot", "#8d99a8", "percussion", "bright-sparks", "🤖"],
  ["green-vineria", "Vineria", "#35b86b", "percussion", "bright-sparks", "🌿"],
  ["gray-gray", "Gray", "#777b82", "synth-bass", "shadow-sparks", "🎸"],
  ["brown-brud", "Brud", "#9b633f", "sound-effect", "impact-sparks", "🪣"],
  ["gold-garnold", "Garnold", "#e7b928", "synth-lead", "sun-sparks", "✨"],
  ["lime-owakcx", "OWAKCX", "#a7e62e", "sound-effect", "bright-sparks", "⚙️"],
  ["sky-blue-sky", "Sky", "#7edcf5", "music-box", "bright-sparks", "🧸"],
  ["mr-sun", "Mr Sun", "#ffe900", "grand-piano", "sun-sparks", "☀️"],
  ["purple-durple", "Durple", "#8b5ad8", "brass", "shadow-sparks", "🎺"],
  ["mr-tree", "Mr Tree", "#4d9b51", "organ", "bright-sparks", "🌳"],
  ["yellow-simon", "Simon", "#f2dc37", "synth-lead", "sun-sparks", "⚡"],
  ["tan-tunner", "Tunner", "#c89f72", "whistle", "bright-sparks", "🤠"],
  ["mr-fun-computer", "Mr Fun Computer", "#8fd9ff", "sound-effect", "bright-sparks", "🖥️"],
  ["white-wenda", "Wenda", "#f2f2f2", "choir", "bright-sparks", "🐱"],
  ["pink-pinki", "Pinki", "#f38cc8", "choir", "bright-sparks", "🎀"],
  ["blue-jevin", "Jevin", "#335fc5", "choir", "shadow-sparks", "🧙"],
  ["black-mystery", "Black", "#27232d", "sound-effect", "shadow-sparks", "🖤"]
];

const categoryLabels = {
  "pitched-monophonic": "Melody",
  "pitched-polyphonic": "Chords and melody",
  "pitched-vocal": "Vocal draft",
};

function naturalCompare(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function mixHex(left, right, amount) {
  const parse = value => [1, 3, 5].map(index => Number.parseInt(value.slice(index, index + 2), 16));
  const [lr, lg, lb] = parse(left);
  const [rr, rg, rb] = parse(right);
  const channel = (a, b) => Math.round(a + (b - a) * amount).toString(16).padStart(2, "0");
  return `#${channel(lr, rr)}${channel(lg, rg)}${channel(lb, rb)}`;
}

function wavDurationMs(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Unsupported WAV container");
  }
  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;
  while (offset + 8 <= buffer.length) {
    const chunk = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (chunk === "fmt ") byteRate = buffer.readUInt32LE(offset + 8 + 8);
    if (chunk === "data") dataSize += size;
    offset += 8 + size + (size % 2);
  }
  if (!byteRate || !dataSize) throw new Error("WAV is missing fmt or data chunks");
  return Number(((dataSize / byteRate) * 1000).toFixed(3));
}

async function copyUnlessSame(source, destination) {
  if (resolve(source) === resolve(destination)) return;
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

function publicAsset(...parts) {
  return `./extensions/learn-sprunki/content/${parts.join("/")}`;
}

const manifestCharacters = [];
const lessonTracks = [];

for (const [id, name, color, instrumentId, effectId, emoji] of characters) {
  const characterDirectory = resolve(outputRoot, "characters", id);
  await mkdir(characterDirectory, { recursive: true });

  const phases = [];
  for (const phaseNumber of [1, 2]) {
    const phaseId = `phase${phaseNumber}`;
    const phaseKey = `${id}/${phaseId}`;
    const phasePlan = plan.phases[phaseKey];
    if (!phasePlan) throw new Error(`Missing authoring plan for ${phaseKey}`);

    const portraitFilename = `${phaseId}.svg`;
    await copyFile(
      resolve(sourceRoot, id, "sprites", phaseId, "idle.svg"),
      resolve(characterDirectory, portraitFilename)
    );

    const trackId = `${id}-${phaseId}-draft`;
    const isPlayable = Boolean(phasePlan.publishDraft || phasePlan.publishRhythm);
    phases.push({
      id: phaseId,
      title: `Phase ${phaseNumber}`,
      portrait: publicAsset("games", "original-sprunki", "characters", id, portraitFilename),
      locked: !isPlayable,
      lessonTrackId: isPlayable ? trackId : null,
      instrumentId,
      effectId,
      category: phasePlan.category,
      playerMode: phasePlan.publishRhythm ? "rhythm" : (phasePlan.publishDraft ? "piano" : null),
      ...(phasePlan.publishRhythm ? { rhythmLabel: phasePlan.rhythmLabel } : {}),
    });

    if (!isPlayable) continue;

    const trackDirectoryName = `${id}-${phaseId}`;
    const trackDirectory = resolve(extensionRoot, "content/tracks", trackDirectoryName);
    const audioSource = resolve(sourceRoot, id, "sounds", phaseId, phasePlan.sourceAudio);
    const audioDestination = resolve(trackDirectory, "audio", phasePlan.sourceAudio);
    await copyUnlessSame(audioSource, audioDestination);

    const sourceFramesDirectory = resolve(sourceRoot, id, "sprites", phaseId);
    const frameNames = (await readdir(sourceFramesDirectory))
      .filter(filename => extname(filename).toLowerCase() === ".svg" && filename !== "idle.svg")
      .sort(naturalCompare);
    await copyUnlessSame(
      resolve(sourceFramesDirectory, "idle.svg"),
      resolve(trackDirectory, "animation", "idle.svg")
    );
    for (const frameName of frameNames) {
      await copyUnlessSame(
        resolve(sourceFramesDirectory, frameName),
        resolve(trackDirectory, "animation", frameName)
      );
    }

    const midiStem = phasePlan.sourceAudio.replace(/\.wav$/i, "");
    const candidateMidi = phasePlan.existingMidi
      ? resolve(repositoryRoot, phasePlan.existingMidi)
      : resolve(
          repositoryRoot,
          "tools/authoring/workbench/original-sprunki",
          id,
          phaseId,
          `${midiStem}_${phasePlan.publishRhythm ? "rhythm" : "basic_pitch"}.mid`
        );
    const midiFilename = `${trackId}-${phasePlan.publishRhythm ? "rhythm" : "basic-pitch"}.mid`;
    const midiDestination = resolve(trackDirectory, "lesson", midiFilename);
    await copyUnlessSame(candidateMidi, midiDestination);

    const audioDuration = wavDurationMs(await readFile(audioSource));
    const primary = color;
    const secondary = mixHex(color, "#ffffff", 0.3);
    const sourceAudioRelative = `SprunkiAssets/sprunkis/${id}/sounds/${phaseId}/${phasePlan.sourceAudio}`;
    lessonTracks.push({
      id: trackId,
      title: `${name} — Phase ${phaseNumber}`,
      subtitle: phasePlan.publishRhythm
        ? `Draft rhythm lesson · ${phasePlan.rhythmLabel}`
        : `Draft transcription · ${categoryLabels[phasePlan.category] || phasePlan.category}`,
      filename: midiFilename,
      emoji,
      midi: publicAsset("tracks", trackDirectoryName, "lesson", midiFilename),
      kind: "sprunki-lesson",
      reviewStatus: "draft",
      lesson: {
        gameId: "original-sprunki",
        characterId: id,
        phaseId,
        playerMode: phasePlan.publishRhythm ? "rhythm" : "piano",
        loopByDefault: true,
        loopDurationMs: audioDuration,
        instrumentId,
        effectId,
        ...(phasePlan.publishRhythm ? {
          rhythmLabel: phasePlan.rhythmLabel,
          rhythmMidiNote: phasePlan.rhythmMidiNote,
        } : {}),
        referenceAudio: publicAsset("tracks", trackDirectoryName, "audio", phasePlan.sourceAudio),
        theme: {
          primary,
          secondary,
          leftHand: mixHex(color, "#ffffff", 0.12),
          rightHand: secondary,
          background: mixHex(color, "#000000", 0.88),
        },
        animation: {
          idle: publicAsset("tracks", trackDirectoryName, "animation", "idle.svg"),
          frames: frameNames.map(frame => publicAsset("tracks", trackDirectoryName, "animation", frame)),
          frameDurationMs: 116,
        },
      },
      transcription: {
        engine: phasePlan.publishRhythm ? "energy-onset-detector" : "spotify-basic-pitch",
        engineVersion: phasePlan.publishRhythm ? "1.0.0" : "0.3.0",
        sourceAudio: sourceAudioRelative,
        reviewRequired: true,
        parameters: {
          ...(phasePlan.publishRhythm ? {
            detector: "energy-novelty-v1",
            rhythmMidiNote: phasePlan.rhythmMidiNote,
          } : {
            minimumFrequencyHz: phasePlan.minimumFrequencyHz,
            maximumFrequencyHz: phasePlan.maximumFrequencyHz,
          }),
          category: phasePlan.category,
        },
      },
    });
  }

  manifestCharacters.push({ id, name, color, phases });
}

const manifest = {
  schemaVersion: "1.0.0",
  id: "original-sprunki",
  title: "Original Sprunki",
  characters: manifestCharacters,
};
await writeFile(resolve(outputRoot, "game.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const cataloguePath = resolve(extensionRoot, "content/catalog.json");
const catalogue = JSON.parse(await readFile(cataloguePath, "utf8"));
catalogue.tracks = lessonTracks;
await writeFile(cataloguePath, `${JSON.stringify(catalogue, null, 2)}\n`);

console.log(
  `Built Original Sprunki manifest with ${manifestCharacters.length} characters and ` +
  `${lessonTracks.length} playable lesson drafts.`
);
