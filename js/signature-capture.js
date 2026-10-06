/* Reusable signature surface. Forms mount this component; they do not create their own canvases.
   Wacom STU-540 is the institutional pad. The official browser path is Wacom's Signature SDK
   (StuCaptDialog over WebHID, after Module.SigObj and setLicence). That SDK needs an
   enterprise license. SigCaptX needs a local Windows service and driver. Neither is bundled,
   and this file does not invent a HID protocol. If the official objects are absent, or no
   license is configured, PointerCanvasAdapter is used. A pad failure must not block the form.
   The contractual record does not depend on which adapter produced the strokes. */

class WacomSTUAdapter {
  constructor() {
    this.model = 'STU-540';
    this.connected = false;
    this.reason = 'sdk-license';
  }
  officialApi() {
    const sdk = globalThis.Module;
    return typeof globalThis.StuCaptDialog === 'function' && !!sdk && typeof sdk.SigObj === 'function';
  }
  isAvailable() {
    return this.connected === true && this.officialApi();
  }
  async detect() {
    this.connected = false;
    this.reason = this.officialApi() ? 'license-not-configured' : 'sdk-license';
    return false;
  }
  async connect() {
    throw new Error('Pad no disponible — firma en pantalla habilitada');
  }
  clear() {}
  snapshot() {
    return null;
  }
  statusText() {
    return this.isAvailable() ? 'Pad de firma conectado' : 'Pad no disponible — firma en pantalla habilitada';
  }
}

class PointerCanvasAdapter {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.strokes = [];
    this.active = null;
    this.lastPointerType = '';
    this.canvas.width = 640;
    this.canvas.height = 180;
    this.context.lineWidth = 2;
    this.context.lineCap = 'round';
    this.context.strokeStyle = '#142033';
    canvas.addEventListener('pointerdown', event => this.start(event));
    canvas.addEventListener('pointermove', event => this.move(event));
    canvas.addEventListener('pointerup', event => this.end(event));
    canvas.addEventListener('pointercancel', event => this.end(event));
  }
  isAvailable() {
    return true;
  }
  point(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: Math.round((event.clientX - rect.left) * scaleX),
      y: Math.round((event.clientY - rect.top) * scaleY),
      pressure: event.pressure || 0
    };
  }
  start(event) {
    this.canvas.setPointerCapture(event.pointerId);
    this.lastPointerType = event.pointerType || 'mouse';
    this.active = { pointerType: this.lastPointerType, points: [this.point(event)] };
    this.strokes.push(this.active);
  }
  move(event) {
    if (!this.active) return;
    const next = this.point(event);
    const previous = this.active.points[this.active.points.length - 1];
    this.active.points.push(next);
    this.context.beginPath();
    this.context.moveTo(previous.x, previous.y);
    this.context.lineTo(next.x, next.y);
    this.context.stroke();
  }
  end() {
    this.active = null;
  }
  clear() {
    this.strokes = [];
    this.active = null;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  captureMethod() {
    if (this.lastPointerType === 'touch') return 'touch';
    if (this.lastPointerType === 'pen') return 'stylus';
    if (this.lastPointerType === 'mouse') return 'mouse';
    return 'pointer';
  }
  snapshot() {
    const pointCount = this.strokes.reduce((total, stroke) => total + stroke.points.length, 0);
    return {
      representation: 'strokes',
      strokes: this.strokes,
      raster: pointCount ? { format: 'image/png', dataUrl: this.canvas.toDataURL('image/png') } : null,
      integrity: {
        adapter: 'PointerCanvasAdapter',
        strokeCount: this.strokes.length,
        pointCount,
        canvasWidth: this.canvas.width,
        canvasHeight: this.canvas.height
      }
    };
  }
}

class SignatureCapture {
  constructor(root, options = {}) {
    this.root = root;
    this.signerName = options.signerName || '';
    this.signerRole = options.signerRole || root?.dataset?.signerRole || '';
    this.accessionId = options.accessionId || null;
    this.status = 'pendiente';
    this.wacom = new WacomSTUAdapter();
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'signature-pad';
    this.canvas.setAttribute('aria-label', 'Superficie de firma');
    this.pointer = new PointerCanvasAdapter(this.canvas);
    this.adapter = this.pointer;
    this.mount();
  }
  mount() {
    if (!this.root) return;
    this.root.replaceChildren();
    const note = document.createElement('p');
    note.textContent = 'La misma superficie sirve para el pad de firma, la pantalla táctil, el lápiz o el ratón.';
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'button secondary';
    clear.textContent = 'Limpiar trazo';
    clear.addEventListener('click', () => this.pointer.clear());
    this.root.append(note, this.canvas, clear);
    const status = document.querySelector('[data-pad-status]');
    this.wacom.detect().then(() => {
      if (this.wacom.isAvailable()) this.adapter = this.wacom;
      if (status) status.textContent = this.wacom.statusText();
    });
  }
  setSigner(name, role) {
    this.signerName = name || '';
    if (role) this.signerRole = role;
  }
  setAccession(accessionId) {
    this.accessionId = accessionId || null;
  }
  snapshot() {
    const visual = this.adapter === this.wacom && this.wacom.isAvailable() ? this.wacom.snapshot() : this.pointer.snapshot();
    return {
      signer_name: this.signerName,
      signer_role: this.signerRole,
      accession_id: this.accessionId,
      signed_at: new Date().toISOString(),
      capture_method: this.adapter === this.wacom && this.wacom.isAvailable() ? 'wacom-stu-540' : this.pointer.captureMethod(),
      visual,
      integrity: visual?.integrity || { adapter: 'WacomSTUAdapter', model: this.wacom.model },
      status: this.status,
      persisted: false
    };
  }
  async persist(save) {
    const record = this.snapshot();
    if ((record.visual?.integrity?.pointCount || 0) < 1) throw new Error('La firma está vacía.');
    if (typeof save !== 'function') {
      return { saved: false, reason: 'La firma contractual se registrará cuando el formulario la envíe.' };
    }
    const saved = await save(record);
    this.status = 'capturada';
    return saved;
  }
}
