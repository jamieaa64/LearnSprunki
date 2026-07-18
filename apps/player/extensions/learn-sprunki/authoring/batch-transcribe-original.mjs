import { access, mkdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../../../..");
const plan = JSON.parse(await readFile(resolve(scriptDirectory, "original-sprunki-plan.json"), "utf8"));
const wrapper = resolve(scriptDirectory, "transcribe-basic-pitch.sh");

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: repositoryRoot, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with ${code}`)));
  });
}

let created = 0;
let skipped = 0;
for (const [phaseKey, phase] of Object.entries(plan.phases)) {
  if (!phase.publishDraft || phase.existingMidi) continue;
  const [characterId, phaseId] = phaseKey.split("/");
  const sourceAudio = resolve(
    repositoryRoot,
    "apps/player/extensions/learn-sprunki/source-assets/sprunkis",
    characterId,
    "sounds",
    phaseId,
    phase.sourceAudio
  );
  const outputDirectory = resolve(
    repositoryRoot,
    "apps/player/extensions/learn-sprunki/authoring/workbench/original-sprunki",
    characterId,
    phaseId
  );
  const stem = phase.sourceAudio.replace(/\.wav$/i, "");
  const midi = resolve(outputDirectory, `${stem}_basic_pitch.mid`);
  await mkdir(outputDirectory, { recursive: true });
  if (await exists(midi)) {
    console.log(`Skipping existing candidate: ${phaseKey}`);
    skipped++;
    continue;
  }
  console.log(`\nTranscribing ${phaseKey} from ${phase.sourceAudio}`);
  await run(wrapper, [
    sourceAudio,
    outputDirectory,
    String(phase.minimumFrequencyHz || 80),
    String(phase.maximumFrequencyHz || 2200),
  ]);
  created++;
}

console.log(`Batch transcription complete: ${created} created, ${skipped} skipped.`);
