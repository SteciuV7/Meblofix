import imageCompression from "browser-image-compression";
import { removePolishCharacters } from "@/lib/utils";
import { STORAGE_BUCKET } from "@/lib/constants";
import { supabase } from "@/lib/supabase";

async function compressImage(file) {
  if (!file.type.startsWith("image/")) return file;

  return imageCompression(file, {
    maxSizeMB: 0.7,
    maxWidthOrHeight: 1400,
    useWebWorker: true,
  });
}

export async function uploadFiles(files, folder) {
  const uploaded = [];
  for (const sourceFile of files) {
    if (!sourceFile) continue;
    const file = await compressImage(sourceFile);
    const fileName = removePolishCharacters(file.name || "plik");
    const filePath = `${folder}/${Date.now()}-${fileName}`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw error;
    }

    uploaded.push(filePath);
  }

  return uploaded;
}
