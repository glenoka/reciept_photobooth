/**
 * VIZRECEIPT // 80MM KINETIC THERMAL PHOTOBOOTH
 * Pure Vanilla JavaScript implementation
 * 80mm Roll Only (576px) • 1 Foto, 2 Foto, 4 Foto (2x2) • Unified Settings & IP Printer
 */

// =============================================================================
// 1. DEFAULT DATA & STATE (80MM ROLL ONLY)
// =============================================================================

// Purge any stale localStorage containing old conflicting template overlays
try {
  const rawTpl = localStorage.getItem("viz_templates_80mm");
  if (rawTpl && (rawTpl.includes("DUAL MOMENTS") || rawTpl.includes("2-STRIP") || rawTpl.includes("4-GRID"))) {
    localStorage.removeItem("viz_templates_80mm");
  }
} catch (_) {}

const DEFAULT_TEMPLATES = [
  {
    id: "tpl-1photo",
    name: "1 Foto (Single Large)",
    paperSize: "80mm",
    width: 576,
    height: 860,
    slots: [
      { x: 38, y: 160, width: 500, height: 480, radius: 0 }
    ],
    textOverlays: [],
    frameImage: null
  },
  {
    id: "tpl-2photo",
    name: "2 Foto (2-Strip Vertikal)",
    paperSize: "80mm",
    width: 576,
    height: 1120,
    slots: [
      { x: 38, y: 160, width: 500, height: 360, radius: 0 },
      { x: 38, y: 540, width: 500, height: 360, radius: 0 }
    ],
    textOverlays: [],
    frameImage: null
  },
  {
    id: "tpl-4grid",
    name: "4 Foto (Grid 2 Baris × 2 Kolom)",
    paperSize: "80mm",
    width: 576,
    height: 1020,
    slots: [
      { x: 38, y: 160, width: 242, height: 242, radius: 0 },
      { x: 296, y: 160, width: 242, height: 242, radius: 0 },
      { x: 38, y: 420, width: 242, height: 242, radius: 0 },
      { x: 296, y: 420, width: 242, height: 242, radius: 0 }
    ],
    textOverlays: [],
    frameImage: null
  }
];

const BUILTIN_EFFECT_PRESETS = [
  {
    id: "preset-classic",
    name: "Classic Thermal",
    mode: "floyd-steinberg",
    threshold: 50,
    brightness: 50,
    contrast: 50,
    invert: false,
    desc: "Seimbang, alami, dan standar 80mm"
  },
  {
    id: "preset-noir",
    name: "Noir / High Contrast",
    mode: "floyd-steinberg",
    threshold: 53,
    brightness: 46,
    contrast: 68,
    invert: false,
    desc: "Hitam pekat tegas, bayangan tajam"
  },
  {
    id: "preset-vintage",
    name: "Soft Vintage",
    mode: "floyd-steinberg",
    threshold: 47,
    brightness: 56,
    contrast: 45,
    invert: false,
    desc: "Terang lembut, detail wajah halus"
  },
  {
    id: "preset-retro-dot",
    name: "Retro Dot (Bayer)",
    mode: "ordered",
    threshold: 50,
    brightness: 52,
    contrast: 58,
    invert: false,
    desc: "Titik-titik pola cetak koran jadul"
  },
  {
    id: "preset-studio",
    name: "Studio Bright",
    mode: "floyd-steinberg",
    threshold: 45,
    brightness: 58,
    contrast: 63,
    invert: false,
    desc: "Highlight bersih, kulit cerah bersinar"
  },
  {
    id: "preset-dark-film",
    name: "Dark Film",
    mode: "floyd-steinberg",
    threshold: 55,
    brightness: 44,
    contrast: 60,
    invert: false,
    desc: "Moody, artistik & dramatis"
  },
  {
    id: "preset-negative",
    name: "Negative / Klise",
    mode: "floyd-steinberg",
    threshold: 50,
    brightness: 50,
    contrast: 55,
    invert: true,
    desc: "Efek klise foto negatif film"
  }
];

const DEFAULT_RECEIPT_SETTINGS = {
  header: "KOMANEKA RECEIPT MEMORIES",
  subheader: "Thermal Photo Memories • 80mm Strip",
  eventDetails: "Wedding Celebration • Makassar",
  dateFormat: "datetime",
  orderPrefix: "ORDER #",
  footer: "THANK YOU ~ HAVE A NICE DAY!\nKomaneka Receipt Memories • 80mm Thermal",
  social: "Instagram: @komanekareceipt • TikTok: @komanekareceipt",
  qrUrl: "https://receipt.vizrize.com/gallery",
  showQr: true
};

const DEFAULT_PRINTER_SETTINGS = {
  connection: "driver", // "driver" or "network"
  printerName: "EPSON TM-T82II Receipt",
  printerIp: "192.168.71.10",
  printerPort: 9100,
  paperSize: "80mm",
  feedLines: 3,
  autoCut: true,
  ditherMode: "floyd-steinberg",
  threshold: 50,
  brightness: 50,
  contrast: 50,
  invert: false,
  copies: 1
};

// Storage helper with automatic migration to 80mm-only
function loadTemplatesFromStorage() {
  const cached = loadFromStorage("viz_templates_80mm", null);
  if (cached && Array.isArray(cached) && cached.length > 0 && cached[0].width === 576) {
    // Filter out legacy conflicting dummy header overlays
    return cached.map(tpl => {
      if (tpl.textOverlays && Array.isArray(tpl.textOverlays)) {
        tpl.textOverlays = tpl.textOverlays.filter(ov => {
          const t = (ov.text || "").toUpperCase().trim();
          return !["DUAL MOMENTS", "KOMANEKA RECEIPT 2-STRIP", "SINGLE PORTRAIT EDITION", "KOMANEKA RECEIPT 4-GRID", "2 BARIS × 2 KOLOM"].includes(t);
        });
      }
      return tpl;
    });
  }
  return DEFAULT_TEMPLATES;
}

// Global Application State
const state = {
  currentScreen: "landing",
  templates: loadTemplatesFromStorage(),
  selectedTemplateId: loadFromStorage("viz_selected_tpl_80mm", "tpl-2photo"),
  receiptSettings: loadFromStorage("viz_receipt_settings", DEFAULT_RECEIPT_SETTINGS),
  printerSettings: loadFromStorage("viz_printer_settings_80mm", DEFAULT_PRINTER_SETTINGS),
  customEffects: loadFromStorage("viz_custom_effects", []),
  activeEffectPresetId: "preset-classic",
  activeTemplate: null,
  capturedShots: [],
  currentShotIndex: 0,
  timerSeconds: 3,
  isCapturing: false,
  stream: null,
  autoResetInterval: null,
  serialPort: null,
  marqueePaused: false
};

state.activeTemplate = state.templates.find(t => t.id === state.selectedTemplateId) || state.templates[0];

// =============================================================================
// 2. AUDIO SYNTHESIS (Web Audio API)
// =============================================================================
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playBeep(freq = 880, duration = 0.12) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio unhandled
  }
}

function playShutterSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    whiteNoise.start();
  } catch (e) {
    // Audio unhandled
  }
}

// =============================================================================
// 3. STORAGE HELPERS
// =============================================================================
function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveToStorage(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error("Storage save failed:", e);
  }
}

// =============================================================================
// 4. NAVIGATION
// =============================================================================
function navigateTo(screenId) {
  clearInterval(state.autoResetInterval);
  state.currentScreen = screenId;

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.target === screenId);
  });

  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(`screen-${screenId}`);
  if (target) target.classList.add("active");

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (screenId === "landing") {
    renderLandingTemplatesGrid();
    stopCamera();
  } else if (screenId === "capture") {
    initCaptureSession();
  } else if (screenId === "preview") {
    stopCamera();
    syncDitherControls();
    renderPresetChips();
    updatePreviewPrinterInfo();
    renderThermalReceipt();
  } else if (screenId === "settings") {
    stopCamera();
    syncSettingsInputs();
    renderSavedCustomFxList();
  } else if (screenId === "templates") {
    stopCamera();
    renderTemplateList();
    renderTemplateWorkspace();
  }
}

// =============================================================================
// 5. LANDING SCREEN (1 FOTO, 2 FOTO, 4 FOTO 2x2)
// =============================================================================
function renderLandingTemplatesGrid() {
  const container = document.getElementById("landingTemplatesGrid");
  if (!container) return;
  container.innerHTML = "";

  state.templates.forEach((tpl, idx) => {
    const box = document.createElement("div");
    box.className = `template-box-kinetic ${tpl.id === state.selectedTemplateId ? "active" : ""}`;
    const num = (idx + 1).toString().padStart(2, "0");
    box.innerHTML = `
      <div class="tpl-num">${num} // LAYOUT 80MM</div>
      <div class="tpl-name">${escapeHtml(tpl.name)}</div>
      <div class="tpl-specs">${tpl.slots.length} FOTO • ROLL 80MM (576PX)</div>
    `;

    box.onclick = () => {
      state.selectedTemplateId = tpl.id;
      state.activeTemplate = tpl;
      saveToStorage("viz_selected_tpl_80mm", tpl.id);
      renderLandingTemplatesGrid();
    };

    container.appendChild(box);
  });
}

