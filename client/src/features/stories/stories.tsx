import { ScrollRail } from "../../components/scroll-rail";
import { t, number } from "../../i18n/i18n";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Heart, Plus, Search, Clock3 } from "lucide-react";
import {
  storiesSnapshot,
  readStoryPhotos,
  useData,
  useSnapshot,
} from "../../app/api";
import { previewMode } from "../../app/preview";
import { PageIntro, Modal, Notice, date } from "../../components/ui";
import {
  matchesStory,
  storyPageSize,
  type PublishedStoryEntry,
} from "../../../../shared/public-views";

export function Stories() {
  const {
    stories: sampleStories,
    loading: sampleLoading,
    error: sampleError,
  } = useData();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const snapshot = useSnapshot(storiesSnapshot, !previewMode);
  const entries = useMemo(
    () =>
      previewMode
        ? sampleStories.map(({ photos, ...story }) => ({
            ...story,
            cover: photos[0] ?? null,
            photoCount: photos.length,
          }))
        : (snapshot?.data ?? []),
    [sampleStories, snapshot?.data],
  );
  const matches = useMemo(() => {
    const query = q.toLowerCase();
    return query ? entries.filter((s) => matchesStory(s, query)) : entries;
  }, [entries, q]);
  const offset = page * storyPageSize;
  const items = matches.slice(offset, offset + storyPageSize);
  const next = offset + storyPageSize < matches.length;
  const selected = entries.find((s) => s.id === selectedId);
  const loading = previewMode ? sampleLoading : !snapshot;
  const failed = previewMode ? !!sampleError : snapshot?.error;
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow={t("OUR STORIES")}
        title={
          <>
            {t("Stories from")} {t("people waiting.")}
          </>
        }
        text={t(
          "A missed birthday. Another year in separate homes. Families share what the wait has cost them.",
        )}
      >
        <Link className="button coral" to="/account#story">
          {t("Share your story ")}
          <Plus size={18} />
        </Link>
      </PageIntro>
      <div className="toolbar">
        <span>
          {loading || failed
            ? null
            : matches.length === 1
              ? t("1 community story")
              : t("{count} community stories", {
                  count: number(matches.length),
                })}
        </span>
        <label className="search">
          <Search size={16} />
          <input
            aria-label={t("Search stories")}
            value={q}
            maxLength={250}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder={t("Search places, stories, or experiences")}
          />
        </label>
      </div>
      {failed ? (
        <Notice tone="error">
          {t("Something went wrong. Please try again.")}
        </Notice>
      ) : loading ? (
        <p role="status">{t("Loading…")}</p>
      ) : items.length ? (
        <div className="story-grid">
          {items.map((s) => (
            <button
              key={s.id}
              className="story-card"
              onClick={() => setSelectedId(s.id)}
            >
              <div className="story-card-media">
                {s.cover ? (
                  <img
                    src={s.cover}
                    alt={t("Photo shared by {name}", { name: s.name })}
                    loading="lazy"
                  />
                ) : (
                  <div className="story-art">
                    <Heart size={62} />
                  </div>
                )}
              </div>
              <div className="story-caption">
                <span className="eyebrow">
                  {t(s.country)} · {s.name}
                </span>
                <h3 dir="auto">{s.title}</h3>
                <span className="read-story">
                  {t("Read their story ")}
                  <ArrowUpRight size={18} />
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="story-empty">
          <div className="story-placeholder one">
            <Heart size={60} />
            <span>{t("Living apart")}</span>
          </div>
          <div className="story-placeholder two">
            <Clock3 size={60} />
            <span>{t("Plans on hold")}</span>
          </div>
          <div className="story-invite">
            <span className="eyebrow">{t("COMMUNITY STORIES")}</span>
            <h2>
              {q ? t("No matching stories.") : t("No stories published yet.")}
            </h2>
            <p>
              {t(
                "Tell your story in your own words and add photos if you like. You decide when to publish.",
              )}
            </p>
            <Link className="text-button" to="/account#story">
              {t("Share your experience ")}
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      )}
      {(next || page > 0) && (
        <div className="story-navigation">
          {page > 0 && (
            <button
              className="button outline"
              onClick={() => setPage((p) => p - 1)}
            >
              {t("Previous stories")}
            </button>
          )}
          {next && (
            <button
              className="button outline"
              onClick={() => setPage((p) => p + 1)}
            >
              {t("More stories")}
            </button>
          )}
        </div>
      )}
      <p className="method-note">
        {t(
          "Community stories and external sources remain in their original language.",
        )}{" "}
        {t(
          "Stories are self-reported and are not independently verified. Sharing here does not send your story to a lawyer, political group, or representative.",
        )}
      </p>
      {selected && (
        <StoryDialog
          key={selected.id}
          selected={selected}
          samplePhotos={sampleStories.find((s) => s.id === selected.id)?.photos}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function StoryDialog({
  selected,
  samplePhotos,
  onClose,
}: {
  selected: PublishedStoryEntry;
  samplePhotos?: string[];
  onClose: () => void;
}) {
  const source = useMemo(
    () => ({
      read: () => readStoryPhotos(selected.id, selected.updatedAt),
    }),
    [selected.id, selected.updatedAt],
  );
  const loadPhotos = !previewMode && selected.photoCount > 0;
  const media = useSnapshot(source, loadPhotos);
  const photos = samplePhotos ?? media?.data ?? [];
  return (
    <Modal title={t("A COMMUNITY STORY")} wide onClose={onClose}>
      <div className="story-modal">
        {media?.error ? (
          <Notice tone="error">
            {t("Something went wrong. Please try again.")}
          </Notice>
        ) : loadPhotos && !media ? (
          <p role="status">{t("Loading…")}</p>
        ) : null}
        {photos.length > 0 && (
          <div className="story-photos">
            {photos.length === 1 ? (
              <img
                src={photos[0]}
                alt={t("Photo shared by {name}", { name: selected.name })}
              />
            ) : (
              <ScrollRail
                id="story-photo-carousel"
                title={t("Story photos")}
                previousLabel={t("Previous photo")}
                nextLabel={t("Next photo")}
              >
                {photos.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={t("Photo {count} shared by {name}", {
                      count: i + 1,
                      name: selected.name,
                    })}
                  />
                ))}
              </ScrollRail>
            )}
          </div>
        )}
        <span className="eyebrow">
          {selected.name} · {t(selected.country)}
        </span>
        <h2 dir="auto">{selected.title}</h2>
        <p className="preserve-lines" dir="auto">
          {selected.body}
        </p>
        <div className="tags">
          {selected.impacts.map((x) => (
            <span className="tag" key={x}>
              {x}
            </span>
          ))}
        </div>
        {selected.support && (
          <>
            <h3>{t("The support they’re looking for")}</h3>
            <p className="preserve-lines" dir="auto">
              {selected.support}
            </p>
          </>
        )}
        <small>
          {t("Story last updated ")}
          {date(selected.updatedAt)}
        </small>
      </div>
    </Modal>
  );
}
