import { Buffer } from "node:buffer";
import { QUESTIONS, buildState } from "./questions.ts";

// `Env` (AI, ASSETS, RATE_LIMITER) is inferred from cloudflare.config.ts
// via `cf workers types` -> .cloudflare/types/index.d.ts.

const MODEL = "@cf/cloudflare/clef-omni";
const MB = 1024 * 1024;
// Clef-omni limits: audio+video <= 16 MiB decoded total; images <= 4 MiB each.
const MAX_AV_BYTES = 16 * MB;
const MAX_IMAGE_BYTES = 4 * MB;

type MediaKind = "video" | "audio" | "image";

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/translate") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      return translate(request, env);
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function translate(request: Request, env: Env): Promise<Response> {
  if (env.RATE_LIMITER) {
    const key = request.headers.get("cf-connecting-ip") ?? "anonymous";
    const { success } = await env.RATE_LIMITER.limit({ key });
    if (!success) return json({ error: "Too many translations. Give your pet a minute to rest." }, 429);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Expected multipart form data." }, 400);
  }

  const video = fileField(form, "video");
  const audio = fileField(form, "audio");
  const image = fileField(form, "image");
  if (!video && !audio && !image) {
    return json({ error: "Send a video, a sound clip, or a photo of your pet." }, 400);
  }
  if ((video?.size ?? 0) + (audio?.size ?? 0) > MAX_AV_BYTES) {
    return json({ error: "That clip is too big (16 MB max). Try a shorter one." }, 413);
  }
  if (image && image.size > MAX_IMAGE_BYTES) {
    return json({ error: "That photo is too big (4 MB max)." }, 413);
  }

  const mediaDesc: string[] = [];
  if (video) mediaDesc.push("a video clip of the pet with its soundtrack");
  if (image) mediaDesc.push("a photo of the pet");
  if (audio) mediaDesc.push("an audio recording of the pet");

  const input: Record<string, unknown> = {
    model: "clef-omni",
    state: buildState({
      name: textField(form, "name", 40),
      context: textField(form, "context", 200),
      localTime: textField(form, "local_time", 60),
      media: mediaDesc,
    }),
    questions: QUESTIONS,
  };
  if (video) input.videos = [await toDataUrl(video, contentType(video, "video"))];
  if (audio) input.audio = [await toDataUrl(audio, contentType(audio, "audio"))];
  if (image) input.images = [await toDataUrl(image, contentType(image, "image"))];

  const started = Date.now();
  try {
    const raw = (await (env.AI as unknown as { run: (m: string, i: unknown) => Promise<unknown> }).run(
      MODEL,
      input,
    )) as Record<string, unknown>;
    const result = (raw && typeof raw === "object" && "result" in raw ? raw.result : raw) as Record<string, unknown>;
    return json({ ...result, latency_ms: Date.now() - started });
  } catch (err) {
    console.error("clef-omni request failed", err);
    return json(
      { error: "The translator couldn't understand that clip. Try a short MP4 or WebM with sound." },
      502,
    );
  }
}

function fileField(form: FormData, name: string): File | null {
  const value = form.get(name) as unknown;
  return value instanceof File && value.size > 0 ? value : null;
}

function textField(form: FormData, name: string, max: number): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function ext(name: string): string {
  return name.toLowerCase().split(".").pop() ?? "";
}

// Browsers report all sorts of MIME strings (codecs params, quicktime, empty).
// Normalize to what Clef-omni accepts.
function contentType(file: File, kind: MediaKind): string {
  const type = (file.type || "").split(";")[0].trim().toLowerCase();
  const e = ext(file.name);
  if (kind === "video") {
    if (type === "video/webm" || e === "webm") return "video/webm";
    return "video/mp4"; // mp4, m4v, and iPhone .mov (same ISO-BMFF container family)
  }
  if (kind === "audio") {
    if (type.startsWith("audio/")) return type;
    const byExt: Record<string, string> = {
      mp3: "audio/mpeg",
      wav: "audio/wav",
      m4a: "audio/mp4",
      mp4: "audio/mp4",
      ogg: "audio/ogg",
      webm: "audio/webm",
    };
    return byExt[e] ?? (type.includes("webm") ? "audio/webm" : "audio/mpeg");
  }
  if (type === "image/png" || type === "image/webp" || type === "image/jpeg") return type;
  return e === "png" ? "image/png" : e === "webp" ? "image/webp" : "image/jpeg";
}

async function toDataUrl(file: File, type: string): Promise<string> {
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  return `data:${type};base64,${base64}`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