// =============================================================================
// 6. CAMERA & CAPTURE ENGINE
// =============================================================================
async function startCamera() {
  const video = document.getElementById("cameraVideo");
  const cameraSelect = document.getElementById("cameraSelect");
  if (!video) return;

  const isSecure = window.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const alertBox = document.getElementById("httpsAlertBox");
  if (!isSecure && alertBox) {
    alertBox.style.display = "flex";
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (alertBox) alertBox.style.display = "flex";
    alert("Browser di HP memblokir kamera jika dibuka lewat HTTP biasa.\nBuka via HTTPS (https://<IP_KOMPUTER>:8443) dengan menjalankan start_https.bat!");
    return;
  }

  try {
    if (state.stream) stopCamera();

    const deviceId = cameraSelect && cameraSelect.value ? { exact: cameraSelect.value } : undefined;
    const constraints = {
      video: {
        deviceId: deviceId,
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    state.stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = state.stream;
    await video.play();

    if (cameraSelect && cameraSelect.options.length <= 1) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === "videoinput");
      cameraSelect.innerHTML = "";
      videoDevices.forEach((dev, idx) => {
        const opt = document.createElement("option");
        opt.value = dev.deviceId;
        opt.textContent = dev.label || `Kamera ${idx + 1}`;
        cameraSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.warn("Camera init error:", err);
    alert("Tidak dapat mengakses kamera: " + err.message + "\nPastikan izin akses kamera aktif di browser.");
  }
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
  }
}

function initCaptureSession() {
  state.activeTemplate = state.templates.find(t => t.id === state.selectedTemplateId) || state.templates[0];
  state.capturedShots = [];
  state.currentShotIndex = 0;
  state.isCapturing = false;

  updateHUD();
  updateThumbnails();
  startCamera();
}

function updateHUD() {
  const progressChip = document.getElementById("photoProgressChip");
  const hudTimer = document.getElementById("hudTimer");
  const totalSlots = state.activeTemplate ? state.activeTemplate.slots.length : 2;

  if (progressChip) {
    progressChip.textContent = `FOTO ${state.currentShotIndex + 1} / ${totalSlots}`;
  }
  if (hudTimer) {
    hudTimer.textContent = `${state.timerSeconds}S TIMER`;
  }
  const btnUploadText = document.getElementById("btnUploadInCaptureText");
  if (btnUploadText) {
    btnUploadText.textContent = `＋ UPLOAD ${totalSlots} FOTO`;
  }
}
function updateThumbnails() {
  const container = document.getElementById("shotThumbnails");
  if (!container) return;
  container.innerHTML = "";

  state.capturedShots.forEach((shot, idx) => {
    const img = document.createElement("img");
    img.src = shot;
    img.className = "shot-thumb";
    img.title = `Foto ${idx + 1}`;
    container.appendChild(img);
  });
}

function triggerCountdownCapture() {
  if (state.isCapturing) return;
  state.isCapturing = true;

  const overlay = document.getElementById("countdownOverlay");
  const numberDisplay = document.getElementById("countdownNumber");
  let remaining = state.timerSeconds;

  if (overlay) overlay.style.display = "flex";
  if (numberDisplay) numberDisplay.textContent = remaining;
  playBeep(660, 0.1);

  const timerInterval = setInterval(() => {
    remaining--;
    if (remaining > 0) {
      if (numberDisplay) numberDisplay.textContent = remaining;
      playBeep(660, 0.1);
    } else {
      clearInterval(timerInterval);
      if (overlay) overlay.style.display = "none";
      playBeep(1200, 0.2);
      captureSingleShot();
    }
  }, 1000);
}

function captureSingleShot() {
  const video = document.getElementById("cameraVideo");
  const canvas = document.getElementById("captureCanvas");
  const flash = document.getElementById("shutterFlash");
  if (!video || !canvas) return;

  if (flash) {
    flash.classList.add("flash-active");
    setTimeout(() => flash.classList.remove("flash-active"), 120);
  }
  playShutterSound();

  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  canvas.width = vw;
  canvas.height = vh;
  const ctx = canvas.getContext("2d");

  // Mirror horizontally
  ctx.save();
  ctx.translate(vw, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, vw, vh);
  ctx.restore();

  const shotData = canvas.toDataURL("image/jpeg", 0.92);
  state.capturedShots.push(shotData);
  state.currentShotIndex++;

  updateThumbnails();

  const totalSlots = state.activeTemplate ? state.activeTemplate.slots.length : 2;

  if (state.currentShotIndex < totalSlots) {
    updateHUD();
    state.isCapturing = false;
    setTimeout(() => {
      triggerCountdownCapture();
    }, 1400);
  } else {
    state.isCapturing = false;
    setTimeout(() => {
      stopCamera();
      navigateTo("preview");
    }, 600);
  }
}

function handlePhotoUpload(files) {
  if (!files || files.length === 0) return;
  const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
  if (imageFiles.length === 0) {
    alert("Silakan pilih file gambar yang valid (JPG, PNG, WEBP).");
    return;
  }

  state.activeTemplate = state.templates.find(t => t.id === state.selectedTemplateId) || state.templates[0];
  const totalSlots = state.activeTemplate ? state.activeTemplate.slots.length : 2;

  if (imageFiles.length !== totalSlots) {
    alert(`Template yang dipilih membutuhkan tepat ${totalSlots} foto.\nSilakan pilih ${totalSlots} foto sekaligus dari galeri/folder Anda (saat ini Anda memilih ${imageFiles.length} foto).`);
    return;
  }

  const readers = imageFiles.map(file => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  });

  Promise.all(readers).then(dataUrls => {
    state.capturedShots = dataUrls.slice(0, totalSlots);
    state.currentShotIndex = state.capturedShots.length;
    stopCamera();
    navigateTo("preview");
  });
}

// =============================================================================
// 7. THERMAL RECEIPT RENDERING & DITHERING (80MM ONLY)
// =============================================================================
async function renderThermalReceipt() {
  const canvas = document.getElementById("receiptCanvas");
  if (!canvas) return;

  const tpl = state.activeTemplate;
  const canvasWidth = 576; // Strictly 80mm roll width
  const contentHeight = tpl ? tpl.height : 1060;

  canvas.width = canvasWidth;
  canvas.height = contentHeight;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 1. Draw Receipt Header
  renderReceiptHeader(ctx, canvasWidth);

  // 2. Draw Photos into Template Slots
  await renderPhotoSlots(ctx, tpl, canvasWidth);

  // 3. Draw Template Frame Overlay (if uploaded)
  if (tpl && tpl.frameImage) {
    await drawImagePromise(ctx, tpl.frameImage, 0, 0, canvas.width, canvas.height);
  }

  // 4. Draw Custom Text Overlays
  // 4. Draw Custom Text Overlays (exclude legacy template dummy header overlays)
  if (tpl && tpl.textOverlays && Array.isArray(tpl.textOverlays)) {
    tpl.textOverlays.forEach(ov => {
      const txt = (ov.text || "").toUpperCase().trim();
      if (["DUAL MOMENTS", "KOMANEKA RECEIPT 2-STRIP", "SINGLE PORTRAIT EDITION", "KOMANEKA RECEIPT 4-GRID", "2 BARIS × 2 KOLOM"].includes(txt)) {
        return;
      }
      ctx.fillStyle = "#000000";
      ctx.font = `${ov.bold ? "bold " : ""}${ov.fontSize}px "Host Grotesk", monospace`;
      ctx.textAlign = ov.align || "center";
      ctx.fillText(ov.text, ov.x, ov.y);
    });
  }

  // 5. Draw Receipt Footer & QR Code
  await renderReceiptFooter(ctx, canvasWidth, contentHeight - 180);

  // 6. Apply Dithering Algorithm
  applyDitheringFilter(ctx, canvas.width, canvas.height);

  // Update print image for browser print
  const printImg = document.getElementById("printImage");
  if (printImg) {
    printImg.src = canvas.toDataURL("image/png");
  }
}

function getMakassarDateString(format = "datetime") {
  const now = new Date();
  if (format === "datetime") {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(now);
    return `${parts.replace(",", "")} WITA`;
  }
  if (format === "date-only") {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Makassar",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(now);
  }
  return "";
}

function renderReceiptHeader(ctx, width) {
  const rs = state.receiptSettings;
  let curY = 38;

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";

  // 1. Judul Header
  if (rs.header) {
    ctx.font = "bold 22px monospace";
    ctx.fillText(rs.header, width / 2, curY);
    curY += 26;
  }

  // 2. Tagline / Subheader
  if (rs.subheader) {
    ctx.font = "14px monospace";
    ctx.fillText(rs.subheader, width / 2, curY);
    curY += 22;
  }

  // 3. Detail Acara (Event Details)
  if (rs.eventDetails) {
    ctx.font = "13px monospace";
    ctx.fillText(rs.eventDetails, width / 2, curY);
    curY += 22;
  }

  // 4. Tanggal / Jam Server GMT+8 Asia/Makassar
  if (rs.dateFormat !== "none") {
    const dateStr = getMakassarDateString(rs.dateFormat || "datetime");
    const orderNum = Math.floor(1000 + Math.random() * 9000);
    ctx.font = "12px monospace";
    ctx.fillText(`${rs.orderPrefix || "ORDER #"}${orderNum}  •  ${dateStr}`, width / 2, curY);
    curY += 20;
  }

  // 5. Garis Pembatas Putus-putus
  drawDashedLine(ctx, 24, curY, width - 24, curY);
}

async function renderPhotoSlots(ctx, tpl, canvasWidth) {
  if (!tpl || !tpl.slots) return;

  const slots = tpl.slots;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const shotData = state.capturedShots[i];

    if (shotData) {
      await drawPhotoInSlot(ctx, shotData, slot);
    } else {
      ctx.fillStyle = "#eeeeee";
      ctx.fillRect(slot.x, slot.y, slot.width, slot.height);
      ctx.strokeStyle = "#aaaaaa";
      ctx.strokeRect(slot.x, slot.y, slot.width, slot.height);
      ctx.fillStyle = "#555555";
      ctx.font = "16px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`FOTO ${i + 1}`, slot.x + slot.width / 2, slot.y + slot.height / 2);
    }
  }
}

