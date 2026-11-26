import { ScrollRail } from "../../components/scroll-rail";
import { t, number } from "../../i18n/i18n";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Heart, Plus, Search, Clock3 } from "lucide-react";
import {
  readStoryPage,
  readStoryDetail,
  useSnapshot,
  useData,
} from "../../app/api";
import { previewMode } from "../../app/preview";
import { PageIntro, Modal, Notice, date } from "../../components/ui";
import { matchesStory } from "../../../../shared/public-views";
import { type PublicStory } from "../../../../shared/schema";

export function Stories() {
  const {
    stories: sampleStories,
    loading: sampleLoading,
    error: sampleError,
  } = useData();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (q === query) return;
    const timer = setTimeout(() => {
      setQuery(q);
      setCursors([""]);
    }, 200);
    return () => clearTimeout(timer);
  }, [q, query]);
  const [cursors, setCursors] = useState([""]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cursor = cursors.at(-1) ?? "";
  const source = useMemo(
    () => ({ read: () => readStoryPage(query, cursor) }),
    [query, cursor],
  );
  const page = useSnapshot(source, !previewMode);
  const items = previewMode
    ? sampleStories
        .filter((s) => matchesStory(s, q.toLowerCase()))
        .map((s) => ({ ...s, cover: s.photos[0] }))
    : (page?.data?.cards ?? []);
  const loading = previewMode ? sampleLoading : !page;
  const failed = previewMode ? !!sampleError : page?.error;
  const next = page?.data?.next;
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
          {loading || failed || next || cursors.length > 1
            ? null
            : items.length === 1
              ? t("1 community story")
              : t("{count} community stories", {
                  count: number(items.length),
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
      {(next || cursors.length > 1) && (
        <div className="story-navigation">
          {cursors.length > 1 && (
            <button
              className="button outline"
              onClick={() => setCursors((c) => c.slice(0, -1))}
            >
              {t("Previous stories")}
            </button>
          )}
          {next && (
            <button
              className="button outline"
              onClick={() => setCursors((c) => [...c, next])}
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
      {selectedId && (
        <StoryDialog
          key={selectedId}
          id={selectedId}
          sample={sampleStories.find((s) => s.id === selectedId)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function StoryDialog({
  id,
  sample,
  onClose,
}: {
  id: string;
  sample?: PublicStory;
  onClose: () => void;
}) {
  const source = useMemo(() => ({ read: () => readStoryDetail(id) }), [id]);
  const detail = useSnapshot(source, !previewMode);
  const selected = previewMode ? sample : detail?.data;
  return (
    <Modal title={t("A COMMUNITY STORY")} wide onClose={onClose}>
      {detail?.error ? (
        <Notice tone="error">
          {t("Something went wrong. Please try again.")}
        </Notice>
      ) : !selected ? (
        <p role="status">{t("Loading…")}</p>
      ) : null}
      {selected && (
        <div className="story-modal">
          {selected.photos.length > 0 && (
            <div className="story-photos">
              {selected.photos.length === 1 ? (
                <img
                  src={selected.photos[0]}
                  alt={t("Photo shared by {name}", { name: selected.name })}
                />
              ) : (
                <ScrollRail
                  id="story-photo-carousel"
                  title={t("Story photos")}
                  previousLabel={t("Previous photo")}
                  nextLabel={t("Next photo")}
                >
                  {selected.photos.map((src, i) => (
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
      )}
    </Modal>
  );
}
