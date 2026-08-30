"use client";

import { getApp } from "firebase/app";
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "firebase/storage";

/** Cover images are shown at card size; anything past this is wasted bytes. */
const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export class UploadError extends Error {}

/**
 * Uploads an event cover to Firebase Storage and returns its download URL.
 *
 * Validated here for a fast, specific error message — but the same limits are
 * enforced in `storage.rules`, because anything checked only in the browser is
 * not checked at all. The path is namespaced by uid so the rules can grant a
 * student write access to their own folder and nowhere else.
 */
export async function uploadEventCover({
  file,
  uid,
  onProgress,
}: {
  file: File;
  uid: string;
  onProgress?: (percent: number) => void;
}): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new UploadError("Cover must be a JPG, PNG, WebP or AVIF image.");
  }

  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new UploadError(`That image is ${mb} MB. Keep covers under 5 MB.`);
  }

  const storage = getStorage(getApp());
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `event-covers/${uid}/${crypto.randomUUID()}.${extension}`;

  const task = uploadBytesResumable(ref(storage, path), file, {
    contentType: file.type,
    // Covers are immutable once uploaded — a new proposal gets a new UUID — so
    // they can be cached hard.
    cacheControl: "public, max-age=31536000, immutable",
  });

  return new Promise<string>((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        if (snapshot.totalBytes > 0) {
          onProgress?.(
            Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
          );
        }
      },
      (error) => {
        reject(
          new UploadError(
            error.code === "storage/unauthorized"
              ? "You do not have permission to upload. Try signing in again."
              : "Upload failed. Check your connection and try again.",
          ),
        );
      },
      () => {
        getDownloadURL(task.snapshot.ref).then(resolve, () =>
          reject(new UploadError("Upload finished but the link could not be read.")),
        );
      },
    );
  });
}