async function drawPhotoInSlot(ctx, dataUrl, slot) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.save();
      const imgRatio = img.width / img.height;
      const slotRatio = slot.width / slot.height;
      let drawW, drawH, drawX, drawY;

      if (imgRatio > slotRatio) {
        drawH = slot.height;
        drawW = img.width * (slot.height / img.height);
        drawX = slot.x + (slot.width - drawW) / 2;
        drawY = slot.y;
      } else {
        drawW = slot.width;
        drawH = img.height * (slot.width / img.width);
        drawX = slot.x;
        drawY = slot.y + (slot.height - drawH) / 2;
      }

      ctx.beginPath();
      ctx.rect(slot.x, slot.y, slot.width, slot.height);
      ctx.clip();
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.strokeRect(slot.x, slot.y, slot.width, slot.height);
      resolve();
    };
    img.src = dataUrl;
  });
}

async function renderReceiptFooter(ctx, width, startY) {
  const rs = state.receiptSettings;
  let curY = startY;

  drawDashedLine(ctx, 20, curY, width - 20, curY);
  curY += 22;

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";

  if (rs.footer) {
    const lines = rs.footer.split("\n");
    ctx.font = "13px monospace";
    lines.forEach(line => {
      ctx.fillText(line, width / 2, curY);
      curY += 18;
    });
  }

  if (rs.social) {
    ctx.font = "12px monospace";
    ctx.fillText(rs.social, width / 2, curY);
    curY += 20;
  }

  if (rs.showQr && rs.qrUrl && typeof QRCode !== "undefined") {
    curY += 4;
    const qrSize = 120;
    const tempDiv = document.createElement("div");
    tempDiv.style.display = "none";
    document.body.appendChild(tempDiv);

    new QRCode(tempDiv, {
      text: rs.qrUrl,
      width: qrSize,
      height: qrSize,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });

    await new Promise(r => setTimeout(r, 60));
    const qrImg = tempDiv.querySelector("img") || tempDiv.querySelector("canvas");
    if (qrImg) {
      ctx.drawImage(qrImg, (width - qrSize) / 2, curY, qrSize, qrSize);
      curY += qrSize + 14;
      ctx.font = "11px monospace";
      ctx.fillText("SCAN UNTUK SOFTCOPY DIGITAL", width / 2, curY);
      curY += 16;
    }
    document.body.removeChild(tempDiv);
  }

  curY += 10;
  drawDashedLine(ctx, 15, curY, width - 15, curY);
}

function drawDashedLine(ctx, x1, y1, x2, y2) {
  ctx.save();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawImagePromise(ctx, src, x, y, w, h) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, x, y, w, h);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = src;
  });
}

function normalizeSlider100(val, defaultVal = 50, isOldThreshold = false) {
  if (val === undefined || val === null || isNaN(val)) return defaultVal;
  const num = Number(val);
  // Auto-migrate legacy 0..255 threshold or -100..100 values to 1..100
  if (isOldThreshold && num > 100) {
    return Math.max(1, Math.min(100, Math.round((num / 255) * 100)));
  }
  if (!isOldThreshold && (num < 0 || (num === 0 && defaultVal === 50))) {
    return Math.max(1, Math.min(100, Math.round(50 + num / 2)));
  }
  return Math.max(1, Math.min(100, num));
}

function applyDitheringFilter(ctx, width, height) {
  const mode = state.printerSettings.ditherMode || "floyd-steinberg";
  const userThreshold = normalizeSlider100(state.printerSettings.threshold, 50, true);
  const userBrightness = normalizeSlider100(state.printerSettings.brightness, 50, false);
  const userContrast = normalizeSlider100(state.printerSettings.contrast, 50, false);
  const invert = state.printerSettings.invert || false;

  // Map 1-100 range to internal pixel maths:
  // 1..100 -> 0..255 threshold (50 maps to 127.5)
  const threshold = (userThreshold / 100) * 255;
  // 1..100 -> -128..+128 brightness (50 maps to 0 neutral)
  const brightness = (userBrightness - 50) * 2.56;
  // 1..100 -> 0.0..2.0 contrast factor (50 maps to 1.0 normal)
  const contrastFactor = userContrast / 50;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const gray = new Float32Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    let lum = 0.299 * r + 0.587 * g + 0.114 * b;
    lum = (lum - 128) * contrastFactor + 128 + brightness;
    lum = Math.max(0, Math.min(255, lum));

    gray[i / 4] = lum;
  }

  if (mode === "grayscale") {
    for (let i = 0; i < gray.length; i++) {
      let val = Math.round(gray[i]);
      if (invert) val = 255 - val;
      const idx = i * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  } else if (mode === "threshold") {
    for (let i = 0; i < gray.length; i++) {
      let val = gray[i] < threshold ? 0 : 255;
      if (invert) val = 255 - val;
      const idx = i * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  } else if (mode === "ordered") {
    const bayer4 = [
      [ 0,  8,  2, 10],
      [12,  4, 14,  6],
      [ 3, 11,  1,  9],
      [15,  7, 13,  5]
    ];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const bayerVal = (bayer4[y % 4][x % 4] / 16) * 64 - 32;
        let val = (gray[i] + bayerVal) < threshold ? 0 : 255;
        if (invert) val = 255 - val;
        const idx = i * 4;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
  } else {
    // Floyd-Steinberg Error Diffusion
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const oldPixel = gray[i];
        const newPixel = oldPixel < threshold ? 0 : 255;
        const error = oldPixel - newPixel;

        let outputVal = newPixel;
        if (invert) outputVal = 255 - outputVal;

        const idx = i * 4;
        data[idx] = outputVal;
        data[idx + 1] = outputVal;
        data[idx + 2] = outputVal;
        data[idx + 3] = 255;

        if (x + 1 < width) gray[i + 1] += error * (7 / 16);
        if (y + 1 < height) {
          if (x > 0) gray[i + width - 1] += error * (3 / 16);
          gray[i + width] += error * (5 / 16);
          if (x + 1 < width) gray[i + width + 1] += error * (1 / 16);
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// =============================================================================
// 8. ESC/POS GENERATOR & 80MM PRINTER DRIVERS (IP & WINDOWS DRIVER)
// =============================================================================
function generateEscPosCommands(canvas) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width; // 576 dots for 80mm
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height).data;

  const bytesPerRow = Math.ceil(width / 8); // 72 bytes
  const buffer = [];

  // ESC @: Inisialisasi printer
  buffer.push(0x1B, 0x40);

  // ESC a 1: Center alignment
  buffer.push(0x1B, 0x61, 0x01);

  // GS v 0: Raster bit image format (GS v 0 m xL xH yL yH d1...dk)
  const xL = bytesPerRow % 256;
  const xH = Math.floor(bytesPerRow / 256);
  const yL = height % 256;
  const yH = Math.floor(height / 256);

  buffer.push(0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH);

  for (let y = 0; y < height; y++) {
    for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
      let byteVal = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = byteIdx * 8 + bit;
        if (x < width) {
          const pixelIdx = (y * width + x) * 4;
          const isBlack = imgData[pixelIdx] < 128;
          if (isBlack) {
            byteVal |= (1 << (7 - bit));
          }
        }
      }
      buffer.push(byteVal);
    }
  }

  // Feed lines (ESC d n)
  const feedLines = state.printerSettings.feedLines || 3;
  buffer.push(0x1B, 0x64, feedLines);

  // GS V 65 0: Auto-cut paper
  if (state.printerSettings.autoCut) {
    buffer.push(0x1D, 0x56, 0x41, 0x00);
  }

  return new Uint8Array(buffer);
}

// Sync dither/effect sliders and controls with state
function syncDitherControls() {
  const ps = state.printerSettings;
  const ditherModeSelect = document.getElementById("ditherModeSelect");
  const ditherThreshold = document.getElementById("ditherThreshold");
  const thresholdValDisplay = document.getElementById("thresholdValDisplay");
  const brightnessInput = document.getElementById("brightnessInput");
  const brightnessValDisplay = document.getElementById("brightnessValDisplay");
  const contrastInput = document.getElementById("contrastInput");
  const contrastValDisplay = document.getElementById("contrastValDisplay");
  const invertCheckbox = document.getElementById("invertColorsCheckbox");

  const thresh100 = normalizeSlider100(ps.threshold, 50, true);
  const bright100 = normalizeSlider100(ps.brightness, 50, false);
  const contrast100 = normalizeSlider100(ps.contrast, 50, false);

  state.printerSettings.threshold = thresh100;
  state.printerSettings.brightness = bright100;
  state.printerSettings.contrast = contrast100;

  if (ditherModeSelect && ps.ditherMode) ditherModeSelect.value = ps.ditherMode;
  if (ditherThreshold) {
    ditherThreshold.value = thresh100;
    if (thresholdValDisplay) thresholdValDisplay.textContent = thresh100;
  }
  if (brightnessInput) {
    brightnessInput.value = bright100;
    if (brightnessValDisplay) brightnessValDisplay.textContent = bright100;
  }
  if (contrastInput) {
    contrastInput.value = contrast100;
    if (contrastValDisplay) contrastValDisplay.textContent = contrast100;
  }
  if (invertCheckbox) invertCheckbox.checked = !!ps.invert;
}

function getAllEffectPresets() {
  return [...BUILTIN_EFFECT_PRESETS, ...(state.customEffects || [])];
}

