import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = resolve(repositoryRoot, "SprunkiAssets/sprunkis");
const outputRoot = resolve(repositoryRoot, "apps/player/content/games/original-sprunki");

const characters = [
  ["orange-oren", "Oren", "#ff7a00", "percussion", "impact-sparks"],
  ["red-raddy", "Raddy", "#ed3434", "percussion", "impact-sparks"],
  ["silver-clukr", "Clukr", "#b7c1cc", "percussion", "bright-sparks"],
  ["fun-bot", "Fun Bot", "#8d99a8", "percussion", "bright-sparks"],
  ["green-vineria", "Vineria", "#35b86b", "percussion", "bright-sparks"],
  ["gray-gray", "Gray", "#777b82", "synth-bass", "shadow-sparks"],
  ["brown-brud", "Brud", "#9b633f", "sound-effect", "impact-sparks"],
  ["gold-garnold", "Garnold", "#e7b928", "synth-lead", "sun-sparks"],
  ["lime-owakcx", "OWAKCX", "#a7e62e", "sound-effect", "bright-sparks"],
  ["sky-blue-sky", "Sky", "#7edcf5", "music-box", "bright-sparks"],
  ["mr-sun", "Mr Sun", "#ffe900", "grand-piano", "sun-sparks"],
  ["purple-durple", "Durple", "#8b5ad8", "brass", "shadow-sparks"],
  ["mr-tree", "Mr Tree", "#4d9b51", "organ", "bright-sparks"],
  ["yellow-simon", "Simon", "#f2dc37", "synth-lead", "sun-sparks"],
  ["tan-tunner", "Tunner", "#c89f72", "whistle", "bright-sparks"],
  ["mr-fun-computer", "Mr Fun Computer", "#8fd9ff", "sound-effect", "bright-sparks"],
  ["white-wenda", "Wenda", "#f2f2f2", "choir", "bright-sparks"],
  ["pink-pinki", "Pinki", "#f38cc8", "choir", "bright-sparks"],
  ["blue-jevin", "Jevin", "#335fc5", "choir", "shadow-sparks"],
  ["black-mystery", "Black", "#27232d", "sound-effect", "shadow-sparks"]
];

const manifestCharacters = [];
for (const [id, name, color, instrumentId, effectId] of characters) {
  const characterDirectory = resolve(outputRoot, "characters", id);
  await mkdir(characterDirectory, { recursive: true });

  const phases = [];
  for (const phaseNumber of [1, 2]) {
    const phaseId = `phase${phaseNumber}`;
    const portraitFilename = `${phaseId}.svg`;
    await copyFile(
      resolve(sourceRoot, id, "sprites", phaseId, "idle.svg"),
      resolve(characterDirectory, portraitFilename)
    );

    const isMrSunLesson = id === "mr-sun" && phaseNumber === 1;
    phases.push({
      id: phaseId,
      title: `Phase ${phaseNumber}`,
      portrait: `./content/games/original-sprunki/characters/${id}/${portraitFilename}`,
      locked: !isMrSunLesson,
      lessonTrackId: isMrSunLesson ? "mr-sun-phase1-draft" : null,
      instrumentId,
      effectId
    });
  }

  manifestCharacters.push({ id, name, color, phases });
}

const manifest = {
  schemaVersion: "1.0.0",
  id: "original-sprunki",
  title: "Original Sprunki",
  characters: manifestCharacters
};

await writeFile(resolve(outputRoot, "game.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built Original Sprunki manifest with ${manifestCharacters.length} characters.`);
