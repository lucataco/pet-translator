import { buildCaption, NEED_LABELS, SPECIES_LABELS, VOCAL_LABELS } from "./captions.js";

const $ = (s) => document.querySelector(s);
const MB = 1024 * 1024;
const PRICE_PER_M_INPUT = 0.15; // Clef-omni, USD per million input tokens
const RECORD_SECONDS = 8;
const VIDEO_MIMES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];
const LOADING_LINES = [
  "Listening to your pet...",
  "Measuring tail velocity...",
  "Cross-referencing the bark database...",
  "Consulting the council of cats...",
  "Decoding whisker telemetry...",
];

const el = {
  tabs: document.querySelectorAll(".tab-btn"),
  tabRecord: $("#tab-record"),
  tabUpload: $("#tab-upload"),
  preview: $("#preview"),
  camPlaceholder: $("#cam-placeholder"),
  countdown: $("#countdown"),
  recDot: $("#rec-dot"),
  camBtn: $("#cam-btn"),
  flipBtn: $("#flip-btn"),
  recBtn: $("#rec-btn"),
  drop: $("#drop"),
  file: $("#file"),
  uploadPreview: $("#upload-preview"),
  name: $("#pet-name"),
  context: $("#context"),
  go: $("#go"),
  status: $("#status"),
  input: $("#input"),
  result: $("#result"),
  resultStage: $("#result-stage"),
  playback: $("#playback"),
  still: $("#still"),
  subtitle: $("#subtitle"),
  verdictNeed: $("#verdict-need"),
  verdictConf: $("#verdict-conf"),
  reroll: $("#reroll"),
  dlVideo: $("#dl-video"),
  dlCard: $("#dl-card"),
  again: $("#again"),
  exportLinks: $("#export-links"),
  needBars: $("#need-bars"),
  meters: $("#meters"),
  chips: $("#chips"),
  stats: $("#stats"),
};

const state = {
  stream: null,
  facing: "environment",
  recorder: null,
  media: {}, // { video?: Blob, audio?: Blob, image?: Blob }
  urls: [],
  result: null,
  roundTripMs: 0,
  seed: 1,
  caption: null,
  busy: false,
};

// ---------- helpers ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pct = (p) => `${Math.round((p ?? 0) * 100)}%`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pickMime = (list) => (window.MediaRecorder ? list.find((t) => MediaRecorder.isTypeSupported(t)) : "") || "";
const extFor = (type = "") => {
  if (type.includes("webm")) return "webm";
  if (type.startsWith("video/") || type.includes("mp4")) return "mp4";
  if (type.includes("png")) return "png";
  if (type.includes("wav")) return "wav";
  if (type.includes("mpeg")) return "mp3";
  return "jpg";
};

function objectUrl(blob) {
  const url = URL.createObjectURL(blob);
  state.urls.push(url);
  return url;
}

function setStatus(text, kind = "") {
  el.status.textContent = text;
  el.status.className = `status ${kind}`;
}

function once(target, event, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    target.addEventListener(event, (e) => { clearTimeout(t); resolve(e); }, { once: true });
    target.addEventListener("error", () => { clearTimeout(t); reject(new Error("Could not read that media file")); }, { once: true });
  });
}

function kindOf(file) {
  const t = file.type || "";
  const e = file.name.toLowerCase().split(".").pop();
  if (t.startsWith("video/") || ["mp4", "mov", "m4v", "webm"].includes(e)) return "video";
  if (t.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "aac"].includes(e)) return "audio";
  if (t.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "heic", "gif"].includes(e)) return "image";
  return null;
}

function makeRecorder(stream, videoBitsPerSecond) {
  const mimeType = pickMime(VIDEO_MIMES);
  const rec = new MediaRecorder(stream, { ...(mimeType && { mimeType }), videoBitsPerSecond, audioBitsPerSecond: 128000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: (rec.mimeType || mimeType || "video/webm").split(";")[0] }));
  });
  return { rec, done };
}

