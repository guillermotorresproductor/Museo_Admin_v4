import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const imageSource = fs.readFileSync(new URL("js/inventory-image.js", root), "utf8");
const appSource = fs.readFileSync(new URL("js/app.js", root), "utf8");
const html = fs.readFileSync(new URL("inventario.html", root), "utf8");
const MAX_OUTPUT_BYTES = 500 * 1024;

function makeBlob(byteLength, { type = "image/webp", webp = true } = {}) {
  const header = webp
    ? [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]
    : [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
  const blob = new Blob([Uint8Array.from(header)], { type });
  Object.defineProperty(blob, "size", { value: byteLength });
  return blob;
}

function loadProcessor() {
  const calls = { decode: 0, closed: 0, canvas: 0, encodes: [], revoked: [] };
  const hooks = { forceImage: false, unreadable: false, width: 0, height: 0 };
  let encode = () => makeBlob(100 * 1024);
  const sandbox = {
    module: { exports: {} },
    exports: {},
    Uint8Array,
    Blob,
    console,
    URL: {
      createObjectURL() { return "blob:inventory-test"; },
      revokeObjectURL(url) { calls.revoked.push(url); }
    },
    document: {
      createElement(tag) {
        calls.canvas += 1;
        assert.equal(tag, "canvas");
        const canvas = {
          width: 0,
          height: 0,
          getContext() {
            return canvas.context;
          },
          context: {
            fillStyle: "",
            fillRect() {},
            drawImage() {}
          },
          toBlob(callback, type, quality) {
            calls.encodes.push({ width: canvas.width, height: canvas.height, type, quality });
            callback(encode({ width: canvas.width, height: canvas.height, type, quality }));
          }
        };
        return canvas;
      }
    },
    createImageBitmap: async (file) => {
      calls.decode += 1;
      if (hooks.forceImage || file.bitmapError) throw new Error("bitmap unavailable");
      return {
        width: file.width,
        height: file.height,
        close() { calls.closed += 1; }
      };
    },
    Image: class {
      set src(url) {
        this.assignedUrl = url;
        queueMicrotask(() => {
          if (hooks.unreadable) {
            this.onerror?.();
            return;
          }
          this.width = hooks.width;
          this.height = hooks.height;
          this.onload?.();
        });
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(imageSource, sandbox);
  return {
    image: sandbox.module.exports,
    calls,
    sandbox,
    setEncode(fn) { encode = fn; },
    useImageFallback(file) {
      hooks.forceImage = true;
      hooks.unreadable = Boolean(file.unreadable);
      hooks.width = file.width;
      hooks.height = file.height;
    }
  };
}

function photoFile({ name = "celular.jpg", type = "image/jpeg", size = 4 * 1024 * 1024, width = 4032, height = 3024, ...extra } = {}) {
  return { name, type, size, width, height, ...extra };
}

test("una fotografía JPG grande de celular se convierte a WebP dentro de 500 KiB", async () => {
  const processor = loadProcessor();
  processor.setEncode(() => makeBlob(180 * 1024));
  const result = await processor.image.process(photoFile());
  assert.equal(result.type, "image/webp");
  assert.equal(result.blob.type, "image/webp");
  assert.ok(result.bytes <= MAX_OUTPUT_BYTES);
  assert.ok(result.width >= result.height);
  assert.equal(processor.calls.closed, 1);
  assert.equal(processor.calls.encodes[0].type, "image/webp");
  assert.equal(processor.calls.encodes.length, 1);
});

test("un PNG con mucho detalle se reduce sin perder la orientación ni superar 500 KiB", async () => {
  const processor = loadProcessor();
  const plan = processor.image.searchPlan(3500, 2600);
  processor.setEncode(({ width, height, quality }) => {
    const detailed = quality > 0.5 && width === plan.sizes[0].width;
    return makeBlob(detailed ? MAX_OUTPUT_BYTES + 4096 : 240 * 1024);
  });
  const result = await processor.image.process(photoFile({
    name: "detalle.png",
    type: "image/png",
    width: 3500,
    height: 2600
  }));
  assert.equal(result.width, plan.sizes[0].width);
  assert.equal(result.height, plan.sizes[0].height);
  assert.ok(result.width > result.height);
  assert.ok(result.bytes <= MAX_OUTPUT_BYTES);
  assert.ok(processor.calls.encodes.length > 1);
  assert.equal(processor.calls.closed, 1);
});

test("respeta la orientación horizontal y vertical", async () => {
  const landscape = loadProcessor();
  landscape.setEncode(() => makeBlob(120 * 1024));
  const wide = await landscape.image.process(photoFile({ width: 4032, height: 3024 }));
  const portrait = loadProcessor();
  portrait.setEncode(() => makeBlob(120 * 1024));
  const tall = await portrait.image.process(photoFile({ name: "vertical.jpg", width: 3024, height: 4032 }));
  assert.ok(wide.width > wide.height);
  assert.ok(tall.height > tall.width);
  assert.equal(wide.width, tall.height);
  assert.equal(wide.height, tall.width);
});

test("acepta la imagen solo cuando la última combinación de calidad y tamaño cabe en 500 KiB", async () => {
  const processor = loadProcessor();
  const plan = processor.image.searchPlan(4000, 3000);
  const lastSize = plan.sizes.at(-1);
  const lastQuality = plan.qualities.at(-1);
  assert.equal(lastQuality, processor.image.limits.MIN_QUALITY);
  assert.equal(lastQuality, 0.35);
  processor.setEncode(({ width, height, quality }) => {
    const last = width === lastSize.width && height === lastSize.height && quality === lastQuality;
    return makeBlob(last ? MAX_OUTPUT_BYTES : MAX_OUTPUT_BYTES + 1);
  });
  const result = await processor.image.process(photoFile({ width: 4000, height: 3000 }));
  assert.equal(processor.calls.encodes.length, plan.sizes.length * plan.qualities.length);
  assert.deepEqual(processor.calls.encodes.at(-1), {
    width: lastSize.width,
    height: lastSize.height,
    type: "image/webp",
    quality: 0.35
  });
  assert.equal(result.width, lastSize.width);
  assert.equal(result.height, lastSize.height);
  assert.equal(result.bytes, MAX_OUTPUT_BYTES);
  assert.equal(processor.calls.closed, 1);
});

test("rechaza la salida cuando el navegador devuelve PNG en lugar de WebP", async () => {
  const processor = loadProcessor();
  processor.setEncode(() => makeBlob(80 * 1024, { type: "image/png", webp: false }));
  await assert.rejects(
    () => processor.image.process(photoFile()),
    /no generó una imagen WebP/
  );
  assert.equal(processor.calls.encodes.length, 1);
  assert.equal(processor.calls.closed, 1);
});

test("rechaza un archivo cuyo tipo dice WebP pero cuya firma no lo es", async () => {
  const processor = loadProcessor();
  processor.setEncode(() => makeBlob(80 * 1024, { type: "image/webp", webp: false }));
  await assert.rejects(
    () => processor.image.process(photoFile()),
    /firma WebP válida/
  );
  assert.equal(processor.calls.closed, 1);
});

test("rechaza una fotografía de más de 10 MB antes de decodificarla", async () => {
  const processor = loadProcessor();
  await assert.rejects(
    () => processor.image.process(photoFile({ size: 10 * 1024 * 1024 + 1 })),
    /10 MB/
  );
  assert.equal(processor.calls.decode, 0);
  assert.equal(processor.calls.canvas, 0);
});

test("rechaza una fotografía menor de 800×600 y libera la imagen", async () => {
  const processor = loadProcessor();
  await assert.rejects(
    () => processor.image.process(photoFile({ width: 799, height: 1200 })),
    /800×600/
  );
  await assert.rejects(
    () => processor.image.process(photoFile({ width: 1200, height: 599 })),
    /800×600/
  );
  assert.equal(processor.calls.closed, 2);
  assert.equal(processor.calls.encodes.length, 0);
});

test("informa con claridad cuando ni la última combinación cabe en 500 KiB", async () => {
  const processor = loadProcessor();
  const plan = processor.image.searchPlan(1800, 1200);
  processor.setEncode(() => makeBlob(MAX_OUTPUT_BYTES + 8));
  await assert.rejects(
    () => processor.image.process(photoFile({ width: 1800, height: 1200 })),
    /No se pudo reducir la fotografía a 500 KB/
  );
  assert.equal(processor.calls.encodes.length, plan.sizes.length * plan.qualities.length);
  assert.equal(processor.calls.encodes.at(-1).quality, 0.35);
  assert.equal(processor.calls.closed, 1);
});

test("la ruta de imagen revoca el object URL y conserva la orientación", async () => {
  const processor = loadProcessor();
  const file = photoFile({ name: "fallback.jpg", width: 3024, height: 4032 });
  processor.useImageFallback(file);
  processor.setEncode(() => makeBlob(90 * 1024));
  const result = await processor.image.process(file);
  assert.ok(result.height > result.width);
  assert.deepEqual(processor.calls.revoked, ["blob:inventory-test"]);
});

test("un HEIC que el navegador no puede leer no deja el object URL abierto", async () => {
  const processor = loadProcessor();
  const file = photoFile({ name: "iphone.heic", type: "image/heic", width: 3024, height: 4032, unreadable: true });
  processor.useImageFallback(file);
  await assert.rejects(() => processor.image.process(file), /HEIC/);
  assert.deepEqual(processor.calls.revoked, ["blob:inventory-test"]);
});

test("el formulario de inventario usa el procesador corregido en la caché", () => {
  assert.match(html, /js\/inventory-image\.js\?v=inventory-photo-processing-20261012/);
  assert.match(html, /js\/app\.js\?v=inventory-photo-uncertain-create-20261012/);
  assert.match(html, /js\/services\/supabase\.js\?v=inventory-responsible-names-20261012/);
  assert.match(html, /data-inventory-photo-clear hidden>Quitar fotografía/);
});

function listen(target) {
  target.listeners = {};
  target.addEventListener = (type, fn) => { (target.listeners[type] ||= []).push(fn); };
  return target;
}

function field(name, value = "") {
  return listen({
    name,
    value,
    defaultValue: value,
    readOnly: false,
    focus() {}
  });
}

function select(name, values) {
  return listen({
    name,
    value: "",
    defaultValue: "",
    options: values.map((value) => ({ value, text: value, remove() {} })),
    add(option) { this.options.push(option); },
    replaceChildren(...nodes) { this.options = nodes; }
  });
}

function control(extra = {}) {
  return {
    listeners: {},
    value: "",
    textContent: "",
    innerHTML: "",
    className: "",
    hidden: false,
    disabled: false,
    checked: false,
    readOnly: false,
    files: [],
    dataset: {},
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    querySelector() { return { innerHTML: "" }; },
    scrollIntoView() {},
    focus() {},
    ...extra
  };
}

function createRegistrationHarness() {
  const calls = { creates: [], uploads: [], updates: [] };
  let items = [];
  let processImpl = async () => ({ blob: makeBlob(100 * 1024), width: 1600, height: 1200, bytes: 100 * 1024, type: "image/webp" });
  const permissions = new Set(["inventory.create", "inventory.photo.attach"]);
  const elements = {
    id: field("id"),
    version: field("version"),
    name: field("name"),
    asset_tag: field("asset_tag", "S-1"),
    serial_number: field("serial_number"),
    description: field("description"),
    category: select("category", ["", "Utilería", "Eléctricos", "Mantenimiento", "Producción"]),
    brand: field("brand"),
    model: field("model"),
    record_type: field("record_type", "individual"),
    quantity: field("quantity", "1"),
    purchase_order: field("purchase_order"),
    received_date: field("received_date"),
    cost: field("cost"),
    location: select("location", ["", "Almacén 1", "Oficina", "Taller"]),
    responsible: select("responsible", [""]),
    status: field("status", "activo"),
    warranty: field("warranty")
  };
  const form = control({
    elements,
    reset() {
      Object.values(elements).forEach((element) => {
        element.value = element.defaultValue || "";
      });
    },
    reportValidity() { return true; }
  });
  const photoInput = control({ id: "inventory-photo", files: [] });
  const cameraInput = control({ id: "inventory-photo-camera", files: [] });
  const preview = control();
  const clearButton = control({ hidden: true });
  const submitButton = control({ textContent: "Registrar equipo" });
  const cancelButton = control({ hidden: true });
  const message = control();
  const listMessage = control();
  const list = control();
  const entryPanel = control({ hidden: false });
  const addButton = control({ hidden: true });
  const nodes = new Map([
    ["#inventory-form", form],
    ["[data-inventory-entry-panel]", entryPanel],
    ["[data-inventory-list]", list],
    ["[data-inventory-message]", message],
    ["[data-inventory-list-message]", listMessage],
    ["[data-inventory-search]", control()],
    ["[data-inventory-filter-location]", select("location-filter", [""])],
    ["[data-inventory-filter-status]", select("status-filter", [""])],
    ["[data-inventory-show-archived]", control()],
    ["[data-inventory-total]", control()],
    ["[data-inventory-pieces]", control()],
    ["[data-inventory-submit]", submitButton],
    ["[data-inventory-cancel]", cancelButton],
    ["#inventory-id", elements.id],
    ["#inventory-version", elements.version],
    ["#inventory-photo", photoInput],
    ["#inventory-photo-camera", cameraInput],
    ["#inventory-record-type", elements.record_type],
    ["#inventory-quantity", elements.quantity],
    ["[data-inventory-photo-preview]", preview],
    ["[data-inventory-photo-clear]", clearButton],
    ["[data-inventory-detail-dialog]", control({ showModal() {}, close() {} })],
    ["[data-inventory-detail]", control()],
    ["[data-inventory-detail-close]", control()],
    ["[data-inventory-add]", addButton],
    ["[data-inventory-form-title]", control()]
  ]);
  class HTMLInputElement {
    constructor() {
      this.listeners = {};
      this.files = [];
      this.value = "";
      this.disabled = false;
      this.dataset = {};
    }
    matches(selector) {
      const gallery = selector.includes("data-inventory-add-photo") && this.dataset.inventoryAddPhoto;
      const camera = selector.includes("data-inventory-take-photo") && this.dataset.inventoryTakePhoto;
      return Boolean(gallery || camera);
    }
  }
  class Option {
    constructor(text, value) {
      this.text = text;
      this.value = value ?? text;
    }
    remove() {}
  }
  class FormData {
    constructor(target) {
      this.entries = Object.values(target.elements)
        .filter((element) => element?.name)
        .map((element) => [element.name, element.value ?? ""]);
    }
    get(name) {
      const found = this.entries.find(([key]) => key === name);
      return found ? found[1] : null;
    }
  }
  const urls = [];
  const sandbox = {
    document: {
      listeners: {},
      querySelector: (selector) => nodes.get(selector) || null,
      addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    },
    HTMLInputElement,
    Option,
    FormData,
    URL: {
      createObjectURL(blob) {
        const url = `blob:preview-${urls.length + 1}`;
        urls.push({ url, blob });
        return url;
      },
      revokeObjectURL(url) {
        const index = urls.findIndex((item) => item.url === url);
        if (index >= 0) urls.splice(index, 1);
      }
    },
    hasPermission: (permission) => permissions.has(permission),
    safeHtml: (value) => String(value || "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]),
    fetchActiveMuseumEmployeeNames: async () => ["Ana Pérez"],
    fetchSupabaseInventoryItems: async () => items.map((item) => ({ ...item })),
    createSupabaseInventoryItem: async (payload) => {
      calls.creates.push(payload);
      const saved = {
        id: `equipo-${calls.creates.length}`,
        museum_id: "museo-1",
        version: 1,
        photo_path: null,
        archived_at: null,
        updated_at: "2026-10-12T12:00:00Z",
        condition: "por_verificar",
        ...payload
      };
      items = [saved, ...items.filter((item) => item.id !== saved.id)];
      return saved;
    },
    updateSupabaseInventoryItem: async (...args) => {
      calls.updates.push(args);
      throw new Error("Marketing no puede actualizar equipos");
    },
    uploadSupabaseInventoryPhoto: async (item, blob) => {
      calls.uploads.push({ id: item.id, blob });
      if (calls.failUploads > 0) {
        calls.failUploads -= 1;
        throw new Error("No se pudo guardar la fotografía.");
      }
      const saved = { ...item, photo_path: `${item.museum_id}/${item.id}/main.webp`, version: Number(item.version) + 1 };
      items = items.map((current) => current.id === item.id ? saved : current);
      return saved;
    },
    archiveSupabaseInventoryItem: async () => { throw new Error("Marketing no puede archivar equipos"); },
    signSupabaseInventoryPhoto: async () => "https://example.invalid/foto",
    InventoryImage: { process: (file) => processImpl(file) },
    console
  };
  calls.failUploads = 0;
  const start = appSource.indexOf("function bindInventoryModule()");
  const end = appSource.indexOf("\nfunction bindCalendarModules(");
  assert.ok(start >= 0 && end > start);
  vm.createContext(sandbox);
  vm.runInContext(`${appSource.slice(start, end)}\nthis.bindInventoryModule = bindInventoryModule;`, sandbox);
  sandbox.bindInventoryModule();
  return {
    calls,
    sandbox,
    elements,
    form,
    photoInput,
    cameraInput,
    preview,
    clearButton,
    submitButton,
    message,
    listMessage,
    list,
    urls,
    permissions,
    setProcess(fn) { processImpl = fn; },
    setItems(next) { items = next; },
    async flush() {
      for (let step = 0; step < 6; step += 1) await new Promise((resolve) => setImmediate(resolve));
    },
    async submit() {
      const event = { preventDefault() {}, target: form };
      await form.listeners.submit[0](event);
    },
    selectPhoto(input, file) {
      input.files = [file];
      input.listeners.change.forEach((fn) => fn({ target: input }));
    },
    clearPhoto() {
      clearButton.listeners.click.forEach((fn) => fn({}));
    }
  };
}

async function readyHarness() {
  const harness = createRegistrationHarness();
  await harness.flush();
  harness.elements.name.value = "Micrófono de sala";
  harness.elements.category.value = "Producción";
  harness.elements.location.value = "Oficina";
  harness.elements.status.value = "activo";
  return harness;
}

test("una selección rápida conserva solo la última fotografía y los campos ya escritos", async () => {
  const harness = await readyHarness();
  let resolveFirst;
  let resolveSecond;
  harness.setProcess((file) => new Promise((resolve) => {
    if (file.name === "primera.jpg") resolveFirst = () => resolve({ blob: makeBlob(80 * 1024), width: 1200, height: 900, bytes: 80 * 1024, type: "image/webp" });
    if (file.name === "segunda.jpg") resolveSecond = () => resolve({ blob: makeBlob(90 * 1024), width: 1000, height: 1400, bytes: 90 * 1024, type: "image/webp" });
  }));
  harness.selectPhoto(harness.photoInput, photoFile({ name: "primera.jpg" }));
  harness.selectPhoto(harness.cameraInput, photoFile({ name: "segunda.jpg", width: 3024, height: 4032 }));
  await harness.flush();
  resolveFirst();
  await harness.flush();
  assert.equal(harness.preview.innerHTML.includes("1200×900"), false);
  resolveSecond();
  await harness.flush();
  assert.match(harness.preview.innerHTML, /1000×1400/);
  assert.equal(harness.elements.name.value, "Micrófono de sala");
  assert.equal(harness.urls.length, 1);
  await harness.submit();
  assert.equal(harness.calls.creates.length, 1);
  assert.equal(harness.calls.uploads.length, 1);
  assert.equal(harness.calls.uploads[0].blob.size, 90 * 1024);
  assert.equal(harness.calls.creates[0].name, "Micrófono de sala");
});

test("tras un fallo de compresión se puede quitar la foto y registrar sin perder los datos", async () => {
  const harness = await readyHarness();
  harness.setProcess(async () => { throw new Error("No se pudo reducir la fotografía a 500 KB. Intente con una imagen menos compleja."); });
  harness.selectPhoto(harness.photoInput, photoFile({ name: "compleja.jpg" }));
  await harness.flush();
  assert.match(harness.message.textContent, /500 KB/);
  assert.equal(harness.elements.name.value, "Micrófono de sala");
  assert.equal(harness.submitButton.disabled, false);
  await harness.submit();
  assert.equal(harness.calls.creates.length, 0);
  assert.equal(harness.elements.name.value, "Micrófono de sala");
  harness.clearPhoto();
  assert.match(harness.message.textContent, /Puede registrar el equipo sin ella/);
  assert.equal(harness.elements.name.value, "Micrófono de sala");
  assert.equal(harness.preview.innerHTML.includes("<img"), false);
  await harness.submit();
  assert.equal(harness.calls.creates.length, 1);
  assert.equal(harness.calls.uploads.length, 0);
  assert.equal(harness.calls.creates[0].name, "Micrófono de sala");
  assert.match(harness.message.textContent, /Equipo registrado correctamente/);
});

test("cambiar la fotografía no borra los campos y sustituye el error anterior", async () => {
  const harness = await readyHarness();
  let attempt = 0;
  harness.setProcess(async () => {
    attempt += 1;
    if (attempt === 1) throw new Error("No se pudo reducir la fotografía a 500 KB. Intente con una imagen menos compleja.");
    return { blob: makeBlob(70 * 1024), width: 1280, height: 960, bytes: 70 * 1024, type: "image/webp" };
  });
  harness.selectPhoto(harness.photoInput, photoFile({ name: "mala.jpg" }));
  await harness.flush();
  assert.match(harness.message.textContent, /500 KB/);
  harness.elements.asset_tag.value = "TAG-42";
  harness.selectPhoto(harness.photoInput, photoFile({ name: "buena.jpg" }));
  await harness.flush();
  assert.match(harness.message.textContent, /Fotografía lista/);
  assert.match(harness.preview.innerHTML, /1280×960/);
  assert.equal(harness.elements.name.value, "Micrófono de sala");
  assert.equal(harness.elements.asset_tag.value, "TAG-42");
  await harness.submit();
  assert.equal(harness.calls.creates.length, 1);
  assert.equal(harness.calls.creates[0].asset_tag, "TAG-42");
  assert.equal(harness.calls.uploads.length, 1);
});

test("si la fotografía falla después de crear el equipo no se duplica el artículo", async () => {
  const harness = await readyHarness();
  const blob = makeBlob(110 * 1024);
  harness.setProcess(async () => ({ blob, width: 1600, height: 1200, bytes: blob.size, type: "image/webp" }));
  harness.calls.failUploads = 1;
  harness.selectPhoto(harness.photoInput, photoFile());
  await harness.flush();
  await harness.submit();
  assert.equal(harness.calls.creates.length, 1);
  assert.equal(harness.calls.uploads.length, 1);
  assert.match(harness.message.textContent, /quedó registrado sin fotografía/);
  assert.doesNotMatch(harness.message.textContent, /No se pudo guardar el equipo/);
  assert.equal(harness.elements.name.value, "Micrófono de sala");
  assert.match(harness.list.innerHTML, /data-inventory-add-photo="equipo-1"/);
  assert.match(harness.list.innerHTML, /data-inventory-take-photo="equipo-1"/);
  assert.match(harness.list.innerHTML, /capture="environment"/);
  assert.doesNotMatch(harness.list.innerHTML, /data-inventory-edit/);
  assert.doesNotMatch(harness.list.innerHTML, /data-inventory-archive/);
  const replacement = makeBlob(95 * 1024);
  harness.setProcess(async () => ({ blob: replacement, width: 1400, height: 1000, bytes: replacement.size, type: "image/webp" }));
  harness.selectPhoto(harness.photoInput, photoFile({ name: "reintento.jpg" }));
  await harness.flush();
  await harness.submit();
  assert.equal(harness.calls.creates.length, 1);
  assert.equal(harness.calls.updates.length, 0);
  assert.equal(harness.calls.uploads.length, 2);
  assert.equal(harness.calls.uploads[1].id, "equipo-1");
  assert.equal(harness.calls.uploads[1].blob, replacement);
  assert.match(harness.message.textContent, /Equipo registrado correctamente/);
});

test("la recuperación usa Galería o Cámara del equipo existente y no crea otro", async () => {
  for (const mode of ["gallery", "camera"]) {
    const harness = await readyHarness();
    harness.elements.name.value = mode === "gallery" ? "Equipo galería" : "Equipo cámara";
    harness.calls.failUploads = 1;
    harness.setProcess(async () => ({ blob: makeBlob(100 * 1024), width: 1600, height: 900, bytes: 100 * 1024, type: "image/webp" }));
    harness.selectPhoto(harness.photoInput, photoFile());
    await harness.flush();
    await harness.submit();
    assert.equal(harness.calls.creates.length, 1);
    const input = new harness.sandbox.HTMLInputElement();
    const file = photoFile({ name: mode === "gallery" ? "galeria.jpg" : "camara.jpg" });
    input.files = [file];
    if (mode === "gallery") input.dataset.inventoryAddPhoto = "equipo-1";
    else input.dataset.inventoryTakePhoto = "equipo-1";
    const recovered = makeBlob(88 * 1024);
    harness.setProcess(async () => ({ blob: recovered, width: 1024, height: 768, bytes: recovered.size, type: "image/webp" }));
    await harness.list.listeners.change[0]({ target: input });
    await harness.flush();
    assert.equal(harness.calls.creates.length, 1);
    assert.equal(harness.calls.uploads.at(-1).blob, recovered);
    assert.match(harness.listMessage.textContent, /Fotografía del equipo añadida correctamente/);
  }
});

test("Marketing puede crear y adjuntar, pero el formulario no le ofrece administrar", async () => {
  const harness = await readyHarness();
  assert.equal(harness.permissions.has("inventory.manage"), false);
  assert.equal(harness.sandbox.hasPermission("inventory.create"), true);
  assert.equal(harness.sandbox.hasPermission("inventory.photo.attach"), true);
  await harness.submit();
  assert.equal(harness.calls.creates.length, 1);
  assert.equal(harness.calls.updates.length, 0);
  assert.equal(harness.calls.uploads.length, 0);
  assert.doesNotMatch(harness.list.innerHTML, /data-inventory-edit/);
  assert.doesNotMatch(harness.list.innerHTML, /data-inventory-archive/);
  assert.match(harness.list.innerHTML, /data-inventory-add-photo="equipo-1"/);
  assert.match(harness.list.innerHTML, /data-inventory-take-photo="equipo-1"/);
  const input = new harness.sandbox.HTMLInputElement();
  input.dataset.inventoryAddPhoto = "equipo-1";
  input.files = [photoFile({ name: "marketing.jpg", size: 900 * 1024 })];
  harness.setProcess(async () => ({ blob: makeBlob(64 * 1024), width: 800, height: 600, bytes: 64 * 1024, type: "image/webp" }));
  await harness.list.listeners.change[0]({ target: input });
  await harness.flush();
  assert.equal(harness.calls.creates.length, 1);
  assert.equal(harness.calls.uploads.length, 1);
  assert.match(harness.listMessage.textContent, /Fotografía del equipo añadida correctamente/);
});

test("no hay doble envío mientras la fotografía se procesa o el equipo se guarda", async () => {
  const harness = await readyHarness();
  let releaseProcess;
  harness.setProcess(() => new Promise((resolve) => {
    releaseProcess = () => resolve({ blob: makeBlob(50 * 1024), width: 800, height: 600, bytes: 50 * 1024, type: "image/webp" });
  }));
  harness.selectPhoto(harness.photoInput, photoFile());
  assert.equal(harness.submitButton.disabled, true);
  const firstSubmit = harness.submit();
  const secondSubmit = harness.submit();
  await harness.flush();
  assert.equal(harness.calls.creates.length, 0);
  releaseProcess();
  await firstSubmit;
  await secondSubmit;
  assert.equal(harness.calls.creates.length, 1);
  assert.equal(harness.calls.uploads.length, 1);

  const saving = await readyHarness();
  let releaseCreate;
  saving.sandbox.createSupabaseInventoryItem = (payload) => new Promise((resolve) => {
    releaseCreate = () => {
      saving.calls.creates.push(payload);
      resolve({
        id: "equipo-unico",
        museum_id: "museo-1",
        version: 1,
        photo_path: null,
        name: payload.name,
        record_type: "individual",
        quantity: 1,
        asset_tag: payload.asset_tag,
        category: payload.category,
        location: payload.location,
        status: payload.status,
        condition: "por_verificar",
        archived_at: null,
        updated_at: "2026-10-12T12:00:00Z"
      });
    };
  });
  const saveOne = saving.submit();
  const saveTwo = saving.submit();
  await saving.flush();
  assert.equal(typeof releaseCreate, "function");
  releaseCreate();
  await saveOne;
  await saveTwo;
  assert.equal(saving.calls.creates.length, 1);
});

test("una alta confirmada en el servidor con respuesta perdida no se duplica", async () => {
  const harness = await readyHarness();
  harness.elements.name.value = "Monitor de escenario";
  harness.elements.asset_tag.value = "SELLO-PERDIDO";
  let rejectCreate;
  harness.sandbox.createSupabaseInventoryItem = (payload) => {
    harness.calls.creates.push(payload);
    harness.setItems([{
      id: "equipo-perdido",
      museum_id: "museo-1",
      version: 1,
      photo_path: null,
      archived_at: null,
      updated_at: "2026-10-12T12:00:00Z",
      condition: "por_verificar",
      record_type: payload.record_type,
      quantity: payload.quantity,
      name: payload.name,
      asset_tag: payload.asset_tag,
      category: payload.category,
      location: payload.location,
      status: payload.status,
      brand: "",
      model: "",
      serial_number: "",
      responsible: "",
      description: ""
    }]);
    return new Promise((resolve, reject) => {
      rejectCreate = () => reject(new TypeError("Failed to fetch"));
    });
  };
  const firstSubmit = harness.submit();
  const secondSubmit = harness.submit();
  await harness.flush();
  assert.equal(harness.calls.creates.length, 1);
  rejectCreate();
  await firstSubmit;
  await secondSubmit;
  assert.equal(harness.calls.creates.length, 1);
  assert.equal(harness.calls.updates.length, 0);
  assert.equal(harness.elements.name.value, "Monitor de escenario");
  assert.equal(harness.elements.asset_tag.value, "SELLO-PERDIDO");
  assert.match(harness.message.textContent, /SELLO-PERDIDO/);
  assert.match(harness.message.textContent, /listado/);
  assert.match(harness.message.textContent, /Galería o Cámara/);
  assert.match(harness.message.textContent, /no se creará un duplicado/);
  assert.doesNotMatch(harness.message.textContent, /No se pudo guardar el equipo/);
  assert.match(harness.list.innerHTML, /data-inventory-add-photo="equipo-perdido"/);
  assert.match(harness.list.innerHTML, /data-inventory-take-photo="equipo-perdido"/);
  await harness.submit();
  assert.equal(harness.calls.creates.length, 1);
  harness.sandbox.document.querySelector("[data-inventory-add]").listeners.click.forEach((fn) => fn({}));
  harness.sandbox.document.querySelector("[data-inventory-cancel]").listeners.click.forEach((fn) => fn({}));
  assert.equal(harness.elements.name.value, "Monitor de escenario");
  assert.equal(harness.elements.asset_tag.value, "SELLO-PERDIDO");
  assert.match(harness.message.textContent, /SELLO-PERDIDO/);
  await harness.submit();
  assert.equal(harness.calls.creates.length, 1);
  const input = new harness.sandbox.HTMLInputElement();
  input.dataset.inventoryTakePhoto = "equipo-perdido";
  input.files = [photoFile({ name: "camara-recuperada.jpg", size: 800 * 1024 })];
  const recovered = makeBlob(72 * 1024);
  harness.setProcess(async () => ({ blob: recovered, width: 1200, height: 900, bytes: recovered.size, type: "image/webp" }));
  await harness.list.listeners.change[0]({ target: input });
  await harness.flush();
  assert.equal(harness.calls.creates.length, 1);
  assert.equal(harness.calls.uploads.length, 1);
  assert.equal(harness.calls.uploads[0].id, "equipo-perdido");
  assert.equal(harness.calls.uploads[0].blob, recovered);
  assert.match(harness.listMessage.textContent, /Fotografía del equipo añadida correctamente/);
});

test("un rechazo confirmado del servidor no se confunde con una respuesta perdida", async () => {
  const harness = await readyHarness();
  harness.sandbox.createSupabaseInventoryItem = async (payload) => {
    harness.calls.creates.push(payload);
    throw new Error("El número de sello o la serie ya existe en este museo.");
  };
  await harness.submit();
  assert.match(harness.message.textContent, /ya existe en este museo/);
  assert.doesNotMatch(harness.message.textContent, /No se pudo confirmar/);
  harness.sandbox.createSupabaseInventoryItem = async (payload) => {
    harness.calls.creates.push(payload);
    return {
      id: "equipo-reintento",
      museum_id: "museo-1",
      version: 1,
      photo_path: null,
      name: payload.name,
      asset_tag: payload.asset_tag,
      record_type: "individual",
      quantity: 1,
      category: payload.category,
      location: payload.location,
      status: payload.status,
      condition: "por_verificar",
      archived_at: null,
      updated_at: "2026-10-12T12:00:00Z"
    };
  };
  await harness.submit();
  assert.equal(harness.calls.creates.length, 2);
  assert.match(harness.message.textContent, /Equipo registrado correctamente/);
});

test("una respuesta de alta sin identificador no dispara otro inventory_create", async () => {
  const harness = await readyHarness();
  harness.sandbox.createSupabaseInventoryItem = async (payload) => {
    harness.calls.creates.push(payload);
    return { name: payload.name };
  };
  await harness.submit();
  assert.equal(harness.calls.creates.length, 1);
  assert.match(harness.message.textContent, /no incluye el identificador/);
  await harness.submit();
  assert.equal(harness.calls.creates.length, 1);
  assert.match(harness.message.textContent, /no se creará un duplicado/);
});
