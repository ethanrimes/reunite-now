import sharp from "sharp";
import { db } from "../storage/db";

export async function cleanStoryPhoto(photo: string) {
  const comma = photo.indexOf(",");
  const bytes = Buffer.from(photo.slice(comma + 1), "base64");
  const format = photo.slice("data:image/".length, photo.indexOf(";"));
  try {
    // Only invoke decoders for the three raster formats accepted by the form.
    const signature =
      format === "jpeg"
        ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
        : format === "png"
          ? bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
          : format === "webp" &&
            bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP";
    if (!signature) throw new Error();
    const raster = sharp(bytes, {
      limitInputPixels: 16_000_000,
      failOn: "error",
    })
      .autoOrient()
      .resize(1400, 1400, { fit: "inside", withoutEnlargement: true });
    const output = await raster.webp({ quality: 85 }).toBuffer();
    const result = "data:image/webp;base64," + output.toString("base64");
    if (result.length > 1500000) throw new Error();
    return result;
  } catch {
    throw Object.assign(
      new Error("Choose a smaller, valid JPG, PNG, or WebP photo."),
      { status: 400 },
    );
  }
}

export async function storyCover(photo?: string) {
  if (!photo) return null;
  const bytes = Buffer.from(photo.slice(photo.indexOf(",") + 1), "base64");
  const cover = await sharp(bytes)
    .resize(480, 360, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 68 })
    .toBuffer();
  return "data:image/webp;base64," + cover.toString("base64");
}

// Re-encode historical photos once. An unreadable original stays in the owner's
// export, while the public endpoint withholds unverified photos.
export async function cleanHistoricalStoryPhotos() {
  const { rows } = await db.query(
    "SELECT user_id FROM stories WHERE data->>'photosCleaned' IS DISTINCT FROM 'true' OR NOT (data ? 'cover')",
  );
  for (const { user_id } of rows) {
    const result = await db.query("SELECT data FROM stories WHERE user_id=$1", [
      user_id,
    ]);
    const original = result.rows[0]?.data;
    if (!original || (original.photosCleaned === true && "cover" in original))
      continue;
    const photos: string[] = [];
    let cover;
    try {
      for (const photo of original.photos ?? [])
        photos.push(
          original.photosCleaned === true
            ? photo
            : await cleanStoryPhoto(photo),
        );
      cover = await storyCover(photos[0]);
    } catch {
      console.error("A historical story photo needs owner review");
      continue;
    }
    await db.query("UPDATE stories SET data=$1 WHERE user_id=$2 AND data=$3", [
      JSON.stringify({ ...original, photos, cover, photosCleaned: true }),
      user_id,
      JSON.stringify(original),
    ]);
  }
}
