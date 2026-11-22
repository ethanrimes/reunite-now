import { t } from "./i18n";
import { useState, useEffect, type FormEvent } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowUpRight,
  Mail,
  ShieldCheck,
  Plus,
  Trash2,
  Download,
  LogOut,
  Camera,
  Heart,
  ChevronDown,
} from "lucide-react";
import { api, useData } from "./api";
import { PageIntro, Field, Notice, Modal } from "./ui";
import {
  states,
  legalStatuses,
  visaCategories,
  eventTypes,
  reminderEmailSchema,
  profileSections,
  type ProfileSection,
  type Profile,
  type VisaCase,
  type VisaEvent,
  type Story,
} from "../../shared/schema";
import {
  rolesFor,
  relationshipsFor,
  applyTemplate,
  milestoneLabel,
  milestonesFor,
  mayHavePauseHistory,
  pauseSource,
  pauseSteps,
  addPauseSteps,
  type CaseRole,
} from "../../shared/visa-workflow";
import postsDirectory from "../../shared/posts.json";
import countries from "../../shared/countries.json";
import { caseStatus } from "../../shared/metrics";
export function Login() {
  const { me, config, loading } = useData();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState("");
  const [params] = useSearchParams();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/auth/email", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
      setDevLink(r.devLink || "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-art">
        <span className="eyebrow">{t("REUNITE NOW")}</span>
        <h1>
          {t("Help change")} {t("the process.")}
        </h1>
        <div className="auth-heart">
          <Heart size={110} />
        </div>
        <p>
          {t("Sign the petition and keep")}{" "}
          {t("your visa timeline up to date.")}
        </p>
      </div>
      <div className="auth-form">
        <span className="eyebrow">{t("SIGN IN OR CREATE AN ACCOUNT")}</span>
        <h2>
          {params.get("intent") === "sign"
            ? t("Sign the petition")
            : t("Log in")}
        </h2>
        <p>
          {t(
            "Sign in or create an account with a secure email link or Google. New members complete their petition profile next.",
          )}
        </p>
        {me.user ? (
          <Link className="button" to="/account">
            {t("Continue to your account ")}
            <ArrowUpRight size={17} />
          </Link>
        ) : (
          <>
            <a
              className={`button google ${!config.googleAuth ? "disabled" : ""}`}
              href={config.googleAuth ? "/api/auth/google" : undefined}
              aria-disabled={!config.googleAuth}
            >
              <span className="google-g">{t("G")}</span>
              {t(" Continue with Google")}
            </a>
            {!loading && !config.googleAuth && (
              <small className="availability">
                {t("Google sign-in is awaiting connection.")}
              </small>
            )}
            <div className="or">
              <span />
              {t("or use your email")}
              <span />
            </div>
            <form onSubmit={submit}>
              <Field label={t("Email address")}>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  placeholder={t("you@example.com")}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <button
                className="button full"
                disabled={
                  busy || loading || (!config.emailAuth && !config.devAuth)
                }
              >
                {busy ? t("Sending your link…") : t("Email me a sign-in link")}
                <Mail size={18} />
              </button>
            </form>
            {!loading && !config.emailAuth && !config.devAuth && (
              <Notice>
                {t(
                  "Email sign-in opens once the project’s email domain is connected. You can explore the petition, policies, and maps now.",
                )}
              </Notice>
            )}
            {sent && (
              <Notice tone="success">
                {t(
                  "Check your inbox for your sign-in link. If you don’t see it, check your spam folder. The link expires in 15 minutes and works once.",
                )}
              </Notice>
            )}
            {devLink && (
              <Notice>
                <strong>{t("Local development only")}</strong>
                <p>
                  {t(
                    "No email was sent. Use this link to test your account on this computer.",
                  )}
                </p>
                <a href={devLink}>{t("Open local sign-in link →")}</a>
              </Notice>
            )}
            {(error || params.get("error")) && (
              <Notice tone="error">
                {t(error) ||
                  t("Sign-in could not be completed. Please try again.")}
              </Notice>
            )}
          </>
        )}
        <div className="auth-privacy">
          <ShieldCheck size={18} />
          <p>
            {t("Your email is never public. You’ll review the")}{" "}
            <Link to="/data-use">{t("data use agreement")}</Link>
            {t(" before signing.")}
          </p>
        </div>
      </div>
    </div>
  );
}
export function Verify() {
  const { refresh } = useData();
  const nav = useNavigate();
  const { hash } = useLocation();
  const token = new URLSearchParams(hash.slice(1)).get("token");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const problem = token
    ? error
    : "The sign-in link is missing its token. Request a new link.";

  async function confirm() {
    if (!token || busy) return;
    setBusy(true);
    window.history.replaceState(window.history.state, "", "/auth/verify");
    try {
      await api("/auth/verify", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      await refresh();
      nav("/account", { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-shell narrow">
      <h1>{problem ? t("Let’s try that again.") : t("Finish signing in")}</h1>
      {problem ? (
        <>
          <Notice tone="error">{t(problem)}</Notice>
          <Link className="button" to="/login">
            {t("Request a new link")}
          </Link>
        </>
      ) : (
        <button
          type="button"
          className="button"
          onClick={confirm}
          disabled={busy}
        >
          {busy ? t("Signing you in…") : t("Confirm sign-in")}
        </button>
      )}
    </div>
  );
}
type DraftCase = Omit<VisaCase, "category"> & {
  category: VisaCase["category"] | "";
};
type ProfileForm = Omit<Profile, "cases" | "legalStatus"> & {
  cases: DraftCase[];
  legalStatus: Profile["legalStatus"] | "";
};
const emptyProfile = {
  name: "",
  legalStatus: "",
  country: "United States",

  state: "",
  district: "",
  politicalAffiliation: "",
  personallyInvolved: true,
  signed: false,
  publicConsent: false,
  adultConsent: false,
  reminders: false,
  reminderEmails: [],
  cases: [],
} as unknown as ProfileForm;
function newCase(): DraftCase {
  return {
    id: crypto.randomUUID(),
    applicantName: "",
    relationship: "Spouse / partner",
    role: undefined,
    nationality: "",
    country: "",
    category: "",
    post: "",
    events: [],
  };
}
function VisaEditor({
  value,
  onChange,
  onRemove,
  citizen,
  signerName,
  index,
}: {
  signerName: string;
  value: DraftCase;
  onChange: (v: DraftCase) => void;
  onRemove: () => void;
  citizen: boolean;
  index: number;
}) {
  const roleOptions = rolesFor("", citizen).filter(
    (r) => r !== "Other relationship to the applicant" || value.role === r,
  );
  const routeSteps = milestonesFor(value.category);
  const routeSpecific = [
    "NOA1",
    "NOA2",
    "At NVC",
    "At KCC",
    "Documentarily qualified",
    "In transit",
    "Ready",
  ];
  const milestoneOptions = eventTypes.filter(
    (type) =>
      !value.category ||
      value.category === "Other" ||
      !routeSpecific.includes(type) ||
      routeSteps.includes(type),
  );
  const relationshipOptions = relationshipsFor(
    value.category,
    value.role,
    citizen,
  );
  const adjust = (category: DraftCase["category"], role = value.role) => {
    const validRole =
      role && rolesFor(category, citizen).includes(role) ? role : undefined;
    const options = relationshipsFor(category, validRole, citizen);
    const next =
      !category || category === value.category
        ? value
        : applyTemplate(value, category, () => crypto.randomUUID());
    onChange({
      ...next,
      category,
      role: validRole,
      relationship: (options.includes(value.relationship)
        ? value.relationship
        : options[0] || "Other") as VisaCase["relationship"],
    });
  };
  const set = (key: keyof VisaCase, v: any) => onChange({ ...value, [key]: v });
  const editEvent = (id: string, key: keyof VisaEvent, v: string) =>
    set(
      "events",
      value.events.map((e) => (e.id === id ? { ...e, [key]: v } : e)),
    );
  return (
    <details className="case-editor" open>
      <summary>
        <span className="case-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <strong>
          {(value.role === "Applicant" ? signerName : value.applicantName) ||
            t("New visa applicant")}
        </strong>
        <span className="tag">{t(caseStatus(value))}</span>
        <ChevronDown size={18} />
      </summary>
      <div className="case-body">
        <div className="form-grid">
          <Field label={t("Choose your role")}>
            <select
              required
              value={value.role || ""}
              onChange={(e) =>
                adjust(
                  rolesFor(value.category, citizen).includes(
                    e.target.value as CaseRole,
                  )
                    ? value.category
                    : "",
                  e.target.value as CaseRole,
                )
              }
            >
              <option value="">{t("Choose your role")}</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role === "Applicant"
                    ? t("I’m the applicant")
                    : role === "Petitioner"
                      ? t("I’m the sponsor")
                      : t(role)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Visa category *")}>
            <select
              required
              value={value.category}
              onChange={(e) => adjust(e.target.value as VisaCase["category"])}
            >
              <option value="">{t("Choose a visa category")}</option>
              {visaCategories
                .filter(
                  (c) =>
                    !value.role || rolesFor(c, citizen).includes(value.role),
                )
                .map((c) => (
                  <option key={c} value={c}>
                    {t(c)}
                  </option>
                ))}
            </select>
          </Field>
          {value.role && value.role !== "Applicant" && (
            <Field label={t("Applicant name or nickname *")}>
              <input
                dir="auto"
                required
                maxLength={100}
                value={value.applicantName}
                onChange={(e) => set("applicantName", e.target.value)}
              />
            </Field>
          )}
          {value.role && value.role !== "Applicant" && (
            <Field label={t("The applicant is my… *")}>
              <select
                required
                value={value.relationship}
                onChange={(e) => set("relationship", e.target.value)}
              >
                {!relationshipOptions.includes(value.relationship) && (
                  <option value="">{t("Choose a relationship")}</option>
                )}
                {relationshipOptions.map((r) => (
                  <option key={r} value={r}>
                    {t(r)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field
            label={t("Applicant nationality (citizenship) *")}
            hint={t(
              "Choose the nationality used for this visa application, not the country of residence.",
            )}
          >
            <select
              required
              value={value.nationality || ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  nationality: e.target.value,
                  country: e.target.value,
                })
              }
            >
              <option value="">{t("Choose a country")}</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {t(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Processing embassy / consular post *")}>
            <select
              required
              value={value.post}
              onChange={(e) => set("post", e.target.value)}
            >
              <option value="">{t("Choose a post")}</option>
              <option value="Not assigned">{t("Not assigned")}</option>
              {value.post &&
                value.post !== "Not assigned" &&
                !postsDirectory.posts.includes(value.post) && (
                  <option value={value.post}>{value.post}</option>
                )}
              {postsDirectory.posts.map((post) => (
                <option key={post} value={post}>
                  {post}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="timeline-editor-title">
          <h4>{t("Visa timeline")}</h4>
        </div>
        <p>
          {t(
            "Delete any milestone you haven’t reached yet. Enter a date for at least one milestone.",
          )}
        </p>
        {mayHavePauseHistory(value.category, value.nationality || "") && (
          <aside className="policy-context">
            <strong>
              {t("Did the 2026 issuance pause affect this case?")}
            </strong>
            <p>
              {t(
                "This nationality was on the 75-country list. That pause is no longer in effect. Nationality alone does not establish an impact: exceptions applied. Add a refusal only if it happened to this applicant.",
              )}
            </p>
            <a
              className="source-link"
              href={pauseSource}
              target="_blank"
              rel="noreferrer"
            >
              {t("State Department update")}{" "}
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
            <button
              type="button"
              className="button outline small"
              disabled={pauseSteps.every((type) =>
                value.events.some((e) => e.type === type),
              )}
              onClick={() =>
                set(
                  "events",
                  addPauseSteps(value.events, () => crypto.randomUUID()),
                )
              }
            >
              {t("Add pause-related milestones")}
            </button>
          </aside>
        )}
        <div className="event-list">
          {value.events.map((e) => (
            <div className="event-editor" key={e.id}>
              <Field label={t("Milestone")}>
                <select
                  value={e.type}
                  onChange={(x) => editEvent(e.id, "type", x.target.value)}
                >
                  {(milestoneOptions.includes(e.type)
                    ? milestoneOptions
                    : [...milestoneOptions, e.type]
                  ).map((eventType) => (
                    <option key={eventType} value={eventType}>
                      {t(milestoneLabel(value.category, eventType))}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Date")}>
                <input
                  type="date"
                  required={value.events.length === 1}
                  value={e.date}
                  max={
                    e.type === "Interview" || e.type === "Reinterview"
                      ? undefined
                      : new Date().toISOString().slice(0, 10)
                  }
                  onChange={(x) => editEvent(e.id, "date", x.target.value)}
                />
              </Field>
              <button
                type="button"
                className="icon-button danger-text"
                aria-label={t("Remove milestone")}
                onClick={() =>
                  set(
                    "events",
                    value.events.filter((x) => x.id !== e.id),
                  )
                }
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
        <div className="row-between">
          <button
            className="text-button"
            type="button"
            onClick={() =>
              set("events", [
                ...value.events,
                {
                  id: crypto.randomUUID(),
                  type: "Interview",
                  date: "",
                },
              ])
            }
          >
            <Plus size={16} />
            {t("Add milestone")}
          </button>
          <button
            type="button"
            className="text-button danger-text"
            onClick={onRemove}
          >
            <Trash2 size={16} />
            {t("Remove this applicant")}
          </button>
        </div>
      </div>
    </details>
  );
}
async function processPhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Use a JPG, PNG, or WebP image.");
  if (file.size > 12000000)
    throw new Error("Choose a photo smaller than 12 MB.");
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  let encoded = canvas.toDataURL("image/jpeg", 0.8);
  if (encoded.length > 1500000) encoded = canvas.toDataURL("image/jpeg", 0.55);
  if (encoded.length > 1500000)
    throw new Error(
      "This image is too large after resizing. Choose a smaller image.",
    );
  return encoded;
}
function StoryEditor() {
  const { me, refresh } = useData();
  const [story, setStory] = useState<Story>(
    me.story || {
      title: "",

      body: "",
      impacts: [],
      support: "",

      photos: [],
      publish: false,
      rightsConsent: false as true,
    },
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [remove, setRemove] = useState(false);
  const set = (k: keyof Story, v: any) => setStory({ ...story, [k]: v });
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setError("");
    try {
      await api("/me/story", { method: "PUT", body: JSON.stringify(story) });
      await refresh();
      setMsg(
        story.publish
          ? "Your story is now public."
          : "Your story is saved privately.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-section" id="story">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t("YOUR STORY")}</span>
          <h2>{t("Share your experience")}</h2>
        </div>
        <span className="tag">{t("Optional")}</span>
      </div>
      <p>
        {t(
          "Share the moments behind the dates. You choose whether to publish. Please do not include case numbers, private documents, or anyone’s information without permission.",
        )}
      </p>
      <form onSubmit={save}>
        <div className="form-grid">
          <Field label={t("Story title *")}>
            <input
              dir="auto"
              minLength={8}
              maxLength={120}
              required
              value={story.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={t("What would you like people to understand?")}
            />
          </Field>
        </div>
        <Field label={t("Your story *")}>
          <textarea
            dir="auto"
            required
            minLength={60}
            maxLength={12000}
            rows={7}
            value={story.body}
            onChange={(e) => set("body", e.target.value)}
            placeholder={t(
              "Tell us about the people, the uncertainty, and how the process has affected your life.",
            )}
          />
        </Field>
        <fieldset className="impact-options">
          <legend>{t("What has the wait affected?")}</legend>
          {[
            "Family separation",
            "Missed milestones",
            "Financial strain",
            "Work & career",
            "Health & wellbeing",
            "Travel costs",
            "Repeated paperwork",
            "Embassy communication",
          ].map((x) => (
            <label key={x}>
              <input
                type="checkbox"
                checked={story.impacts.includes(x)}
                onChange={() =>
                  set(
                    "impacts",
                    story.impacts.includes(x)
                      ? story.impacts.filter((i) => i !== x)
                      : [...story.impacts, x],
                  )
                }
              />
              {t(x)}
            </label>
          ))}
        </fieldset>
        <Field label={t("Support you’re looking for (optional)")}>
          <textarea
            dir="auto"
            maxLength={2000}
            value={story.support}
            onChange={(e) => set("support", e.target.value)}
            placeholder={t(
              "For example, an elected official’s attention or a group working on this issue. Publishing here does not send your story to them.",
            )}
            rows={3}
          />
        </Field>
        <div className="photo-upload">
          <div className="photo-previews">
            {story.photos.map((p, i) => (
              <div key={i}>
                <img
                  src={p}
                  alt={t("Your uploaded photo {count}", { count: i + 1 })}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("Remove photo {count}", { count: i + 1 })}
                  onClick={() =>
                    set(
                      "photos",
                      story.photos.filter((_, j) => j !== i),
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <label className="upload-control">
            <Camera size={22} />
            <span>{t("Add up to 4 photos")}</span>
            <small>{t("JPG, PNG, WebP · resized and metadata removed")}</small>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={busy || story.photos.length >= 4}
              onChange={async (e) => {
                setError("");
                setBusy(true);
                try {
                  const files = Array.from(e.target.files || []).slice(
                    0,
                    4 - story.photos.length,
                  );
                  const photos = await Promise.all(files.map(processPhoto));
                  setStory((current) => ({
                    ...current,
                    photos: [...current.photos, ...photos],
                  }));
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            required
            checked={story.rightsConsent}
            onChange={(e) => set("rightsConsent", e.target.checked)}
          />
          <span>
            {t(
              "I have permission to share this story, these images, and information about anyone included. *",
            )}
          </span>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={story.publish}
            onChange={(e) => set("publish", e.target.checked)}
          />
          <span>
            {t(
              "Publish my story and photos for everyone to see. Uncheck and save to unpublish.",
            )}
          </span>
        </label>
        {error && <Notice tone="error">{t(error)}</Notice>}
        {msg && <Notice tone="success">{t(msg)}</Notice>}
        <div className="row-between">
          <button className="button" disabled={busy}>
            {busy
              ? t("Saving…")
              : story.publish
                ? t("Publish story")
                : t("Save private draft")}
            <ArrowUpRight size={17} />
          </button>
          {me.story && (
            <button
              type="button"
              className="text-button danger-text"
              onClick={() => setRemove(true)}
            >
              {t("Delete story")}
            </button>
          )}
        </div>
      </form>
      {remove && (
        <Modal title={t("DELETE STORY")} onClose={() => setRemove(false)}>
          <h2>{t("Remove your story?")}</h2>
          <p>
            {t(
              "This permanently removes the story and its photos from this application.",
            )}
          </p>
          <button
            className="button danger"
            onClick={async () => {
              try {
                await api("/me/story", { method: "DELETE" });
                await refresh();
                setStory({
                  title: "",

                  body: "",
                  impacts: [],
                  support: "",

                  photos: [],
                  publish: false,
                  rightsConsent: false as true,
                });
                setRemove(false);
                setMsg("Story deleted.");
              } catch (e) {
                setError((e as Error).message);
                setRemove(false);
              }
            }}
          >
            {t("Delete story")}
          </button>
        </Modal>
      )}
    </section>
  );
}
export function ThankYou() {
  const { loading, me } = useData();
  if (loading) return <div className="page-shell">{t("Loading…")}</div>;
  if (!me.profile) return <Navigate to="/account" replace />;
  return (
    <div className="page-shell narrow">
      <PageIntro
        eyebrow={t("SIGN THE PETITION")}
        title={t("Thank you for signing.")}
        text={t(
          "Your signature has been added. You can now share how visa delays have affected you and your family.",
        )}
      >
        <Link className="button coral" to="/account#story">
          {t("Share your experience")} <ArrowUpRight size={18} />
        </Link>
        <Link className="text-button" to="/account">
          {t("Your account")}
        </Link>
      </PageIntro>
    </div>
  );
}
export function Account() {
  const { me, loading, config, refresh } = useData();
  const nav = useNavigate();
  const { hash } = useLocation();
  const tab =
    hash === "#story"
      ? "story"
      : hash === "#cases"
        ? "cases"
        : hash === "#settings"
          ? "settings"
          : "profile";
  const signing = !me.profile;
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [form, setForm] = useState<ProfileForm>(() => ({
    ...emptyProfile,
    cases: [newCase()],
  }));
  const [districts, setDistricts] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  useEffect(() => {
    if (me.profile)
      setForm({
        ...emptyProfile,
        ...me.profile,
        reminderEmails: me.profile.reminderEmails || [],
      });
  }, [me.user?.id, me.profile?.signedAt]);
  useEffect(() => {
    fetch("/data/districts.json")
      .then((r) => r.json())
      .then((d) => setDistricts(d.features))
      .catch(() =>
        setError("District list could not be loaded. Refresh to try again."),
      );
  }, []);
  useEffect(() => {
    setError("");
    setMessage("");
    setInvalidFields([]);
  }, [tab]);
  const set = (k: keyof Profile, v: any) => setForm((p) => ({ ...p, [k]: v }));
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || (!signing && tab === "story")) return;
    setError("");
    setMessage("");
    setInvalidFields([]);
    const el = e.currentTarget as HTMLFormElement;
    const invalid = Array.from(
      el.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "input:invalid,select:invalid,textarea:invalid",
      ),
    );
    if (invalid.length) {
      setInvalidFields(
        invalid.map((input) => {
          const label =
            input.closest("label")?.querySelector("span")?.textContent ||
            input.name;
          return [label, input.validationMessage].filter(Boolean).join(" — ");
        }),
      );
      invalid[0].closest("details")?.setAttribute("open", "");
      invalid[0].focus();
      invalid[0].reportValidity();
      return;
    }
    if ((signing || tab === "cases") && form.personallyInvolved) {
      if (!form.cases.length) {
        setError("Add at least one visa case when you are personally involved");
        return;
      }
      const missing = form.cases.findIndex(
        (c) => !c.events.some((event) => event.date),
      );
      if (missing !== -1) {
        setError(
          t("Visa case {number} needs at least one dated milestone.", {
            number: missing + 1,
          }),
        );
        return;
      }
    }
    setBusy(true);
    try {
      const values = {
        ...form,
        cases: form.personallyInvolved
          ? form.cases.map((c) => ({
              ...c,
              applicantName:
                c.role === "Applicant"
                  ? (me.profile?.name ?? form.name)
                  : c.applicantName,
              events: c.events.filter((event) => event.date),
            }))
          : [],
      };
      const section = tab as ProfileSection;
      const payload = signing
        ? values
        : Object.fromEntries(
            profileSections[section].map((key) => [key, values[key]]),
          );
      const result = await api(
        signing ? "/me/profile" : "/me/profile/" + section,
        {
          method: signing ? "PUT" : "PATCH",
          body: JSON.stringify(payload),
        },
      );
      await refresh();
      if (signing) nav("/thank-you", { replace: true });
      else {
        // Use the stored values for this tab while retaining edits made during the request.
        setForm((current) => ({
          ...current,
          ...Object.fromEntries(
            profileSections[section]
              .filter((key) => current[key] === form[key])
              .map((key) => [key, result.fields[key]]),
          ),
        }));
        setMessage("Changes saved.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="page-shell">
        <h2>{t("Loading your account…")}</h2>
      </div>
    );
  if (!me.user)
    return (
      <div className="page-shell narrow">
        <PageIntro
          eyebrow={t("JOIN REUNITE NOW")}
          title={t("Sign in to take part.")}
          text={t(
            "Sign in to sign the petition, record visa timelines, and share your story.",
          )}
        />
        <Link className="button coral" to="/login?intent=sign">
          {t("Sign in or create an account ")}
          <ArrowUpRight size={18} />
        </Link>
      </div>
    );
  const stateFips = states.find((s) => s[1] === form.state)?.[0];
  const districtOptions = districts
    .filter((d) => String(d.properties.GEOID).startsWith(stateFips || "NONE"))
    .map((d) => String(d.properties.GEOID).slice(2))
    .filter((d, i, a) => a.indexOf(d) === i)
    .sort();
  return (
    <div className="page-shell account-shell">
      <PageIntro
        eyebrow={me.profile ? t("YOUR ACCOUNT") : t("SIGN THE PETITION")}
        title={
          me.profile ? <>{t("Your account")}</> : <>{t("Sign the petition")}</>
        }
        text={
          me.profile
            ? t(
                "Edit your profile, update visa timelines, or confirm that nothing has changed.",
              )
            : t(
                "Complete your public petition profile using your own name. Your email always stays private.",
              )
        }
      >
        <button
          className="text-button"
          onClick={async () => {
            await api("/auth/logout", { method: "POST" });
            await refresh();
            nav("/");
          }}
        >
          <LogOut size={16} />
          {t("Log out")}
        </button>
      </PageIntro>
      {me.profile && (
        <nav className="account-tabs" aria-label={t("Your account")}>
          {(
            [
              ["profile", t("Profile details")],
              ["cases", t("Visa process")],
              ["story", t("Share your experience")],
              ["settings", t("Configuration")],
            ] as const
          ).map(([key, label]) => (
            <Link
              key={key}
              to={key === "profile" ? "/account" : "/account#" + key}
              aria-current={tab === key ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
      {tab !== "story" && message && (
        <Notice tone="success">{t(message)}</Notice>
      )}
      {(signing || tab !== "story") && (
        <form noValidate onSubmit={save}>
          {(signing || tab === "profile") && (
            <section className="account-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">{t("YOUR PUBLIC PROFILE")}</span>
                  <h2>{t("Profile details")}</h2>
                </div>
                <span className="tag">{t("Public after signing")}</span>
              </div>
              <div className="form-grid">
                <Field
                  label={t("Name *")}
                  hint={t("Enter your own name to sign the petition.")}
                >
                  <input
                    dir="auto"
                    required
                    minLength={1}
                    maxLength={80}
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </Field>
                <Field
                  label={t("Email · private")}
                  hint={t(
                    "Verified through your sign-in method. This is your unique account email.",
                  )}
                >
                  <input disabled type="email" value={me.user.email} />
                </Field>
                <Field label={t("U.S. citizenship or immigration status *")}>
                  <select
                    value={form.legalStatus}
                    required
                    onChange={(e) => {
                      const legalStatus = e.target
                        .value as Profile["legalStatus"];
                      setForm((p) => ({
                        ...p,
                        legalStatus,
                        politicalAffiliation:
                          legalStatus === "US citizen"
                            ? p.politicalAffiliation
                            : "",
                        cases: me.profile
                          ? p.cases
                          : p.cases.map((c) =>
                              legalStatus === "US citizen" &&
                              c.role === "Applicant"
                                ? {
                                    ...c,
                                    role: undefined,
                                    relationship: "Other",
                                  }
                                : c,
                            ),
                      }));
                    }}
                  >
                    <option value="">{t("Select your status")}</option>
                    {legalStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s === "Other"
                          ? t(
                              "Other (for example, a U.S. nonimmigrant visa holder or a foreign citizen living abroad)",
                            )
                          : t(s)}
                      </option>
                    ))}
                  </select>
                </Field>
                {form.legalStatus === "US citizen" && (
                  <Field label={t("Political affiliation · optional")}>
                    <select
                      value={form.politicalAffiliation}
                      onChange={(e) =>
                        set("politicalAffiliation", e.target.value)
                      }
                    >
                      <option value="">{t("Prefer not to say")}</option>
                      {["Democratic", "Independent", "Republican", "Other"].map(
                        (p) => (
                          <option key={p} value={p}>
                            {t(p)}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                )}
                <Field label={t("Country of residence *")}>
                  <select
                    required
                    value={form.country}
                    onChange={(e) => {
                      setForm((p) => ({
                        ...p,
                        country: e.target.value,

                        state: "",
                        district: "",
                      }));
                    }}
                  >
                    {countries.map((c) => (
                      <option key={c} value={c}>
                        {t(c)}
                      </option>
                    ))}
                  </select>
                </Field>
                {form.country === "United States" && (
                  <>
                    <Field label={t("State or territory *")}>
                      <select
                        required
                        value={form.state}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            state: e.target.value,
                            district: "",
                          }))
                        }
                      >
                        <option value="">{t("Select a state")}</option>
                        {states.map((s) => (
                          <option key={s[1]} value={s[1]}>
                            {s[2]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label={t("Congressional district *")}
                      hint={t(
                        "119th Congress · 00 means an at-large district.",
                      )}
                    >
                      <select
                        required
                        value={form.district}
                        onChange={(e) => set("district", e.target.value)}
                      >
                        <option value="">{t("Select your district")}</option>
                        {districtOptions.map((d) => (
                          <option key={d} value={d}>
                            {form.state}-{d}
                            {d === "00" ? t(" (at-large)") : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </>
                )}
              </div>
              {form.country === "United States" && (
                <a
                  className="external district-help"
                  href="https://www.house.gov/representatives/find-your-representative"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("Find your congressional district on House.gov")}{" "}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              )}
            </section>
          )}
          {(signing || tab === "cases") && (
            <>
              <section className="account-section">
                <fieldset className="involvement">
                  <legend>
                    {t(
                      "Are you applying for a U.S. visa or sponsoring an applicant? *",
                    )}
                  </legend>
                  <label>
                    <input
                      type="radio"
                      name="involved"
                      checked={form.personallyInvolved}
                      onChange={() =>
                        setForm((p) => ({
                          ...p,
                          personallyInvolved: true,
                          cases: p.cases.length ? p.cases : [newCase()],
                        }))
                      }
                    />
                    {t("Yes — I am an applicant or sponsor")}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="involved"
                      checked={!form.personallyInvolved}
                      onChange={() => set("personallyInvolved", false)}
                    />
                    {t("No — I’m here to support")}
                  </label>
                </fieldset>
              </section>
              {!form.personallyInvolved &&
                (me.profile?.cases.length || 0) > 0 && (
                  <Notice>
                    {t(
                      "Saving as a supporter will remove your submitted visa timelines. Choose Yes to keep them. Your signature and story will remain.",
                    )}
                  </Notice>
                )}
              {form.personallyInvolved && (
                <section className="account-section">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">{t("VISA TIMELINES")}</span>
                      <h2>{t("Your visa cases")}</h2>
                    </div>
                    <span className="tag">{t("Public")}</span>
                  </div>
                  {form.cases.map((c, i) => (
                    <VisaEditor
                      key={c.id}
                      index={i}
                      signerName={me.profile?.name ?? form.name}
                      citizen={
                        (me.profile?.legalStatus ?? form.legalStatus) ===
                        "US citizen"
                      }
                      value={c}
                      onChange={(v) =>
                        set(
                          "cases",
                          form.cases.map((x) => (x.id === v.id ? v : x)),
                        )
                      }
                      onRemove={() =>
                        set(
                          "cases",
                          form.cases.filter((x) => x.id !== c.id),
                        )
                      }
                    />
                  ))}
                  <button
                    type="button"
                    className="button outline"
                    disabled={form.cases.length >= 20}
                    onClick={() => set("cases", [...form.cases, newCase()])}
                  >
                    <Plus size={18} />
                    {t("Add a visa applicant")}
                  </button>
                </section>
              )}
            </>
          )}
          {signing && (
            <section className="account-section consent-section">
              <span className="eyebrow">{t("CONSENT & PREFERENCES")}</span>
              <h2>{t("Confirm your signature")}</h2>
              <p className="petition-statement">
                {t(
                  "I support transparent visa processing times, meaningful accountability for the Department of State, and the staffing and resources needed to reduce unnecessary delays.",
                )}
              </p>
              <label className="checkbox">
                <input
                  type="checkbox"
                  required
                  checked={form.signed}
                  onChange={(e) => set("signed", e.target.checked)}
                />
                <span>
                  {t("I am signing this petition with my real name. *")}
                </span>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  required
                  checked={form.publicConsent}
                  onChange={(e) => set("publicConsent", e.target.checked)}
                />
                <span>
                  {t("I have read the")}{" "}
                  <Link to="/data-use" target="_blank">
                    {t("data use agreement")}
                  </Link>{" "}
                  {t(
                    "and understand that my name, profile, location, legal status, optional affiliation, and submitted visa timelines will be publicly accessible. My email stays private. *",
                  )}
                </span>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  required
                  checked={form.adultConsent}
                  onChange={(e) => set("adultConsent", e.target.checked)}
                />
                <span>
                  {t(
                    "I am at least 18 and have permission to publish information about any other applicants I add. *",
                  )}
                </span>
              </label>
            </section>
          )}
          {(signing || tab === "settings") && (
            <section className="account-section consent-section">
              <h2>{t("Email reminders")}</h2>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.reminders}
                  onChange={(e) =>
                    setForm((profile) => ({
                      ...profile,
                      reminders: e.target.checked,
                      reminderEmails: e.target.checked
                        ? profile.reminderEmails
                        : profile.reminderEmails.filter(
                            (email) =>
                              reminderEmailSchema.safeParse(email).success,
                          ),
                    }))
                  }
                />
                <span>
                  {t(
                    "Send me an optional monthly reminder to update active visa timelines or confirm no change.",
                  )}
                  <small>
                    {t(
                      "At most once per month after 30 days without a check-in. Unsubscribe here anytime.",
                    )}{" "}
                    {config.reminders
                      ? ""
                      : t(
                          "Email delivery is pending setup; your preference will be saved.",
                        )}
                  </small>
                </span>
              </label>
              <details className="reminder-help">
                <summary
                  title={t(
                    "A fresh update, including “no change”, tells us a case is still waiting. This keeps our community estimates current. On the visa data page, readers can filter to cases confirmed in the last 30, 60, or 90 days. Reminders are optional and never change your timeline automatically.",
                  )}
                >
                  {t("Why do we ask you to check in?")}
                </summary>
                <p>
                  {t(
                    "A fresh update, including “no change”, tells us a case is still waiting. This keeps our community estimates current. On the visa data page, readers can filter to cases confirmed in the last 30, 60, or 90 days. Reminders are optional and never change your timeline automatically.",
                  )}
                </p>
              </details>
              {form.reminders && (
                <fieldset className="reminder-emails">
                  <legend>{t("Additional reminder emails")}</legend>
                  <p className="small-copy">
                    {t("Reminders go to your sign-in email: {email}.", {
                      email: me.user?.email || "",
                    })}
                  </p>
                  <p className="small-copy">
                    {t(
                      "Add up to 5 other addresses you own or have permission to notify. Each gets a separate email. These addresses stay private.",
                    )}
                  </p>
                  {form.reminderEmails.map((email, index) => (
                    <div className="reminder-email-row" key={index}>
                      <Field
                        label={t("Reminder email {number}", {
                          number: index + 1,
                        })}
                      >
                        <input
                          type="email"
                          autoComplete="off"
                          maxLength={254}
                          required
                          value={email}
                          onChange={(event) =>
                            set(
                              "reminderEmails",
                              form.reminderEmails.map((value, i) =>
                                i === index ? event.target.value : value,
                              ),
                            )
                          }
                        />
                      </Field>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t("Remove reminder email {number}", {
                          number: index + 1,
                        })}
                        onClick={() =>
                          set(
                            "reminderEmails",
                            form.reminderEmails.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  {form.reminderEmails.length < 5 && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        set("reminderEmails", [...form.reminderEmails, ""])
                      }
                    >
                      <Plus size={16} /> {t("Add reminder email")}
                    </button>
                  )}
                </fieldset>
              )}
            </section>
          )}
          <div className="account-save">
            {error && <Notice tone="error">{t(error)}</Notice>}
            {invalidFields.length > 0 && (
              <Notice tone="error">
                <strong>{t("Check these fields before saving.")}</strong>
                <ul>
                  {invalidFields.map((msg, i) => (
                    <li key={i}>{msg}</li>
                  ))}
                </ul>
              </Notice>
            )}
            <button className="button coral" disabled={busy}>
              {busy
                ? t("Saving…")
                : signing
                  ? t("Sign the petition")
                  : tab === "cases"
                    ? t("Save visa cases")
                    : tab === "settings"
                      ? t("Save settings")
                      : t("Save profile")}{" "}
              <ArrowUpRight size={18} />
            </button>
          </div>
        </form>
      )}
      {me.profile && (
        <div hidden={tab !== "story"}>
          <StoryEditor />
        </div>
      )}
      {(signing || tab === "settings") && (
        <section className="account-section manage-section">
          <div>
            <h2>{t("Export or delete your data")}</h2>
            <p>
              {t(
                "Export a copy or delete your account and all associated information.",
              )}
            </p>
          </div>
          <div className="row-between">
            <a className="button outline" href="/api/me/export">
              <Download size={17} />
              {t("Export my data")}
            </a>
            <button
              className="text-button danger-text"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 size={17} />
              {t("Delete account")}
            </button>
          </div>
        </section>
      )}
      {deleteOpen && (
        <Modal
          title={t("PERMANENT ACCOUNT DELETION")}
          onClose={() => setDeleteOpen(false)}
        >
          <h2>{t("Remove your account and data?")}</h2>
          <p>
            {t(
              "This removes your signature, profile, visa cases, stories, photos, and sign-in sessions from the live application. Azure backups expire within 7 days; public copies others saved cannot be recalled.",
            )}
          </p>
          <Field label={t("Type DELETE to confirm")}>
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
            />
          </Field>
          {deleteError && <Notice tone="error">{t(deleteError)}</Notice>}
          <button
            className="button danger"
            disabled={confirmation !== "DELETE" || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/me", {
                  method: "DELETE",
                  body: JSON.stringify({ confirmation }),
                });
                await refresh();
                nav("/");
              } catch (e) {
                setDeleteError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("Permanently delete my account")}
          </button>
        </Modal>
      )}
    </div>
  );
}
