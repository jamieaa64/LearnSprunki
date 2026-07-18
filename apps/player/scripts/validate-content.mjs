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
    let detail = {};
    if (manifest.validator) {
      const validatorPath = await requireAsset(projectDirectory, manifest.validator, resolve(projectDirectory, "extensions"));
      const validator = await import(pathToFileURL(validatorPath).href);
      requireValue(typeof validator.validateExtension === "function", `${manifest.id} validator must export validateExtension`);
      detail = await validator.validateExtension({
        projectDirectory,
        extensionRoot: dirname(manifestPath),
        manifest,
        readJson,
        requireAsset,
        requireValue,
      });
    }
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
