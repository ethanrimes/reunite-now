import { Router } from "express";
import { z } from "zod";
import {
  matchesStory,
  storyPageSize,
  type PublishedStoryEntry,
  type StoryCard,
} from "../../shared/public-views";
import type { PublicStory } from "../../shared/schema";
import { publicDb } from "../storage/db";
import { acrossRegions, routed } from "../storage/regions";

type StoryRow = Omit<PublishedStoryEntry, "updatedAt" | "photoCount"> & {
  updated_at: Date | string;
  photo_count: number;
};

const byId = (a: StoryCard, b: StoryCard) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export function publicStoryRoutes(samples: PublicStory[]) {
  const router = Router();
  router.get("/stories/snapshot", async (_req, res) => {
    const result = await routed(false, () =>
      acrossRegions(() =>
        publicDb.query<StoryRow>(
          `SELECT id,title,body,support,impacts,updated_at,name,country,cover,
                  coalesce(jsonb_array_length(photos),0) AS photo_count
           FROM public.rn_published_stories`,
        ),
      ),
    );
    const entries = [
      ...result.flatMap(({ rows }) =>
        rows.map(({ updated_at, photo_count, ...entry }) => ({
          ...entry,
          updatedAt: new Date(updated_at).toISOString(),
          photoCount: photo_count,
        })),
      ),
      ...samples.map(({ photos, ...entry }) => ({
        ...entry,
        cover: photos[0] ?? null,
        photoCount: photos.length,
      })),
    ];
    res.json(entries.sort(byId));
  });

  router.get("/story-cards", async (req, res) => {
    const { after, q } = z
      .object({
        after: z.string().max(80).default(""),
        q: z.string().max(250).default(""),
      })
      .parse(req.query);
    const result = await routed(false, () =>
      acrossRegions(() =>
        publicDb.query<StoryCard>(
          `SELECT id,title,country,name,cover FROM public.rn_published_stories
           WHERE id > $1 AND ($2='' OR strpos(lower(concat_ws(' ',title,body,name,country,impacts::text)),lower($2)) > 0)
           ORDER BY id LIMIT $3`,
          [after, q, storyPageSize + 1],
        ),
      ),
    );
    const query = q.toLowerCase();
    const cards = [
      ...result.flatMap(({ rows }) => rows),
      ...samples
        .filter((s) => s.id > after && matchesStory(s, query))
        .map(({ id, name, title, country, photos }) => ({
          id,
          name,
          title,
          country,
          cover: photos[0] ?? null,
        })),
    ].sort(byId);
    res.json({
      cards: cards.slice(0, storyPageSize),
      next: cards.length > storyPageSize ? cards[storyPageSize - 1].id : null,
    });
  });

  router.get("/story/:id/photo/:index", async (req, res) => {
    const { id, index } = req.params;
    if (!z.uuid().safeParse(id).success || !/^[0-3]$/.test(index))
      return void res.sendStatus(404);
    const result = await routed(false, () =>
      acrossRegions(() =>
        publicDb.query<{ photo: string | null }>(
          `SELECT photos->>$2::int AS photo FROM public.rn_published_stories WHERE id=$1`,
          [id, Number(index)],
        ),
      ),
    );
    const photo = result.flatMap((r) => r.rows)[0]?.photo;
    if (!photo) return void res.sendStatus(404);
    res
      .type("image/webp")
      .send(Buffer.from(photo.slice(photo.indexOf(",") + 1), "base64"));
  });

  router.get("/story/:id/photos", async (req, res) => {
    const { id } = req.params;
    const fixture = samples.find((s) => s.id === id);
    if (fixture) return void res.json(fixture.photos);
    if (!z.uuid().safeParse(id).success) return void res.sendStatus(404);
    const result = await routed(false, () =>
      acrossRegions(() =>
        publicDb.query<{ photos: string[] | null }>(
          "SELECT photos FROM public.rn_published_stories WHERE id=$1",
          [id],
        ),
      ),
    );
    const row = result.flatMap(({ rows }) => rows)[0];
    if (!row) return void res.sendStatus(404);
    res.json(row.photos ?? []);
  });

  router.get("/story/:id", async (req, res) => {
    const { id } = req.params;
    const fixture = samples.find((s) => s.id === id);
    if (fixture) return void res.json(fixture);
    if (!z.uuid().safeParse(id).success) return void res.sendStatus(404);
    const inlinePhotos = req.query.photos === "inline";
    const result = await routed(false, () =>
      acrossRegions(() =>
        publicDb.query<
          Omit<StoryRow, "cover" | "id"> & { photos: string[] | null }
        >(
          `SELECT title,body,support,impacts,updated_at,name,country,
                  CASE WHEN $2::boolean THEN photos END AS photos, coalesce(jsonb_array_length(photos),0) AS photo_count
           FROM public.rn_published_stories WHERE id=$1`,
          [id, inlinePhotos],
        ),
      ),
    );
    const row = result.flatMap((r) => r.rows)[0];
    if (!row) return void res.sendStatus(404);
    const { title, body, support, impacts } = row;
    res.json({
      id,
      title,
      body,
      support,
      impacts,
      photos:
        row.photos ??
        Array.from(
          { length: row.photo_count },
          (_, i) => `/api/story/${id}/photo/${i}`,
        ),
      updatedAt: row.updated_at,
      name: row.name,
      country: row.country,
    });
  });
  return router;
}
