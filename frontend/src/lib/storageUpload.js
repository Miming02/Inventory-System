import { supabase } from "./supabase";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — align with migration file_size_limit if set
const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function safeFileName(name) {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 180);
}

/**
 * Upload a file to the private `attachments` bucket under `{userId}/{kind}/...`.
 * Requires Storage bucket + policies from migration `004_storage_attachments.sql`.
 * @param {string} userId - auth user id
 * @param {File} file
 * @param {string} [kind] - subfolder e.g. "receive", "delivery"
 */
export async function uploadAttachment(userId, file, kind = "general") {
  if (!userId || !file) {
    throw new Error("Missing file or user.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (max ${MAX_BYTES / 1024 / 1024} MB).`);
  }
  if (file.type && !ALLOWED.includes(file.type)) {
    throw new Error("File type not allowed. Use PDF, image, or spreadsheet.");
  }

  const path = `${userId}/${kind}/${Date.now()}-${safeFileName(file.name)}`;
  const { data, error } = await supabase.storage.from("attachments").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;
  return { path: data.path, bucket: "attachments" };
}
