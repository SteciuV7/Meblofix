import { storagePathToFileName } from "@/components/reklamacje/AttachmentDropzone";
import { getPublicStorageUrl } from "@/lib/storage";
import Image from "next/image";

export default function StoredImageTile({
  path,
  fallbackName = "Zdjecie",
  imageClassName = "h-36",
  onClick,
}) {
  const url = getPublicStorageUrl(path);

  if (!url) {
    return null;
  }

  const fileName = storagePathToFileName(path, fallbackName);

  return (
    <button
      type="button"
      onClick={() => onClick?.({ name: fileName, path, url })}
      className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <Image
        src={url}
        alt={fileName}
        width={1200}
        height={900}
        unoptimized
        className={`${imageClassName} w-full object-cover`}
      />
      <div className="border-t border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
        {fileName}
      </div>
    </button>
  );
}