// Re-encode a video through a canvas (optionally drawing an overlay on every frame).
// Used both to shrink big phone uploads and to burn subtitles into the share video.
async function renderVideo(src, { maxSec = 20, longSide = 640, bitrate = 1_200_000, overlay } = {}) {
  const v = document.createElement("video");
  v.src = URL.createObjectURL(src);
  v.playsInline = true;
  v.preload = "auto";
  await once(v, "loadedmetadata");

  const scale = Math.min(1, longSide / Math.max(v.videoWidth, v.videoHeight));
  const w = Math.round((v.videoWidth * scale) / 2) * 2;
  const h = Math.round((v.videoHeight * scale) / 2) * 2;
  const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = canvas.getContext("2d");
  if (v.readyState >= 2) ctx.drawImage(v, 0, 0, w, h);

  const out = canvas.captureStream(30);
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaElementSource(v);
  const dest = audioCtx.createMediaStreamDestination();
  source.connect(dest); // routed to the recorder only -- stays silent on speakers
  dest.stream.getAudioTracks().forEach((t) => out.addTrack(t));

  const { rec, done } = makeRecorder(out, bitrate);
  const end = Number.isFinite(v.duration) ? Math.min(v.duration, maxSec) : maxSec;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    v.pause();
    if (rec.state !== "inactive") rec.stop();
  };
  v.addEventListener("ended", stop, { once: true });

  const draw = () => {
    if (stopped) return;
    ctx.drawImage(v, 0, 0, w, h);
    overlay?.(ctx, w, h, v.currentTime);
    if (v.currentTime >= end) return stop();
    requestAnimationFrame(draw);
  };

  await audioCtx.resume().catch(() => {});
  rec.start(250);
  await v.play();
  draw();
  const blob = await done;
  audioCtx.close().catch(() => {});
  URL.revokeObjectURL(v.src);
  return blob;
}

async function probeDuration(blob) {
  const v = document.createElement("video");
  v.preload = "metadata";
  v.src = URL.createObjectURL(blob);
  try {
    await once(v, "loadedmetadata", 8000);
    return v.duration;
  } catch {
    return NaN;
  } finally {
    URL.revokeObjectURL(v.src);
  }
}

async function prepareVideo(file) {
  const duration = await probeDuration(file);
  const small = file.size <= 12 * MB;
  const short = !Number.isFinite(duration) || duration <= 30;
  if (small && short) return file;
  if (Number.isNaN(duration)) {
    if (file.size <= 16 * MB) return file; // browser can't decode it, let the model try
    throw new Error("That video is too big and this browser can't compress it. Try a clip under 16 MB.");
  }
  setStatus(`Compressing the first ${Math.round(Math.min(duration, 20))}s of your clip...`, "loading");
  return renderVideo(file, { maxSec: 20, longSide: 640, bitrate: 1_000_000 });
}

async function prepareImage(file) {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = Object.assign(document.createElement("canvas"), {
    width: Math.round(img.naturalWidth * scale),
    height: Math.round(img.naturalHeight * scale),
  });
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);
  return new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.88));
}

// ---------- input: tabs, camera, upload ----------

el.tabs.forEach((btn) =>
  btn.addEventListener("click", () => {
    el.tabs.forEach((b) => b.classList.toggle("active", b === btn));
    const rec = btn.dataset.tab === "record";
    el.tabRecord.hidden = !rec;
    el.tabUpload.hidden = rec;
    if (!rec) stopCamera();
  }),
);

async function startCamera() {
  stopCamera();
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: state.facing, width: { ideal: 640 }, height: { ideal: 480 } },
      // Barks and meows are exactly what noise suppression tries to remove.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (err) {
    setStatus("Camera or microphone permission was denied. You can upload a clip instead.", "error");
    throw err;
  }
  el.preview.srcObject = state.stream;
  el.preview.src = "";
  el.preview.muted = true;
  el.preview.controls = false;
  el.preview.play().catch(() => {});
  el.camPlaceholder.hidden = true;
  el.recBtn.disabled = false;
  el.flipBtn.hidden = false;
  el.camBtn.hidden = true;
}