function renderPresetChips() {
  const container = document.getElementById("previewPresetChips");
  if (!container) return;
  container.innerHTML = "";

  const allPresets = getAllEffectPresets();
  allPresets.forEach(preset => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `preset-chip ${state.activeEffectPresetId === preset.id ? "active" : ""}`;
    chip.innerHTML = `<span>${escapeHtml(preset.name)}</span>`;
    chip.title = preset.desc || `Threshold: ${preset.threshold}, Brightness: ${preset.brightness}, Contrast: ${preset.contrast}`;
    chip.onclick = () => {
      state.activeEffectPresetId = preset.id;
      applyEffectPreset(preset);
    };
    container.appendChild(chip);
  });
}

function applyEffectPreset(preset) {
  if (!preset) return;
  state.printerSettings.ditherMode = preset.mode || "floyd-steinberg";
  state.printerSettings.threshold = preset.threshold !== undefined ? preset.threshold : 128;
  state.printerSettings.brightness = preset.brightness !== undefined ? preset.brightness : 0;
  state.printerSettings.contrast = preset.contrast !== undefined ? preset.contrast : 0;
  state.printerSettings.invert = !!preset.invert;

  syncDitherControls();
  renderThermalReceipt();
  renderPresetChips();
}

function renderSavedCustomFxList() {
  const container = document.getElementById("savedCustomFxList");
  if (!container) return;
  container.innerHTML = "";

  if (!state.customEffects || state.customEffects.length === 0) {
    container.innerHTML = '<div style="color:var(--dp-color-rule); font-size:12px; padding:0.5rem 0;">Belum ada template efek kustom. Gunakan form di sebelah kiri untuk membuat template efek baru.</div>';
    return;
  }

  state.customEffects.forEach(fx => {
    const item = document.createElement("div");
    item.className = "saved-fx-item";
    item.innerHTML = `
      <div class="saved-fx-item-info">
        <strong>${escapeHtml(fx.name)}</strong>
        <span>${fx.mode} • Thresh: ${fx.threshold} • Bright: ${fx.brightness > 0 ? "+" : ""}${fx.brightness} • Contrast: ${fx.contrast > 0 ? "+" : ""}${fx.contrast} ${fx.invert ? "• [Invert]" : ""}</span>
      </div>
      <button type="button" class="kinetic-btn-sm kinetic-btn-secondary del-fx-btn" data-id="${fx.id}">HAPUS</button>
    `;
    item.querySelector(".del-fx-btn").onclick = () => deleteCustomEffect(fx.id);
    container.appendChild(item);
  });
}

function saveNewCustomEffect() {
  const nameEl = document.getElementById("cfgNewFxName");
  const modeEl = document.getElementById("cfgNewFxMode");
  const threshEl = document.getElementById("cfgNewFxThreshold");
  const brightEl = document.getElementById("cfgNewFxBrightness");
  const contrastEl = document.getElementById("cfgNewFxContrast");
  const invertEl = document.getElementById("cfgNewFxInvert");

  const name = (nameEl ? nameEl.value : "").trim();
  if (!name) {
    alert("Silakan masukkan nama template efek kustom Anda.");
    if (nameEl) nameEl.focus();
    return;
  }

  const newFx = {
    id: `fx-${Date.now()}`,
    name: name,
    mode: modeEl ? modeEl.value : "floyd-steinberg",
    threshold: threshEl ? parseInt(threshEl.value) : 50,
    brightness: brightEl ? parseInt(brightEl.value) : 50,
    contrast: contrastEl ? parseInt(contrastEl.value) : 50,
    invert: invertEl ? invertEl.checked : false,
    desc: `Kustom (1-100): T:${threshEl?.value || 50} B:${brightEl?.value || 50} C:${contrastEl?.value || 50}`
  };

  if (!state.customEffects) state.customEffects = [];
  state.customEffects.push(newFx);
  syncCustomEffectsToServer();

  if (nameEl) nameEl.value = "";
  renderSavedCustomFxList();
  renderPresetChips();
  alert(`Template efek "${name}" berhasil disimpan ke server!`);
}

function deleteCustomEffect(id) {
  if (confirm("Hapus template efek ini?")) {
    state.customEffects = (state.customEffects || []).filter(fx => fx.id !== id);
    if (state.activeEffectPresetId === id) {
      state.activeEffectPresetId = "preset-classic";
    }
    syncCustomEffectsToServer();
    renderSavedCustomFxList();
    renderPresetChips();
  }
}

function syncCustomEffectsToServer() {
  saveToStorage("viz_custom_effects", state.customEffects);
  fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ custom_effects: state.customEffects })
  }).catch(err => console.warn("Failed to sync custom effects to server:", err));
}

// Update visual badge on preview screen
function updatePreviewPrinterInfo() {
  const ps = state.printerSettings;
  const tagEl = document.getElementById("previewPrinterTag");
  const targetEl = document.getElementById("previewPrinterTarget");
  const subEl = document.getElementById("previewPrinterSub");
  const statusEl = document.getElementById("previewPrinterStatus");
  const btnText = document.getElementById("btnPrintReceiptText");

  const isDriver = (ps.connection !== "network");
  if (tagEl) {
    tagEl.textContent = isDriver ? "WINDOWS DRIVER" : "PRINTER IP (PORT 9100)";
  }
  if (targetEl) {
    targetEl.textContent = isDriver ? (ps.printerName || "EPSON TM-T82II Receipt") : `${ps.printerIp || "192.168.71.10"}:${ps.printerPort || 9100}`;
  }
  if (subEl) {
    subEl.textContent = isDriver
      ? `Pencetakan otomatis via driver thermal Windows '${ps.printerName || "EPSON TM-T82II Receipt"}'.`
      : `Pencetakan otomatis via socket raw TCP (${ps.printerIp || "192.168.71.10"}:${ps.printerPort || 9100}).`;
  }
  if (statusEl) {
    statusEl.textContent = "Siap mencetak strip 80mm";
  }
  if (btnText) {
    btnText.textContent = isDriver ? "CETAK STRIP (WINDOWS DRIVER)" : "CETAK STRIP (PRINTER IP)";
  }
}

// UNIFIED THERMAL PRINT: Automatically uses printer configuration from settings
async function executeConfiguredPrint(silent = false) {
  const canvas = document.getElementById("receiptCanvas");
  if (!canvas) return;

  const btnPrint = document.getElementById("btnPrintReceipt");
  const statusEl = document.getElementById("previewPrinterStatus");
  const thankyouStatus = document.getElementById("thankyouPrintStatus");
  if (btnPrint) btnPrint.disabled = true;

  const ps = state.printerSettings;
  const isDriver = (ps.connection !== "network");
  const name = ps.printerName || "EPSON TM-T82II Receipt";
  const ip = ps.printerIp || "192.168.71.10";
  const port = parseInt(ps.printerPort) || 9100;

  const msgSending = isDriver
    ? `⏳ Mengirim strip foto ke printer Windows '${name}'...`
    : `⏳ Mengirim stream ESC/POS ke printer IP (${ip}:${port})...`;

  if (statusEl) statusEl.textContent = msgSending;
  if (thankyouStatus) thankyouStatus.textContent = msgSending;

  const bytes = generateEscPosCommands(canvas);
  let binary = "";
  const len = bytes.byteLength;
  const chunk = 8192;
  for (let i = 0; i < len; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  const rawB64 = btoa(binary);

  try {
    const res = await fetch("/api/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raw: rawB64,
        connection: isDriver ? "driver" : "network",
        name: name,
        ip: ip,
        port: port
      })
    });
    const data = await res.json();
    if (data.ok) {
      const msgOk = `✅ ${data.info || "Foto berhasil dicetak di printer thermal!"}`;
      if (statusEl) statusEl.textContent = msgOk;
      if (thankyouStatus) thankyouStatus.textContent = msgOk;
      if (!silent) alert(`✅ Strip foto berhasil dicetak ke ${isDriver ? name : ip + ":" + port}!`);
      setTimeout(() => {
        showThankYouScreen();
      }, 1000);
    } else {
      if (isDriver) {
        const msgErr = `Server bridge offline: ${data.error || "Gagal mencetak"}`;
        if (statusEl) statusEl.textContent = msgErr;
        if (thankyouStatus) thankyouStatus.textContent = msgErr;
        printViaWindowsDriver();
      } else {
        const msgErr = `❌ ${data.error || "Gagal mencetak"}`;
        if (statusEl) statusEl.textContent = msgErr;
        if (thankyouStatus) thankyouStatus.textContent = msgErr;
        if (!silent) alert(`❌ Gagal mencetak ke IP printer (${ip}:${port}):\n${data.error || "Printer offline"}`);
      }
    }
  } catch (err) {
    console.warn("API print error, falling back:", err);
    if (isDriver) {
      const msgFallback = "Mengalihkan ke dialog cetak browser...";
      if (statusEl) statusEl.textContent = msgFallback;
      if (thankyouStatus) thankyouStatus.textContent = msgFallback;
      printViaWindowsDriver();
    } else {
      printViaNetworkIp(ip, port, thankyouStatus || statusEl);
    }
  } finally {
    if (btnPrint) btnPrint.disabled = false;
  }
}

