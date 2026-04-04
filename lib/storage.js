import { STORAGE_BUCKET, STORAGE_PUBLIC_PREFIX } from "@/lib/constants";

export function getPublicStorageUrl(path) {
  if (!path) return null;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return null;
  return `${baseUrl}${STORAGE_PUBLIC_PREFIX}/${STORAGE_BUCKET}/${path}`;
}