function stopCamera() {
  state.stream?.getTracks().forEach((t) => t.stop());
  state.stream = null;
}

el.camBtn.addEventListener("click", () => startCamera().catch(() => {}));
el.flipBtn.addEventListener("click", () => {
  state.facing = state.facing === "environment" ? "user" : "environment";
  startCamera().catch(() => {});
});

el.recBtn.addEventListener("click", async () => {
  if (state.recorder) return state.recorder.stop();
  if (!state.stream) await startCamera();

  el.recBtn.disabled = true;
  el.countdown.hidden = false;
  for (const n of [3, 2, 1]) {
    el.countdown.textContent = n;
    await sleep(700);
  }
  el.countdown.hidden = true;

  const { rec, done } = makeRecorder(state.stream, 1_200_000);
  state.recorder = rec;
  rec.start(250);
  el.recDot.hidden = false;
  el.recBtn.disabled = false;
  let left = RECORD_SECONDS;
  el.recBtn.textContent = `Stop (${left}s)`;
  const tick = setInterval(() => {
    left -= 1;
    el.recBtn.textContent = `Stop (${left}s)`;
    if (left <= 0 && rec.state !== "inactive") rec.stop();
  }, 1000);

  const blob = await done;
  clearInterval(tick);
  state.recorder = null;
  el.recDot.hidden = true;
  el.recBtn.textContent = "Record again";

  stopCamera();
  el.preview.srcObject = null;
  el.preview.src = objectUrl(blob);
  el.preview.muted = false;
  el.preview.controls = true;
  el.preview.loop = true;
  el.preview.play().catch(() => {});
  el.camBtn.hidden = true;
  setMedia({ video: blob });
});

function setMedia(media) {
  state.media = media;
  el.go.disabled = !(media.video || media.audio || media.image);
  setStatus(el.go.disabled ? "" : "Ready. Hit Translate.");
}

async function onFiles(files) {
  const media = {};
  for (const f of files) {
    const kind = kindOf(f);
    if (kind && !media[kind]) media[kind] = f;
  }
  if (media.video) {
    delete media.audio; // a video already carries its own soundtrack
    delete media.image;
  }
  if (!media.video && !media.audio && !media.image) {
    return setStatus("That file type isn't supported. Try MP4, WebM, MOV, MP3, WAV, JPG or PNG.", "error");
  }
  el.go.disabled = true;
  try {
    setStatus("Preparing your clip...", "loading");
    if (media.video) media.video = await prepareVideo(media.video);
    if (media.image) media.image = await prepareImage(media.image);
    if (media.audio && media.audio.size > 8 * MB) throw new Error("That sound clip is too big (8 MB max).");
  } catch (err) {
    return setStatus(err.message || "Couldn't read that file.", "error");
  }

  el.uploadPreview.innerHTML = "";
  if (media.video) el.uploadPreview.append(Object.assign(document.createElement("video"), { src: objectUrl(media.video), controls: true, playsInline: true }));
  if (media.image) el.uploadPreview.append(Object.assign(document.createElement("img"), { src: objectUrl(media.image) }));
  if (media.audio) el.uploadPreview.append(Object.assign(document.createElement("audio"), { src: objectUrl(media.audio), controls: true }));
  setMedia(media);
}

