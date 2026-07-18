function requireExtension(condition, message) {
  if (!condition) throw new Error(`Invalid NeoKeys extension: ${message}`);
}

export function validateExtensionManifest(manifest) {
  requireExtension(manifest && typeof manifest === "object", "manifest must be an object");
  requireExtension(manifest.schemaVersion === "1.0.0", "expected schemaVersion 1.0.0");
  for (const field of ["id", "name", "version", "entry"]) {
    requireExtension(typeof manifest[field] === "string" && manifest[field].length > 0, `missing ${field}`);
  }
  requireExtension(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id), `invalid id ${manifest.id}`);
  requireExtension(manifest.entry.startsWith("./extensions/"), "entry must stay inside ./extensions/");
  if (manifest.stylesheet) {
    requireExtension(manifest.stylesheet.startsWith("./extensions/"), "stylesheet must stay inside ./extensions/");
  }
  return manifest;
}

export class ExtensionHost {
  constructor(api) {
    this.api = Object.freeze({ ...api });
    this.extensions = new Map();
    this.activeController = null;
    this.activeExtensionId = null;
  }

  register(manifest, extension) {
    validateExtensionManifest(manifest);
    requireExtension(extension && typeof extension === "object", `${manifest.id} has no extension object`);
    requireExtension(typeof extension.activate === "function", `${manifest.id} must export activate(api, manifest)`);
    requireExtension(!this.extensions.has(manifest.id), `duplicate id ${manifest.id}`);
    this.extensions.set(manifest.id, { manifest, extension, instance: null });
  }

  async startAll() {
    for (const record of this.extensions.values()) {
      record.instance = await record.extension.activate(this.api, record.manifest);
      requireExtension(record.instance && typeof record.instance === "object", `${record.manifest.id} activate() returned no instance`);
    }
  }

  activateTrack(track) {
    this.deactivateTrack();
    for (const [id, record] of this.extensions) {
      if (!record.instance?.canHandleTrack?.(track)) continue;
      this.activeController = record.instance.activateTrack(track) || null;
      this.activeExtensionId = id;
      return this.activeController;
    }
    return null;
  }

  deactivateTrack() {
    this.activeController?.deactivate?.();
    this.activeController = null;
    this.activeExtensionId = null;
  }

  notifyTrackChanged(trackId) {
    for (const record of this.extensions.values()) record.instance?.onTrackChanged?.(trackId);
  }
}

export async function loadExtensionRegistry(registryPath, host, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const importImpl = options.importImpl || (path => import(new URL(path, globalThis.location.href).href));
  const documentRef = options.documentRef || globalThis.document;
  const registryResponse = await fetchImpl(registryPath);
  if (!registryResponse.ok) throw new Error(`Extension registry request failed (${registryResponse.status})`);
  const registry = await registryResponse.json();
  requireExtension(registry.schemaVersion === "1.0.0", "registry schemaVersion must be 1.0.0");
  requireExtension(Array.isArray(registry.extensions), "registry extensions must be an array");

  for (const reference of registry.extensions) {
    requireExtension(typeof reference.manifest === "string" && reference.manifest.startsWith("./extensions/"), "invalid manifest path");
    const manifestResponse = await fetchImpl(reference.manifest);
    if (!manifestResponse.ok) throw new Error(`Extension manifest request failed (${manifestResponse.status})`);
    const manifest = validateExtensionManifest(await manifestResponse.json());
    if (manifest.stylesheet && documentRef) {
      const link = documentRef.createElement("link");
      link.rel = "stylesheet";
      link.href = manifest.stylesheet;
      link.dataset.neokeysExtension = manifest.id;
      documentRef.head.append(link);
    }
    host.register(manifest, await importImpl(manifest.entry));
  }
  await host.startAll();
  return host;
}