// Scan installed printers from Windows via server API
async function scanWindowsPrinters() {
  const select = document.getElementById("cfgPrinterSelect");
  const statusEl = document.getElementById("cfgDriverStatus");
  if (!select) return;

  if (statusEl) statusEl.textContent = "⏳ Memindai printer thermal aktif di Windows...";
  select.innerHTML = '<option value="">-- Memindai printer Windows... --</option>';

  try {
    const res = await fetch("/api/printer/list", { method: "POST" });
    const data = await res.json();
    if (data.ok && Array.isArray(data.printers)) {
      select.innerHTML = '<option value="">-- Pilih Printer Terpasang --</option>';

      data.printers.forEach(p => {
        const pName = p.name || "";
        const portStr = p.port ? ` (${p.port})` : "";
        const statusLabel = p.isOnline ? (p.isThermal ? "🔥 [SIAP / THERMAL]" : "🟢 [SIAP]") : "🔴 [OFFLINE]";
        const opt = document.createElement("option");
        opt.value = pName;
        opt.dataset.port = p.port || "";
        opt.dataset.isip = p.isIp ? "true" : "false";
        opt.dataset.thermal = p.isThermal ? "true" : "false";
        opt.dataset.online = p.isOnline ? "true" : "false";
        opt.textContent = `${statusLabel} ${pName}${portStr}`;
        select.appendChild(opt);
      });

      if (state.printerSettings.printerName) {
        select.value = state.printerSettings.printerName;
      } else {
        const firstThermal = data.printers.find(p => p.isThermal && p.isOnline);
        if (firstThermal) {
          select.value = firstThermal.name;
          const nameInput = document.getElementById("cfgPrinterName");
          if (nameInput) nameInput.value = firstThermal.name;
          state.printerSettings.printerName = firstThermal.name;
        }
      }

      applyPrinterSelectionHint(select.selectedOptions[0]);

      if (statusEl) {
        const countThermal = data.printers.filter(p => p.isThermal && p.isOnline).length;
        statusEl.textContent = `Ditemukan ${data.printers.length} printer (${countThermal} thermal aktif).`;
      }
    } else {
      select.innerHTML = '<option value="">-- Gagal memuat daftar printer --</option>';
      if (statusEl) statusEl.textContent = `Gagal memindai: ${data.error || "Unknown error"}`;
    }
  } catch (err) {
    console.warn("Scan printers error:", err);
    select.innerHTML = '<option value="">-- Tidak dapat terhubung ke server --</option>';
    if (statusEl) statusEl.textContent = "Tidak dapat memindai (server bridge offline).";
  }
}

function applyPrinterSelectionHint(opt) {
  const hintEl = document.getElementById("cfgWinPrinterHint");
  if (!hintEl) return;
  if (opt && opt.dataset.isip === "true" && opt.dataset.port) {
    const portIp = opt.dataset.port;
    hintEl.innerHTML = `💡 Printer ini terhubung ke IP: <strong>${escapeHtml(portIp)}</strong> (<a href="#" id="linkCopyIp" style="color:var(--dp-color-accent);text-decoration:underline;">Klik di sini untuk pindah ke mode Printer IP TCP</a>)`;
    hintEl.style.display = "block";
    const link = document.getElementById("linkCopyIp");
    if (link) {
      link.onclick = (e) => {
        e.preventDefault();
        const connSel = document.getElementById("cfgPrinterConnection");
        const ipInput = document.getElementById("cfgPrinterIp");
        if (ipInput) ipInput.value = portIp;
        if (connSel) {
          connSel.value = "network";
          togglePrinterConnectionUI("network");
        }
      };
    }
  } else {
    hintEl.style.display = "none";
  }
}

function togglePrinterConnectionUI(conn) {
  const winBlock = document.getElementById("cfgWindowsDriverBlock");
  const netBlock = document.getElementById("cfgNetworkBlock");
  if (winBlock) winBlock.style.display = (conn === "driver") ? "block" : "none";
  if (netBlock) netBlock.style.display = (conn === "network") ? "block" : "none";
}

async function loadServerConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    if (data) {
      if (data.print) Object.assign(state.printerSettings, data.print);
      if (Array.isArray(data.custom_effects)) {
        state.customEffects = data.custom_effects;
        saveToStorage("viz_custom_effects", state.customEffects);
      }
    }
  } catch (_) {}
}

// Fallback 1: Windows Driver Browser Print
function printViaWindowsDriver() {
  const canvas = document.getElementById("receiptCanvas");
  const printImg = document.getElementById("printImage");
  if (!canvas || !printImg) return;
  printImg.src = canvas.toDataURL("image/png");
  setTimeout(() => {
    window.print();
  }, 100);
}

