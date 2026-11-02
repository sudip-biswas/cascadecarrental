import { createAdminClient } from "@/lib/supabase/admin";
import { INSPECTION_BUCKET } from "@/lib/inspections";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

export const PHOTOS_MAX = 6;
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** Some phones send HEIC with no type, so fall back to the file name. */
function photoType(file: File) {
  if (EXTENSIONS[file.type]) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ext === "heic" || ext === "heif" ? "image/heic" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : null;
}

/** The photos in a form, or what's wrong with them. */
export function readPhotos(form: FormData): { files: File[]; types: string[]; error?: never } | { error: string } {
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > PHOTOS_MAX) return { error: `Up to ${PHOTOS_MAX} photos.` };
  const types: string[] = [];
  for (const file of files) {
    const type = photoType(file);
    if (!type) return { error: "Photos have to be JPG, PNG, WebP or HEIC." };
    if (file.size > PHOTO_MAX_BYTES) return { error: "Each photo has to be under 10 MB." };
    types.push(type);
  }
  return { files, types };
}

/** Puts photos in the private trip bucket. All of them go up, or none stay. */
export async function uploadPhotos(tripId: string, folder: string, files: File[], types: string[]): Promise<string[] | null> {
  const storage = createAdminClient().storage.from(INSPECTION_BUCKET);
  const paths: string[] = [];
  for (const [i, file] of files.entries()) {
    const path = `${tripId}/${folder}/${crypto.randomUUID()}.${EXTENSIONS[types[i]]}`;
    const { error } = await storage.upload(path, file, { contentType: types[i], upsert: false });
    if (error) {
      if (paths.length) await storage.remove(paths);
      return null;
    }
    paths.push(path);
  }
  return paths;
}

export async function removePhotos(paths: string[]) {
  if (paths.length) await createAdminClient().storage.from(INSPECTION_BUCKET).remove(paths);
}
