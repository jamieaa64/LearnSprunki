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
}

export async function validateCatalogue(projectDirectory) {
  const cataloguePath = resolve(projectDirectory, "content/catalog.json");
  const catalogue = JSON.parse(await readFile(cataloguePath, "utf8"));
  requireValue(catalogue.schemaVersion === "2.0.0", "expected schemaVersion 2.0.0");
  requireValue(Array.isArray(catalogue.tracks), "tracks must be an array");
  requireValue(Array.isArray(catalogue.collections), "collections must be an array");

  const tracksById = new Map();
  for (const track of catalogue.tracks) {
    requireValue(track.id && !tracksById.has(track.id), `duplicate or missing track id ${track.id}`);
    tracksById.set(track.id, track);
    await requireAsset(projectDirectory, track.midi);
  }

  for (const collection of catalogue.collections) {
    for (const character of collection.characters || []) {
      await requireAsset(projectDirectory, character.icon);
      for (const phase of character.phases || []) {
        requireValue(tracksById.has(phase.lessonTrackId), `missing lesson track ${phase.lessonTrackId}`);
        requireValue(typeof phase.loop === "boolean", `${phase.id} is missing its loop setting`);
        requireValue(Number.isFinite(phase.loopDurationMs) && phase.loopDurationMs > 0, `${phase.id} has an invalid loop duration`);
        await requireAsset(projectDirectory, phase.referenceAudio);
        await requireAsset(projectDirectory, phase.animation.idle);
        requireValue(Array.isArray(phase.animation.frames) && phase.animation.frames.length > 0, `${phase.id} has no animation frames`);
        for (const frame of phase.animation.frames) await requireAsset(projectDirectory, frame);
      }
    }
  }

  return {
    catalogue: relative(projectDirectory, cataloguePath),
    tracks: tracksById.size,
    collections: catalogue.collections.length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const projectDirectory = resolve(scriptDirectory, "..");
  const result = await validateCatalogue(projectDirectory);
  console.log(`Validated ${result.tracks} tracks across ${result.collections} collection(s).`);
}