// Fallback 2: Direct Network IP Thermal Printer
async function printViaNetworkIp(targetIp, targetPort, statusEl) {
  const canvas = document.getElementById("receiptCanvas");
  if (!canvas) return;
  const ip = targetIp || state.printerSettings.printerIp || "192.168.71.10";
  const port = parseInt(targetPort || state.printerSettings.printerPort || 9100);
  if (statusEl) statusEl.textContent = `Menyiapkan 80mm ESC/POS (${canvas.width}x${canvas.height}px)...`;
  const bytes = generateEscPosCommands(canvas);
  if (statusEl) statusEl.textContent = `Mengirim paket RAW ESC/POS (${bytes.length} bytes) ke ${ip}:${port}...`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    await fetch(`http://${ip}:${port}`, {
      method: "POST",
      mode: "no-cors",
      body: bytes,
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (statusEl) statusEl.textContent = `Paket data terkirim ke ${ip}:${port}.`;
    alert(`Data cetak 80mm berhasil dikirim ke Printer IP (${ip}:${port})!`);
  } catch (err) {
    console.warn("IP Printer direct send result:", err);
    if (statusEl) statusEl.textContent = `Perintah dikirim ke ${ip}:${port}.`;
    alert(`Perintah dikirim ke ${ip}:${port}.\n(Pastikan perangkat terhubung di jaringan Wi-Fi/LAN yang sama dengan printer).`);
  }
}

// METODE 3: Web Serial (USB COM Port Direct)
async function connectSerialPrinter() {
  const statusEl = document.getElementById("serialStatus");
  const testBtn = document.getElementById("btnTestSerialPrint");
  try {
    if (!navigator.serial) {
      alert("Web Serial API hanya didukung di Google Chrome atau Microsoft Edge Desktop.");
      return;
    }
    if (statusEl) statusEl.textContent = "USB Serial COM: Memilih port...";
    state.serialPort = await navigator.serial.requestPort();
    await state.serialPort.open({ baudRate: 9600 });

    if (statusEl) statusEl.textContent = "USB Serial COM: Terhubung";
    if (testBtn) testBtn.disabled = false;
    alert("Printer USB Serial berhasil terhubung!");
  } catch (err) {
    console.error("Serial connection error:", err);
    if (statusEl) statusEl.textContent = "USB Serial COM: Koneksi gagal (" + err.message + ")";
  }
}

async function sendSerialEscPos(bytes) {
  if (!state.serialPort || !state.serialPort.writable) {
    alert("Printer USB Serial belum terhubung.");
    return;
  }
  const writer = state.serialPort.writable.getWriter();
  await writer.write(bytes);
  writer.releaseLock();
  alert("Data ESC/POS berhasil dikirim ke printer Serial!");
}

function downloadReceiptImage() {
  const canvas = document.getElementById("receiptCanvas");
  if (!canvas) return;
  const link = document.createElement("a");
  link.download = `vizreceipt-80mm-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function downloadEscPosBinary() {
  const canvas = document.getElementById("receiptCanvas");
  if (!canvas) return;
  const escPosData = generateEscPosCommands(canvas);
  const blob = new Blob([escPosData], { type: "application/octet-stream" });
  const link = document.createElement("a");
  link.download = `vizreceipt-80mm-${Date.now()}.bin`;
  link.href = URL.createObjectURL(blob);
  link.click();
}

// =============================================================================
// 9. UNIFIED SETTINGS (INFORMASI STRIP RECEIPT + PRINTER IP)
// =============================================================================
function syncSettingsInputs() {
  const rs = state.receiptSettings;
  const ps = state.printerSettings;

  // Receipt text fields
  const elHdr = document.getElementById("cfgHeader");
  const elSub = document.getElementById("cfgSubheader");
  const elEvt = document.getElementById("cfgEventDetails");
  const elDate = document.getElementById("cfgDateFormat");
  const elPfx = document.getElementById("cfgOrderPrefix");
  const elFtr = document.getElementById("cfgFooter");
  const elSoc = document.getElementById("cfgSocial");
  const elQr = document.getElementById("cfgQrUrl");
  const elShowQr = document.getElementById("cfgShowQr");

  if (elHdr) elHdr.value = rs.header || "";
  if (elSub) elSub.value = rs.subheader || "";
  if (elEvt) elEvt.value = rs.eventDetails || "";
  if (elDate) elDate.value = rs.dateFormat || "datetime";
  if (elPfx) elPfx.value = rs.orderPrefix || "ORDER #";
  if (elFtr) elFtr.value = rs.footer || "";
  if (elSoc) elSoc.value = rs.social || "";
  if (elQr) elQr.value = rs.qrUrl || "";
  if (elShowQr) elShowQr.checked = rs.showQr !== false;

  // Printer settings fields
  const elConn = document.getElementById("cfgPrinterConnection");
  const elName = document.getElementById("cfgPrinterName");
  const elSelect = document.getElementById("cfgPrinterSelect");
  const elIp = document.getElementById("cfgPrinterIp");
  const elPort = document.getElementById("cfgPrinterPort");
  const elFeed = document.getElementById("cfgFeedLines");
  const elCut = document.getElementById("cfgAutoCut");

  const conn = ps.connection || "driver";
  if (elConn) elConn.value = conn;
  togglePrinterConnectionUI(conn);

  if (elName) elName.value = ps.printerName || "EPSON TM-T82II Receipt";
  if (elSelect && ps.printerName) elSelect.value = ps.printerName;
  if (elIp) elIp.value = ps.printerIp || "192.168.71.10";
  if (elPort) elPort.value = ps.printerPort || 9100;
  if (elFeed) elFeed.value = ps.feedLines || 3;
  if (elCut) elCut.value = ps.autoCut ? "true" : "false";

  scanWindowsPrinters();
  updateReceiptTextPreview();
}

function updateReceiptTextPreview() {
  const previewBox = document.getElementById("receiptTextPreviewBox");
  if (!previewBox) return;

  const hdr = document.getElementById("cfgHeader") ? document.getElementById("cfgHeader").value : state.receiptSettings.header;
  const sub = document.getElementById("cfgSubheader") ? document.getElementById("cfgSubheader").value : state.receiptSettings.subheader;
  const evt = document.getElementById("cfgEventDetails") ? document.getElementById("cfgEventDetails").value : state.receiptSettings.eventDetails;
  const ftr = document.getElementById("cfgFooter") ? document.getElementById("cfgFooter").value : state.receiptSettings.footer;
  const soc = document.getElementById("cfgSocial") ? document.getElementById("cfgSocial").value : state.receiptSettings.social;
  const qr = document.getElementById("cfgQrUrl") ? document.getElementById("cfgQrUrl").value : state.receiptSettings.qrUrl;
  const showQr = document.getElementById("cfgShowQr") ? document.getElementById("cfgShowQr").checked : state.receiptSettings.showQr;

  const dateStr = getMakassarDateString("datetime");
  previewBox.innerHTML = `
    <div style="text-align: center; font-weight: bold; font-size: 14px;">${escapeHtml(hdr)}</div>
    ${sub ? `<div style="text-align: center; font-size: 12px; margin-top: 3px;">${escapeHtml(sub)}</div>` : ""}
    ${evt ? `<div style="text-align: center; font-size: 11px; margin-top: 3px;">${escapeHtml(evt)}</div>` : ""}
    <div style="text-align: center; font-size: 10px; margin-top: 4px; color: #555;">ORDER #1234 • ${dateStr}</div>
    <div style="text-align: center; margin: 8px 0; border-top: 1px dashed #000;"></div>
    <div style="text-align: center; color: #444; font-weight: bold;">[ === AREA FOTO STRIP 80MM === ]</div>
    <div style="text-align: center; margin: 8px 0; border-top: 1px dashed #000;"></div>
    <div style="text-align: center; font-size: 11px; white-space: pre-line;">${escapeHtml(ftr)}</div>
    <div style="text-align: center; font-size: 11px; margin-top: 4px;">${escapeHtml(soc)}</div>
    ${showQr ? `<div style="text-align: center; margin-top: 8px; font-size: 10px; color: #333;">[ QR CODE: ${escapeHtml(qr)} ]</div>` : ""}
  `;
}

function saveAllSettings() {
  // Update state from form
  const elHdr = document.getElementById("cfgHeader");
  const elSub = document.getElementById("cfgSubheader");
  const elEvt = document.getElementById("cfgEventDetails");
  const elDate = document.getElementById("cfgDateFormat");
  const elPfx = document.getElementById("cfgOrderPrefix");
  const elFtr = document.getElementById("cfgFooter");
  const elSoc = document.getElementById("cfgSocial");
  const elQr = document.getElementById("cfgQrUrl");
  const elShowQr = document.getElementById("cfgShowQr");

  if (elHdr) state.receiptSettings.header = elHdr.value.trim();
  if (elSub) state.receiptSettings.subheader = elSub.value.trim();
  if (elEvt) state.receiptSettings.eventDetails = elEvt.value.trim();
  if (elDate) state.receiptSettings.dateFormat = elDate.value;
  if (elPfx) state.receiptSettings.orderPrefix = elPfx.value.trim();
  if (elFtr) state.receiptSettings.footer = elFtr.value.trim();
  if (elSoc) state.receiptSettings.social = elSoc.value.trim();
  if (elQr) state.receiptSettings.qrUrl = elQr.value.trim();
  if (elShowQr) state.receiptSettings.showQr = elShowQr.checked;

  const elConn = document.getElementById("cfgPrinterConnection");
  const elName = document.getElementById("cfgPrinterName");
  const elIp = document.getElementById("cfgPrinterIp");
  const elPort = document.getElementById("cfgPrinterPort");
  const elFeed = document.getElementById("cfgFeedLines");
  const elCut = document.getElementById("cfgAutoCut");

  if (elConn) state.printerSettings.connection = elConn.value;
  if (elName) state.printerSettings.printerName = elName.value.trim();
  if (elIp) state.printerSettings.printerIp = elIp.value.trim();
  if (elPort) state.printerSettings.printerPort = parseInt(elPort.value) || 9100;
  if (elFeed) state.printerSettings.feedLines = parseInt(elFeed.value) || 3;
  if (elCut) state.printerSettings.autoCut = elCut.value === "true";

  state.printerSettings.paperSize = "80mm";

  saveToStorage("viz_receipt_settings", state.receiptSettings);
  saveToStorage("viz_printer_settings_80mm", state.printerSettings);

  fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      print: {
        connection: state.printerSettings.connection,
        name: state.printerSettings.printerName,
        ip: state.printerSettings.printerIp,
        port: state.printerSettings.printerPort,
        feedLines: state.printerSettings.feedLines,
        autoCut: state.printerSettings.autoCut,
        paperWidthMm: 80
      }
    })
  }).catch(e => console.warn("Sync server config failed:", e));

  updatePreviewPrinterInfo();
  alert("Semua pengaturan Teks Strip Receipt & Printer berhasil disimpan!");
}

// =============================================================================
// 10. THANK YOU SCREEN
// =============================================================================
function showThankYouScreen() {
  navigateTo("thankyou");

  const canvas = document.getElementById("receiptCanvas");
  const stripImg = document.getElementById("thankyouStripImg");
  const timerDisplay = document.getElementById("autoResetTimer");
  const receiptEl = document.getElementById("animatedReceipt");

  if (canvas && stripImg) {
    stripImg.src = canvas.toDataURL("image/png");
  }

  if (receiptEl) {
    receiptEl.classList.remove("run");
    void receiptEl.offsetWidth;
    receiptEl.classList.add("run");
  }
  let seconds = 20;
  if (timerDisplay) timerDisplay.textContent = seconds;
  clearInterval(state.autoResetInterval);
  state.autoResetInterval = setInterval(() => {
    seconds--;
    if (timerDisplay) timerDisplay.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(state.autoResetInterval);
      navigateTo("landing");
    }
  }, 1000);
}

// =============================================================================
// 11. TEMPLATE EDITOR WORKSPACE (80MM ONLY)
// =============================================================================
let editingTemplate = null;

function renderTemplateList() {
  const container = document.getElementById("templateListItems");
  if (!container) return;
  container.innerHTML = "";

  state.templates.forEach(tpl => {
    const item = document.createElement("div");
    item.className = `tpl-list-item ${editingTemplate && editingTemplate.id === tpl.id ? "active" : ""}`;
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(tpl.name)}</strong>
        <div style="font-size: 11px; color: var(--dp-color-rule);">${tpl.slots.length} FOTO • 80MM (576PX)</div>
      </div>
      <div>
        ${tpl.id.startsWith("custom-") ? `<button class="kinetic-btn-sm kinetic-btn-secondary del-tpl-btn" data-id="${tpl.id}">HAPUS</button>` : `<span style="font-size: 11px; color: var(--dp-color-accent);">BAWAAN</span>`}
      </div>
    `;

    item.onclick = (e) => {
      if (e.target.classList.contains("del-tpl-btn")) {
        deleteTemplate(tpl.id);
        return;
      }
      editingTemplate = JSON.parse(JSON.stringify(tpl));
      renderTemplateList();
      renderTemplateWorkspace();
    };

    container.appendChild(item);
  });
}

function renderTemplateWorkspace() {
  if (!editingTemplate) {
    editingTemplate = JSON.parse(JSON.stringify(state.activeTemplate));
  }

  const nameInput = document.getElementById("tplNameInput");
  const slotCount = document.getElementById("slotCountDisplay");

  if (nameInput) nameInput.value = editingTemplate.name;
  if (slotCount) slotCount.textContent = editingTemplate.slots.length;

  editingTemplate.width = 576;
  editingTemplate.paperSize = "80mm";

  renderSlotInputs();
  renderTextOverlayInputs();
  drawTemplateEditorCanvas();
}

function drawTemplateEditorCanvas() {
  const canvas = document.getElementById("templatePreviewCanvas");
  if (!canvas || !editingTemplate) return;

  canvas.width = 576;
  canvas.height = editingTemplate.height || 1000;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#888888";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.fillText("--- AREA HEADER & TEKS 80MM ---", canvas.width / 2, 50);

  editingTemplate.slots.forEach((slot, idx) => {
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(slot.x, slot.y, slot.width, slot.height);
    ctx.strokeStyle = "#ff6b00";
    ctx.lineWidth = 2;
    ctx.strokeRect(slot.x, slot.y, slot.width, slot.height);

    ctx.fillStyle = "#101010";
    ctx.font = "bold 15px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`FOTO ${idx + 1} (${slot.width}x${slot.height})`, slot.x + slot.width / 2, slot.y + slot.height / 2);
  });

  if (editingTemplate.textOverlays) {
    editingTemplate.textOverlays.forEach(ov => {
      ctx.fillStyle = "#000000";
      ctx.font = `${ov.bold ? "bold " : ""}${ov.fontSize}px monospace`;
      ctx.textAlign = ov.align || "center";
      ctx.fillText(ov.text, ov.x, ov.y);
    });
  }

  if (editingTemplate.frameImage) {
    const frameImg = new Image();
    frameImg.onload = () => {
      ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
    };
    frameImg.src = editingTemplate.frameImage;
  }
}