el.file.addEventListener("change", () => onFiles([...el.file.files]));
["dragenter", "dragover"].forEach((ev) => el.drop.addEventListener(ev, (e) => { e.preventDefault(); el.drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => el.drop.addEventListener(ev, (e) => { e.preventDefault(); el.drop.classList.remove("over"); }));
el.drop.addEventListener("drop", (e) => onFiles([...e.dataTransfer.files]));

// ---------- translate ----------

el.go.addEventListener("click", translate);

async function translate() {
  if (state.busy) return;
  state.busy = true;
  el.go.disabled = true;
  let i = 0;
  setStatus(LOADING_LINES[0], "loading");
  const spinner = setInterval(() => setStatus(LOADING_LINES[++i % LOADING_LINES.length], "loading"), 900);

  const { video, audio, image } = state.media;
  const form = new FormData();
  if (video) form.append("video", video, `clip.${extFor(video.type || "video/mp4")}`);
  if (audio) form.append("audio", audio, audio.name || `clip.${extFor(audio.type)}`);
  if (image) form.append("image", image, "photo.jpg");
  form.append("name", el.name.value);
  form.append("context", el.context.value);
  form.append("local_time", new Date().toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" }));

  try {
    const t0 = performance.now();
    const res = await fetch("/api/translate", { method: "POST", body: form });
    const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
    if (!res.ok || !data.answers) throw new Error(data.error || "Translation failed.");
    state.roundTripMs = Math.round(performance.now() - t0);
    state.result = data;
    state.seed = Math.floor(Math.random() * 1e6) + 1;
    setStatus("");
    showResult();
  } catch (err) {
    setStatus(err.message || "Something went wrong.", "error");
  } finally {
    clearInterval(spinner);
    state.busy = false;
    el.go.disabled = false;
  }
}

// ---------- results ----------

function showResult() {
  const { video, audio, image } = state.media;
  const a = state.result.answers;

  el.exportLinks.innerHTML = "";
  el.resultStage.classList.toggle("audio-only", !video && !image);
  el.still.hidden = !image || !!video;
  el.playback.hidden = !video && !audio;
  if (video || audio) {
    el.playback.src = objectUrl(video || audio);
    el.playback.play().catch(() => {});
  } else {
    el.playback.removeAttribute("src");
  }
  if (image && !video) el.still.src = objectUrl(image);
  el.dlVideo.hidden = !video;

  renderCaption();

  const need = a.need;
  const ranked = Object.entries(need?.probabilities ?? {}).sort((x, y) => y[1] - x[1]);
  el.needBars.innerHTML = ranked
    .slice(0, 6)
    .map(([id, p], idx) => `<div class="bar ${idx === 0 ? "top" : ""}"><span class="lbl">${esc(NEED_LABELS[id] ?? id)}</span><span class="track"><span class="fill" data-w="${(p * 100).toFixed(1)}"></span></span><span class="pct">${pct(p)}</span></div>`)
    .join("");

  el.meters.innerHTML = ["intensity", "drama"]
    .map((id) => {
      const s = a[id];
      if (!s) return "";
      const levels = Object.keys(s.legend ?? {}).length || 5;
      const label = s.legend?.[String(Math.round(s.score))] ?? "";
      const left = (s.score / (levels - 1)) * 100;
      return `<div class="meter"><div class="head"><span>${id === "drama" ? "Drama" : "Intensity"}</span><b>${esc(label)}</b></div><div class="track"><span class="knob" data-left="${left.toFixed(1)}" style="left:0%"></span></div></div>`;
    })
    .join("");

  const chips = [];
  if (a.species) chips.push(["video", SPECIES_LABELS[a.species.choice] ?? a.species.choice, a.species.confidence]);
  if (a.vocalization) chips.push(["audio", VOCAL_LABELS[a.vocalization.choice] ?? a.vocalization.choice, a.vocalization.probabilities?.[a.vocalization.choice]]);
  const flags = [
    ["video", "staring_at_camera", "Staring at you"],
    ["video", "food_visible", "Food in sight"],
    ["video", "door_or_leash_visible", "Door or leash in sight"],
    ["video", "toy_visible", "Toy in sight"],
    ["audio", "human_talking", "Human narrating"],
  ];
  for (const [kind, id, label] of flags) if ((a[id]?.noul ?? 0) >= 0.5) chips.push([kind, label, a[id].noul]);
  el.chips.innerHTML = chips.map(([k, l, p]) => `<span class="chip ${k}">${esc(l)} <b>${pct(p)}</b></span>`).join("");

  const tokens = state.result.usage?.input_tokens ?? 0;
  const cost = (tokens / 1e6) * PRICE_PER_M_INPUT;
  el.stats.innerHTML = [
    [`${state.result.latency_ms ?? "?"} ms`, "model decision time"],
    [`${state.roundTripMs} ms`, "round trip incl. upload"],
    [tokens.toLocaleString(), "input tokens, 0 output"],
    [`$${cost < 0.01 ? cost.toFixed(5) : cost.toFixed(3)}`, "cost of this call"],
  ]
    .map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`)
    .join("");

  el.result.hidden = false;
  el.result.scrollIntoView({ behavior: "smooth", block: "start" });
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      el.needBars.querySelectorAll(".fill").forEach((f) => (f.style.width = `${f.dataset.w}%`));
      el.meters.querySelectorAll(".knob").forEach((k) => (k.style.left = `${k.dataset.left}%`));
    }),
  );
}

function renderCaption() {
  const a = state.result.answers;
  state.caption = buildCaption(a, { name: el.name.value, seed: state.seed });
  el.subtitle.innerHTML = `<span class="who">${esc(state.caption.speaker)}</span>${esc(state.caption.text)}`;
  el.subtitle.style.animation = "none";
  void el.subtitle.offsetWidth;
  el.subtitle.style.animation = "";
  el.verdictNeed.textContent = state.caption.need ? NEED_LABELS[state.caption.need] : "No pet found";
  el.verdictConf.textContent = a.need ? `${pct(a.need.confidence)} confident` : "";
}

el.reroll.addEventListener("click", () => {
  if (!state.result) return;
  const prev = state.caption?.text;
  for (let i = 0; i < 6; i++) {
    state.seed += 1;
    renderCaption();
    if (state.caption.text !== prev) break;
  }
  el.exportLinks.innerHTML = "";
});

el.again.addEventListener("click", () => {
  el.result.hidden = true;
  el.playback.pause();
  el.input.scrollIntoView({ behavior: "smooth" });
});

// ---------- export: captioned video + share card ----------

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

const FONT = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function drawSubtitle(ctx, w, h, { withBadge = true } = {}) {
  const cap = state.caption;
  const r = state.result;
  const base = Math.max(18, Math.round(Math.min(w, h * 1.3) * 0.055));

  const grad = ctx.createLinearGradient(0, h * 0.5, 0, h);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.font = `900 ${base}px ${FONT}`;
  const lines = wrapLines(ctx, cap.text, w * 0.88).slice(0, 5);
  const lh = base * 1.2;
  let y = h - h * 0.07 - (lines.length - 1) * lh;

  ctx.font = `800 ${Math.round(base * 0.62)}px ${FONT}`;
  ctx.fillStyle = "#ffe14d";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = Math.max(3, base * 0.14);
  const who = cap.speaker.toUpperCase();
  ctx.strokeText(who, w / 2, y - lh * 0.95);
  ctx.fillText(who, w / 2, y - lh * 0.95);

  ctx.font = `900 ${base}px ${FONT}`;
  ctx.fillStyle = "#fff";
  ctx.lineWidth = Math.max(4, base * 0.18);
  for (const line of lines) {
    ctx.strokeText(line, w / 2, y);
    ctx.fillText(line, w / 2, y);
    y += lh;
  }

  if (!withBadge) return;
  const pad = Math.round(base * 0.45);
  const small = Math.round(base * 0.5);
  ctx.font = `800 ${small}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const label = "PET TRANSLATOR";
  const lw = ctx.measureText(label).width + pad * 2;
  ctx.fillStyle = "#f6821f";
  roundRect(ctx, pad, pad, lw, small * 2, small);
  ctx.fill();
  ctx.fillStyle = "#1b1004";
  ctx.fillText(label, pad * 2, pad + small);

  const needTxt = cap.need ? `${NEED_LABELS[cap.need]} ${pct(r.answers.need?.confidence)}` : "";
  const right = `${needTxt}${needTxt ? "  ·  " : ""}Clef-omni ${r.latency_ms}ms`;
  const rw = ctx.measureText(right).width + pad * 2;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, w - pad - rw, pad, rw, small * 2, small);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(right, w - rw, pad + small);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function offerDownload(blob, filename, label) {
  const url = objectUrl(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename, textContent: `Save ${label}` });
  el.exportLinks.append(a);
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    const share = Object.assign(document.createElement("button"), { textContent: `Share ${label}` });
    share.addEventListener("click", () =>
      navigator.share({ files: [file], title: "Pet Translator", text: `"${state.caption.text}"` }).catch(() => {}),
    );
    el.exportLinks.append(share);
  }
}

el.dlVideo.addEventListener("click", async () => {
  if (!state.media.video) return;
  el.dlVideo.disabled = true;
  const label = el.dlVideo.textContent;
  el.dlVideo.textContent = "Rendering (plays once)...";
  el.exportLinks.innerHTML = "";
  el.playback.pause();
  try {
    const blob = await renderVideo(state.media.video, {
      maxSec: 60,
      longSide: 1080,
      bitrate: 5_000_000,
      overlay: (ctx, w, h) => drawSubtitle(ctx, w, h),
    });
    offerDownload(blob, `pet-translation.${extFor(blob.type)}`, "video");
  } catch (err) {
    setStatus(`Couldn't render the video: ${err.message}`, "error");
  } finally {
    el.dlVideo.disabled = false;
    el.dlVideo.textContent = label;
  }
});

el.dlCard.addEventListener("click", async () => {
  const W = 1080, H = 1350, MH = 900;
  const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1b1410";
  ctx.fillRect(0, 0, W, H);

  // media frame (cover-fit)
  const src = state.media.video ? el.playback : state.media.image ? el.still : null;
  const sw = src?.videoWidth || src?.naturalWidth;
  const sh = src?.videoHeight || src?.naturalHeight;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, MH);
  ctx.clip();
  if (src && sw) {
    const s = Math.max(W / sw, MH / sh);
    ctx.drawImage(src, (W - sw * s) / 2, (MH - sh * s) / 2, sw * s, sh * s);
  } else {
    const g = ctx.createRadialGradient(W / 2, MH * 0.4, 50, W / 2, MH * 0.4, 700);
    g.addColorStop(0, "#3a2a1f");
    g.addColorStop(1, "#120c09");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, MH);
  }
  drawSubtitle(ctx, W, MH);
  ctx.restore();

  // probability bars
  const a = state.result.answers;
  const ranked = Object.entries(a.need?.probabilities ?? {}).sort((x, y) => y[1] - x[1]).slice(0, 3);
  let y = MH + 70;
  ctx.textBaseline = "middle";
  ranked.forEach(([id, p], i) => {
    ctx.textAlign = "left";
    ctx.font = `${i === 0 ? 900 : 700} 38px ${FONT}`;
    ctx.fillStyle = i === 0 ? "#fbad41" : "#bda997";
    ctx.fillText(NEED_LABELS[id] ?? id, 60, y);
    ctx.fillStyle = "#33261e";
    roundRect(ctx, 400, y - 14, 500, 28, 14);
    ctx.fill();
    ctx.fillStyle = i === 0 ? "#f6821f" : "#4a382c";
    roundRect(ctx, 400, y - 14, Math.max(28, 500 * p), 28, 14);
    ctx.fill();
    ctx.textAlign = "right";
    ctx.fillStyle = "#fbf3ea";
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText(pct(p), W - 60, y);
    y += 74;
  });

  ctx.textAlign = "center";
  ctx.font = `700 28px ${FONT}`;
  ctx.fillStyle = "#bda997";
  const tokens = state.result.usage?.input_tokens ?? 0;
  ctx.fillText(`Decided by Clef-omni in ${state.result.latency_ms} ms · ${tokens.toLocaleString()} tokens · 0 generated`, W / 2, H - 50);

  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  el.exportLinks.innerHTML = "";
  offerDownload(blob, "pet-translation.png", "card");
});
