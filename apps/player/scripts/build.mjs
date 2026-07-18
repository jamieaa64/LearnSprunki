import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateCatalogue } from "./validate-content.mjs";

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(projectDirectory, "dist");
const vendorDirectory = resolve(outputDirectory, "vendor");

const vendorFiles = [
  {
    source: "node_modules/tone/build/Tone.js",
    output: "vendor/Tone.js",
  },
  {
    source: "node_modules/@tonejs/midi/build/Midi.js",
    output: "vendor/Midi.js",
  },
  {
    source: "node_modules/midi-writer-js/browser/midiwriter.js",
    output: "vendor/midiwriter.js",
  },
];

await validateCatalogue(projectDirectory);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(vendorDirectory, { recursive: true });

let html = await readFile(resolve(projectDirectory, "index.html"), "utf8");
for (const file of vendorFiles) {
  const sourcePath = resolve(projectDirectory, file.source);
  const outputPath = resolve(outputDirectory, file.output);
  await copyFile(sourcePath, outputPath);
  html = html.replace(`./${file.source}`, `./${file.output}`);
}

if (html.includes("./node_modules/")) {
  throw new Error("Production HTML still contains a node_modules URL.");
}

await writeFile(resolve(outputDirectory, "index.html"), html);
await copyFile(resolve(projectDirectory, "styles.css"), resolve(outputDirectory, "styles.css"));
await copyFile(resolve(projectDirectory, "app.js"), resolve(outputDirectory, "app.js"));
await cp(resolve(projectDirectory, "content"), resolve(outputDirectory, "content"), {
  recursive: true,
});
await copyFile(resolve(projectDirectory, "LICENSE"), resolve(outputDirectory, "LICENSE"));

console.log("Built LearnSprunki Player in dist/ with local dependencies and song catalogue.");