function renderSlotInputs() {
  const container = document.getElementById("slotsConfigContainer");
  if (!container || !editingTemplate) return;
  container.innerHTML = "";

  editingTemplate.slots.forEach((slot, idx) => {
    const row = document.createElement("div");
    row.className = "slot-item-kinetic";
    row.innerHTML = `
      <div><input type="number" class="kinetic-input-sm slot-x" value="${slot.x}" title="Posisi X"></div>
      <div><input type="number" class="kinetic-input-sm slot-y" value="${slot.y}" title="Posisi Y"></div>
      <div><input type="number" class="kinetic-input-sm slot-w" value="${slot.width}" title="Lebar"></div>
      <div><input type="number" class="kinetic-input-sm slot-h" value="${slot.height}" title="Tinggi"></div>
      <button class="kinetic-btn-sm kinetic-btn-secondary" onclick="removePhotoSlot(${idx})">×</button>
    `;

    row.querySelectorAll(".kinetic-input-sm").forEach(input => {
      input.oninput = () => {
        slot.x = parseInt(row.querySelector(".slot-x").value) || 0;
        slot.y = parseInt(row.querySelector(".slot-y").value) || 0;
        slot.width = parseInt(row.querySelector(".slot-w").value) || 100;
        slot.height = parseInt(row.querySelector(".slot-h").value) || 100;
        drawTemplateEditorCanvas();
      };
    });

    container.appendChild(row);
  });
}

function renderTextOverlayInputs() {
  const container = document.getElementById("textOverlaysContainer");
  if (!container || !editingTemplate) return;
  container.innerHTML = "";

  if (!editingTemplate.textOverlays) editingTemplate.textOverlays = [];

  editingTemplate.textOverlays.forEach((ov, idx) => {
    const row = document.createElement("div");
    row.className = "overlay-item-kinetic";
    row.innerHTML = `
      <div style="grid-column: span 2;"><input type="text" class="kinetic-input-sm ov-text" value="${escapeHtml(ov.text)}" placeholder="Teks"></div>
      <div><input type="number" class="kinetic-input-sm ov-y" value="${ov.y}" placeholder="Y"></div>
      <div><input type="number" class="kinetic-input-sm ov-size" value="${ov.fontSize}" placeholder="Font"></div>
      <button class="kinetic-btn-sm kinetic-btn-secondary" onclick="removeTextOverlay(${idx})">×</button>
    `;

    row.querySelectorAll(".kinetic-input-sm").forEach(input => {
      input.oninput = () => {
        ov.text = row.querySelector(".ov-text").value;
        ov.y = parseInt(row.querySelector(".ov-y").value) || 0;
        ov.fontSize = parseInt(row.querySelector(".ov-size").value) || 12;
        drawTemplateEditorCanvas();
      };
    });

    container.appendChild(row);
  });
}

window.removePhotoSlot = function(idx) {
  if (editingTemplate && editingTemplate.slots.length > 1) {
    editingTemplate.slots.splice(idx, 1);
    renderTemplateWorkspace();
  } else {
    alert("Template wajib memiliki minimal 1 slot foto.");
  }
};

window.removeTextOverlay = function(idx) {
  if (editingTemplate && editingTemplate.textOverlays) {
    editingTemplate.textOverlays.splice(idx, 1);
    renderTemplateWorkspace();
  }
};

function addPhotoSlot() {
  if (!editingTemplate) return;
  const last = editingTemplate.slots[editingTemplate.slots.length - 1];
  const newY = last ? last.y + last.height + 20 : 160;
  editingTemplate.slots.push({
    x: 38,
    y: newY,
    width: 500,
    height: 300,
    radius: 0
  });
  if (newY + 350 > editingTemplate.height) {
    editingTemplate.height = newY + 380;
  }
  renderTemplateWorkspace();
}

function addTextOverlay() {
  if (!editingTemplate) return;
  if (!editingTemplate.textOverlays) editingTemplate.textOverlays = [];
  editingTemplate.textOverlays.push({
    text: "TEKS ACARA / HASHTAG",
    x: 288,
    y: 100,
    fontSize: 16,
    align: "center",
    bold: true
  });
  renderTemplateWorkspace();
}

function saveTemplateChanges() {
  if (!editingTemplate) return;
  const nameInput = document.getElementById("tplNameInput");

  editingTemplate.name = nameInput.value.trim() || "Template Kustom 80mm";
  editingTemplate.paperSize = "80mm";
  editingTemplate.width = 576;

  const existingIdx = state.templates.findIndex(t => t.id === editingTemplate.id);
  if (existingIdx !== -1) {
    state.templates[existingIdx] = editingTemplate;
  } else {
    state.templates.push(editingTemplate);
  }

  syncTemplatesToServer();
  if (state.selectedTemplateId === editingTemplate.id) {
    state.activeTemplate = editingTemplate;
  }
  renderTemplateList();
  alert("Template 80mm berhasil disimpan!");
}

function createNewTemplate() {
  const newId = `custom-${Date.now()}`;
  editingTemplate = {
    id: newId,
    name: "Template Kustom Baru",
    paperSize: "80mm",
    width: 576,
    height: 1000,
    slots: [
      { x: 38, y: 160, width: 500, height: 350, radius: 0 }
    ],
    textOverlays: [
      { text: "MY SPECIAL EVENT", x: 288, y: 65, fontSize: 24, align: "center", bold: true }
    ],
    frameImage: null
  };
  state.templates.push(editingTemplate);
  syncTemplatesToServer();
  renderTemplateList();
  renderTemplateWorkspace();
}

function deleteTemplate(id) {
  if (confirm("Hapus template ini?")) {
    state.templates = state.templates.filter(t => t.id !== id);
    if (state.selectedTemplateId === id) {
      state.selectedTemplateId = state.templates[0].id;
      state.activeTemplate = state.templates[0];
      saveToStorage("viz_selected_tpl_80mm", state.selectedTemplateId);
    }
  syncTemplatesToServer();
    editingTemplate = state.templates[0];
    renderTemplateList();
    renderTemplateWorkspace();
  }
}

function resetDefaultTemplates() {
  if (confirm("Kembalikan semua template ke default 80mm (1 Foto, 2 Foto, 4 Foto 2x2)?")) {
    state.templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
    state.selectedTemplateId = "tpl-2photo";
    state.activeTemplate = state.templates[1];
  syncTemplatesToServer();
    saveToStorage("viz_selected_tpl_80mm", state.selectedTemplateId);
    editingTemplate = state.templates[1];
    renderTemplateList();
    renderTemplateWorkspace();
    renderLandingTemplatesGrid();
    alert("Template default 80mm berhasil dipulihkan.");
  }
}

function syncTemplatesToServer() {
  saveToStorage("viz_templates_80mm", state.templates);
  fetch("/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templates: state.templates })
  }).catch(err => console.warn("Failed to sync templates to server:", err));
}

async function loadTemplatesFromServer() {
  try {
    const res = await fetch("/api/templates");
    const data = await res.json();
    if (data && data.ok && Array.isArray(data.templates) && data.templates.length > 0) {
      state.templates = data.templates;
      saveToStorage("viz_templates_80mm", state.templates);
      state.activeTemplate = state.templates.find(t => t.id === state.selectedTemplateId) || state.templates[0];
      renderLandingTemplatesGrid();
      if (state.currentScreen === "templates") {
        renderTemplateList();
        renderTemplateWorkspace();
      }
    }
  } catch (err) {
    console.warn("Load templates from server failed, using local cache:", err);
  }
}

