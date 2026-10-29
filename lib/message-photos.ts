/** Photos in messages. Safe to import from browser code. The database holds the same limits. */
export const MESSAGE_PHOTO_BUCKET = "message-photos";

export const MESSAGE_PHOTO_LIMITS = {
  perMessage: 6,
  photoMaxBytes: 10 * 1024 * 1024,
} as const;

/** How long a photo link works. Long enough to scroll back through a thread. */
export const MESSAGE_PHOTO_URL_SECONDS = 60 * 60;

export const MESSAGE_PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

/** "<sender id>/<uuid>.<ext>", as the upload route names them. */
export const MESSAGE_PHOTO_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|heic)$/;

/** What a conversation list shows for a message: its words, or what it sent. */
export function messagePreview(m: { body: string; photos?: string[] | null }): string {
  if (m.body.trim()) return m.body;
  const n = m.photos?.length ?? 0;
  return n > 1 ? `Sent ${n} photos` : "Sent a photo";
}