function escapeHtml(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// =============================================================================
// 12. EVENT LISTENERS INITIALIZATION
// =============================================================================
function initEventListeners() {
  // Navigation tabs
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.onclick = () => navigateTo(btn.dataset.target);
  });

  // Marquee pause toggle
  const btnToggleMarquee = document.getElementById("btnToggleMarquee");
  const marqueeTicker = document.getElementById("marqueeTicker");
  if (btnToggleMarquee && marqueeTicker) {
    btnToggleMarquee.onclick = () => {
      state.marqueePaused = !state.marqueePaused;
      marqueeTicker.classList.toggle("paused", state.marqueePaused);
      btnToggleMarquee.textContent = state.marqueePaused ? "PLAY ▶" : "PAUSE ||";
    };
  }

  // Start button on landing
  const btnStart = document.getElementById("btnStartPhotobooth");
  if (btnStart) {
    btnStart.onclick = () => navigateTo("capture");
  }

  // Photo Upload Button & Input (Capture Screen Only)
  const fileInput = document.getElementById("globalPhotoUploadInput");
  const btnUploadCapture = document.getElementById("btnUploadInCapture");

  if (btnUploadCapture && fileInput) {
    btnUploadCapture.onclick = () => fileInput.click();
  }
  if (fileInput) {
    fileInput.onchange = (e) => {
      handlePhotoUpload(e.target.files);
      fileInput.value = "";
    };
  }

  // Camera buttons
  const btnTrigger = document.getElementById("btnTriggerCapture");
  if (btnTrigger) btnTrigger.onclick = triggerCountdownCapture;

  const btnCancel = document.getElementById("btnCancelCapture");
  if (btnCancel) btnCancel.onclick = () => navigateTo("landing");

  document.querySelectorAll(".timer-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".timer-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.timerSeconds = parseInt(btn.dataset.time) || 3;
      updateHUD();
    };
  });

  const cameraSelect = document.getElementById("cameraSelect");
  if (cameraSelect) cameraSelect.onchange = startCamera;

  // Dither Controls
  const ditherModeSelect = document.getElementById("ditherModeSelect");
  const ditherThreshold = document.getElementById("ditherThreshold");
  const thresholdValDisplay = document.getElementById("thresholdValDisplay");
  const brightnessInput = document.getElementById("brightnessInput");
  const brightnessValDisplay = document.getElementById("brightnessValDisplay");
  const contrastInput = document.getElementById("contrastInput");
  const contrastValDisplay = document.getElementById("contrastValDisplay");
  const invertCheckbox = document.getElementById("invertColorsCheckbox");

  if (ditherModeSelect) {
    ditherModeSelect.onchange = () => {
      state.printerSettings.ditherMode = ditherModeSelect.value;
      saveToStorage("viz_printer_settings_80mm", state.printerSettings);
      renderThermalReceipt();
    };
  }
  if (ditherThreshold) {
    ditherThreshold.oninput = () => {
      state.printerSettings.threshold = parseInt(ditherThreshold.value);
      if (thresholdValDisplay) thresholdValDisplay.textContent = ditherThreshold.value;
      renderThermalReceipt();
    };
  }
  if (brightnessInput) {
    brightnessInput.oninput = () => {
      state.printerSettings.brightness = parseInt(brightnessInput.value);
      if (brightnessValDisplay) brightnessValDisplay.textContent = brightnessInput.value;
      renderThermalReceipt();
    };
  }
  if (contrastInput) {
    contrastInput.oninput = () => {
      state.printerSettings.contrast = parseInt(contrastInput.value);
      if (contrastValDisplay) contrastValDisplay.textContent = contrastInput.value;
      renderThermalReceipt();
    };
  }
  if (invertCheckbox) {
    invertCheckbox.onchange = () => {
      state.printerSettings.invert = invertCheckbox.checked;
      renderThermalReceipt();
    };
  }

  // Custom Effect Form Controls in Settings
  const btnSaveFx = document.getElementById("btnSaveCustomFx");
  if (btnSaveFx) btnSaveFx.onclick = saveNewCustomEffect;

  const newFxThresh = document.getElementById("cfgNewFxThreshold");
  const newFxBright = document.getElementById("cfgNewFxBrightness");
  const newFxContrast = document.getElementById("cfgNewFxContrast");
  const newFxThreshVal = document.getElementById("cfgNewFxThreshVal");
  const newFxBrightVal = document.getElementById("cfgNewFxBrightVal");
  const newFxContrastVal = document.getElementById("cfgNewFxContrastVal");

  if (newFxThresh && newFxThreshVal) {
    newFxThresh.oninput = () => { newFxThreshVal.textContent = newFxThresh.value; };
  }
  if (newFxBright && newFxBrightVal) {
    newFxBright.oninput = () => { newFxBrightVal.textContent = newFxBright.value; };
  }
  if (newFxContrast && newFxContrastVal) {
    newFxContrast.oninput = () => { newFxContrastVal.textContent = newFxContrast.value; };
  }

  // Print Buttons
  const btnPrint = document.getElementById("btnPrintReceipt");
  if (btnPrint) btnPrint.onclick = executeConfiguredPrint;

  const btnScan = document.getElementById("btnScanPrinters");
  if (btnScan) btnScan.onclick = () => scanWindowsPrinters();

  const connSelect = document.getElementById("cfgPrinterConnection");
  if (connSelect) {
    connSelect.onchange = (e) => togglePrinterConnectionUI(e.target.value);
  }

  const prSelect = document.getElementById("cfgPrinterSelect");
  if (prSelect) {
    prSelect.onchange = () => {
      const opt = prSelect.selectedOptions[0];
      if (opt && opt.value) {
        const nameInput = document.getElementById("cfgPrinterName");
        if (nameInput) nameInput.value = opt.value;
        applyPrinterSelectionHint(opt);
        const statusEl = document.getElementById("cfgDriverStatus");
        if (statusEl) statusEl.textContent = `Terpilih: ${opt.value} ${opt.dataset.online === "true" ? "🟢 Siap" : "🔴 Offline"}`;
      }
    };
  }

  const btnTestDriver = document.getElementById("btnTestDriverPrint");
  if (btnTestDriver) {
    btnTestDriver.onclick = async () => {
      const name = (document.getElementById("cfgPrinterName")?.value || state.printerSettings.printerName || "EPSON TM-T82II Receipt").trim();
      const statusEl = document.getElementById("cfgDriverStatus");
      if (statusEl) statusEl.textContent = `⏳ Mengirim test print ke '${name}'...`;
      try {
        const res = await fetch("/api/printer/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connection: "driver", name })
        });
        const data = await res.json();
        if (data.ok) {
          if (statusEl) statusEl.textContent = `✅ Test print terkirim ke '${name}'!`;
          alert(`✅ Test print berhasil dikirim ke printer '${name}'!`);
        } else {
          if (statusEl) statusEl.textContent = `❌ Gagal: ${data.error || "Printer offline"}`;
          alert(`❌ Gagal test print: ${data.error}`);
        }
      } catch (err) {
        if (statusEl) statusEl.textContent = "Server offline, mencoba cetak browser...";
        renderThermalReceipt().then(() => printViaWindowsDriver());
      }
    };
  }

  const btnTestIp = document.getElementById("btnTestIpPrint");
  if (btnTestIp) {
    btnTestIp.onclick = async () => {
      const ip = (document.getElementById("cfgPrinterIp")?.value || state.printerSettings.printerIp || "192.168.71.10").trim();
      const port = parseInt(document.getElementById("cfgPrinterPort")?.value) || 9100;
      const statusEl = document.getElementById("cfgIpStatus");
      if (statusEl) statusEl.textContent = `⏳ Mengirim test print ke ${ip}:${port}...`;
      try {
        const res = await fetch("/api/printer/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connection: "network", ip, port })
        });
        const data = await res.json();
        if (data.ok) {
          if (statusEl) statusEl.textContent = `✅ Test print terkirim ke ${ip}:${port}!`;
          alert(`✅ Test print berhasil dikirim ke ${ip}:${port}!`);
        } else {
          if (statusEl) statusEl.textContent = `❌ Gagal: ${data.error || "Printer offline"}`;
          alert(`❌ Gagal test print ke IP: ${data.error}`);
        }
      } catch (err) {
        printViaNetworkIp(ip, port, statusEl);
      }
    };
  }

  const btnDlPng = document.getElementById("btnDownloadReceipt");
  if (btnDlPng) btnDlPng.onclick = downloadReceiptImage;

  const btnDlEsc = document.getElementById("btnDownloadEscPos");
  if (btnDlEsc) btnDlEsc.onclick = downloadEscPosBinary;

  const btnRetake = document.getElementById("btnRetakeAll");
  if (btnRetake) btnRetake.onclick = () => navigateTo("capture");

  const btnFinish = document.getElementById("btnFinishSession");
  if (btnFinish) btnFinish.onclick = showThankYouScreen;

  const btnResetHome = document.getElementById("btnResetToHome");
  if (btnResetHome) {
    btnResetHome.onclick = () => {
      clearInterval(state.autoResetInterval);
      state.capturedShots = [];
      state.currentShotIndex = 0;
      navigateTo("landing");
    };
  }

  const btnReprint = document.getElementById("btnReprintDiffEffect");
  if (btnReprint) {
    btnReprint.onclick = () => {
      clearInterval(state.autoResetInterval);
      navigateTo("preview");
    };
  }
  // USB Serial Buttons
  const btnConnectSer = document.getElementById("btnConnectSerial");
  if (btnConnectSer) btnConnectSer.onclick = connectSerialPrinter;

  const btnTestSer = document.getElementById("btnTestSerialPrint");
  if (btnTestSer) {
    btnTestSer.onclick = () => {
      const canvas = document.getElementById("receiptCanvas");
      if (canvas) {
        const bytes = generateEscPosCommands(canvas);
        sendSerialEscPos(bytes);
      }
    };
  }

  // Unified Settings Save Button
  const btnSaveSettings = document.getElementById("btnSaveAllSettings");
  if (btnSaveSettings) {
    btnSaveSettings.onclick = saveAllSettings;
  }

  // Live preview listeners for receipt text
  const textInputIds = ["cfgHeader", "cfgSubheader", "cfgEventDetails", "cfgDateFormat", "cfgOrderPrefix", "cfgFooter", "cfgSocial", "cfgQrUrl", "cfgShowQr"];
  textInputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.oninput = updateReceiptTextPreview;
  });

  // Template Editor Actions
  const btnCreateTpl = document.getElementById("btnCreateNewTemplate");
  if (btnCreateTpl) btnCreateTpl.onclick = createNewTemplate;

  const btnSaveTpl = document.getElementById("btnSaveTemplate");
  if (btnSaveTpl) btnSaveTpl.onclick = saveTemplateChanges;

  const btnResetTpl = document.getElementById("btnResetDefaultTemplates");
  if (btnResetTpl) btnResetTpl.onclick = resetDefaultTemplates;

  const btnAddSlot = document.getElementById("btnAddPhotoSlot");
  if (btnAddSlot) btnAddSlot.onclick = addPhotoSlot;

  const btnAddText = document.getElementById("btnAddTextOverlay");
  if (btnAddText) btnAddText.onclick = addTextOverlay;

  const frameInput = document.getElementById("frameUploadInput");
  if (frameInput) {
    frameInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file && editingTemplate) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          editingTemplate.frameImage = evt.target.result;
          drawTemplateEditorCanvas();
        };
        reader.readAsDataURL(file);
      }
    };
  }

  const btnClearFrame = document.getElementById("btnClearFrame");
  if (btnClearFrame) {
    btnClearFrame.onclick = () => {
      if (editingTemplate) {
        editingTemplate.frameImage = null;
        if (frameInput) frameInput.value = "";
        drawTemplateEditorCanvas();
      }
    };
  }
}

// Initial bootstrap
window.addEventListener("DOMContentLoaded", async () => {
  initEventListeners();
  renderLandingTemplatesGrid();
  await loadServerConfig();
  await loadTemplatesFromServer();
  syncSettingsInputs();
  updatePreviewPrinterInfo();
});
