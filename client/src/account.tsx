import { t } from "./i18n";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  Mail,
  ShieldCheck,
  Plus,
  Trash2,
  Shuffle,
  Check,
  Download,
  LogOut,
  Camera,
  Heart,
  ChevronDown,
} from "lucide-react";
import { api, useData } from "./api";
import { PageIntro, Field, Notice, Modal, date, Timeline } from "./ui";
import {
  states,
  legalStatuses,
  visaCategories,
  eventTypes,
  type Profile,
  type VisaCase,
  type VisaEvent,
  type Story,
} from "../../shared/schema";
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
                  "Check your inbox. Your link expires in 15 minutes and works once.",
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
  const [error, setError] = useState("");
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get(
      "token",
    );
    window.history.replaceState(null, "", "/auth/verify");
    if (!token) {
      setError("The sign-in link is missing its token. Request a new link.");
      return;
    }
    api("/auth/verify", { method: "POST", body: JSON.stringify({ token }) })
      .then(() => refresh())
      .then(() => nav("/account", { replace: true }))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="page-shell narrow">
      <h1>{error ? t("Let’s try that again.") : t("Signing you in…")}</h1>
      {error && (
        <>
          <Notice tone="error">{t(error)}</Notice>
          <Link className="button" to="/login">
            {t("Request a new link")}
          </Link>
        </>
      )}
    </div>
  );
}
const emptyProfile = {
  name: "",
  legalStatus: "US citizen",
  country: "United States",
  city: "",
  state: "",
  district: "",
  politicalAffiliation: "",
  personallyInvolved: true,
  signed: false,
  publicConsent: false,
  adultConsent: false,
  reminders: false,
  cases: [],
} as unknown as Profile;
function newCase(): VisaCase {
  return {
    id: crypto.randomUUID(),
    applicantName: "",
    relationship: "Spouse / partner",
    country: "",
    category: "K-1",
    post: "",
    events: [{ id: crypto.randomUUID(), type: "Filed", date: "", note: "" }],
  };
}
function VisaEditor({
  value,
  onChange,
  onRemove,
  citizen,
  index,
}: {
  value: VisaCase;
  onChange: (v: VisaCase) => void;
  onRemove: () => void;
  citizen: boolean;
  index: number;
}) {
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
        <strong>{value.applicantName || t("New visa applicant")}</strong>
        <span className="tag">{t(caseStatus(value))}</span>
        <ChevronDown size={18} />
      </summary>
      <div className="case-body">
        <div className="form-grid">
          <Field label={t("Applicant name or nickname *")}>
            <input
              required
              maxLength={100}
              value={value.applicantName}
              onChange={(e) => set("applicantName", e.target.value)}
            />
          </Field>
          <Field label={t("Relationship to you *")}>
            <select
              value={value.relationship}
              onChange={(e) => set("relationship", e.target.value)}
            >
              {[
                "Self",
                "Spouse / partner",
                "Child",
                "Parent",
                "Sibling",
                "Other",
              ]
                .filter((r) => !citizen || r !== "Self")
                .map((r) => (
                  <option key={r} value={r}>
                    {t(r)}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={t("Applicant country *")}>
            <select
              required
              value={value.country}
              onChange={(e) => set("country", e.target.value)}
            >
              <option value="">{t("Choose a country")}</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {t(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Visa category *")}>
            <select
              value={value.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {visaCategories.map((c) => (
                <option key={c} value={c}>
                  {t(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={t("Processing embassy / consular post *")}
            hint={t(
              "Use the city name, for example Bogotá or London. If not assigned, enter Not assigned.",
            )}
          >
            <input
              required
              list="posts"
              minLength={2}
              maxLength={120}
              value={value.post}
              onChange={(e) => set("post", e.target.value)}
            />
            <datalist id="posts">
              {[
                "Abu Dhabi",
                "Accra",
                "Addis Ababa",
                "Amman",
                "Ankara",
                "Bangkok",
                "Beirut",
                "Bogotá",
                "Buenos Aires",
                "Cairo",
                "Casablanca",
                "Chennai",
                "Ciudad Juárez",
                "Dhaka",
                "Doha",
                "Dubai",
                "Frankfurt",
                "Guangzhou",
                "Ho Chi Minh City",
                "Hong Kong",
                "Islamabad",
                "Jakarta",
                "Johannesburg",
                "Kathmandu",
                "Kingston",
                "Lagos",
                "Lima",
                "London",
                "Manila",
                "Montreal",
                "Mumbai",
                "Nairobi",
                "New Delhi",
                "Paris",
                "Port-au-Prince",
                "Riyadh",
                "San José",
                "San Salvador",
                "Santo Domingo",
                "São Paulo",
                "Seoul",
                "Singapore",
                "Sydney",
                "Taipei",
                "Tbilisi",
                "Tegucigalpa",
                "Tokyo",
                "Yerevan",
                "Not assigned",
              ].map((p) => (
                <option key={p} value={p}>
                  {t(p)}
                </option>
              ))}
            </datalist>
          </Field>
        </div>
        <div className="timeline-editor-title">
          <h4>{t("Visa timeline")}</h4>
          <span>{t("Dates and notes will be public")}</span>
        </div>
        <p className="small-copy">
          {t(
            "Add milestones you know. You can record multiple interviews and future interview appointments. A §221(g) or policy-related refusal stays active; choose “Final refusal” only for a final denial. Use “Reopened” if a closed case resumes.",
          )}
        </p>
        <div className="event-list">
          {value.events.map((e) => (
            <div className="event-editor" key={e.id}>
              <Field label={t("Milestone")}>
                <select
                  value={e.type}
                  onChange={(x) => editEvent(e.id, "type", x.target.value)}
                >
                  {eventTypes.map((eventType) => (
                    <option key={eventType} value={eventType}>
                      {t(eventType)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Date")}>
                <input
                  type="date"
                  required
                  value={e.date}
                  max={
                    e.type === "Interview"
                      ? undefined
                      : new Date().toISOString().slice(0, 10)
                  }
                  onChange={(x) => editEvent(e.id, "date", x.target.value)}
                />
              </Field>
              <Field label={t("Note (optional)")}>
                <input
                  value={e.note}
                  maxLength={1000}
                  placeholder={t("No case numbers or private details")}
                  onChange={(x) => editEvent(e.id, "note", x.target.value)}
                />
              </Field>
              <button
                type="button"
                className="icon-button danger-text"
                disabled={value.events.length === 1}
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
                  note: "",
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
      summary: "",
      body: "",
      impacts: [],
      support: "",
      caseId: "",
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
              minLength={8}
              maxLength={120}
              required
              value={story.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={t("What would you like people to understand?")}
            />
          </Field>
          <Field label={t("Link a visa timeline")}>
            <select
              value={story.caseId}
              onChange={(e) => set("caseId", e.target.value)}
            >
              <option value="">{t("No linked timeline")}</option>
              {me.profile?.cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.applicantName} · {c.category}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          label={t("Short introduction *")}
          hint={t("Shown on your story card (20–240 characters).")}
        >
          <textarea
            required
            minLength={20}
            maxLength={240}
            value={story.summary}
            onChange={(e) => set("summary", e.target.value)}
            rows={2}
          />
        </Field>
        <Field label={t("Your story *")}>
          <textarea
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
                  set("photos", [...story.photos, ...photos]);
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
                  summary: "",
                  body: "",
                  impacts: [],
                  support: "",
                  caseId: "",
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
export function Account() {
  const { me, loading, config, refresh } = useData();
  const nav = useNavigate();
  const [form, setForm] = useState<Profile>(emptyProfile);
  const [districts, setDistricts] = useState<any[]>([]);
  const [address, setAddress] = useState("");
  const [lookBusy, setLookBusy] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  useEffect(() => {
    if (me.profile) setForm(me.profile);
  }, [me.profile]);
  useEffect(() => {
    fetch("/data/districts.json")
      .then((r) => r.json())
      .then((d) => setDistricts(d.features))
      .catch(() =>
        setError("District list could not be loaded. Refresh to try again."),
      );
  }, []);
  useEffect(() => {
    if (window.location.hash === "#story" && me.profile)
      setTimeout(() => document.getElementById("story")?.scrollIntoView(), 100);
  }, [me.profile?.signedAt]);
  const set = (k: keyof Profile, v: any) => setForm((p) => ({ ...p, [k]: v }));
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("/me/profile", { method: "PUT", body: JSON.stringify(form) });
      await refresh();
      setMessage(
        me.profile
          ? "Your information and timelines are up to date."
          : "Your signature has been added. Thank you.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function lookup() {
    setLookBusy(true);
    setLookupMessage("");
    try {
      const r = await api("/district-lookup", {
        method: "POST",
        body: JSON.stringify({ address }),
      });
      setForm((p) => ({ ...p, state: r.state, district: r.district }));
      setAddress("");
      setLookupMessage(
        `Found ${r.state}-${r.district} in the 119th Congress. Your search address has been cleared. Review the result before saving.`,
      );
    } catch (e) {
      setLookupMessage((e as Error).message);
    } finally {
      setLookBusy(false);
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
                "Complete your public petition profile. You can use a nickname, and your email always stays private.",
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
        <div className="account-confirm">
          <div>
            <Check size={22} />
            <span>
              <strong>{t("You’ve signed. Thank you.")}</strong>
              <small>
                {t("Last confirmed ")}
                {date(me.profile.updatedAt)}
              </small>
            </span>
          </div>
          <button
            className="button outline small"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await api("/me/confirm", { method: "POST" });
                await refresh();
                setMessage(
                  "Confirmed: no changes to your cases. The last-checked dates are now updated.",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("No changes — confirm today ")}
            <Check size={16} />
          </button>
        </div>
      )}
      {error && <Notice tone="error">{t(error)}</Notice>}
      {message && <Notice tone="success">{t(message)}</Notice>}
      <form onSubmit={save}>
        <section className="account-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t("YOUR PUBLIC PROFILE")}</span>
              <h2>{t("Profile details")}</h2>
            </div>
            <span className="tag">{t("Public after signing")}</span>
          </div>
          <div className="form-grid">
            <Field label={t("Name or nickname *")}>
              <div className="input-action">
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="nickname"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
                <button
                  type="button"
                  aria-label={t("Generate a random nickname")}
                  title={t("Generate a nickname")}
                  onClick={() =>
                    set(
                      "name",
                      `${["Hopeful", "Kind", "Brave", "Patient", "Steady"][Math.floor(Math.random() * 5)]} ${["River", "Cedar", "Robin", "Horizon", "Willow"][Math.floor(Math.random() * 5)]} ${Math.floor(Math.random() * 9000) + 1000}`,
                    )
                  }
                >
                  <Shuffle size={17} />
                </button>
              </div>
            </Field>
            <Field
              label={t("Email · private")}
              hint={t(
                "Verified through your sign-in method. This is your unique account email.",
              )}
            >
              <input disabled type="email" value={me.user.email} />
            </Field>
            <Field label={t("Legal status *")}>
              <select
                value={form.legalStatus}
                onChange={(e) => set("legalStatus", e.target.value)}
              >
                {legalStatuses.map((s) => (
                  <option key={s} value={s}>
                    {t(s)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Political affiliation · optional")}>
              <select
                value={form.politicalAffiliation}
                onChange={(e) => set("politicalAffiliation", e.target.value)}
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
            <Field label={t("City *")}>
              <input
                required
                minLength={2}
                maxLength={100}
                autoComplete="address-level2"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
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
                  hint={t("119th Congress · 00 means an at-large district.")}
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
            <details className="address-lookup">
              <summary>
                {t("Not sure of your district? Look it up by address.")}
              </summary>
              <p>
                {t(
                  "Your address is sent to the US Census Bureau to find your district. This application does not retain your address or search results. Only the state and district you confirm are saved.",
                )}
              </p>
              <div className="input-action">
                <input
                  aria-label={t("Address for district lookup")}
                  value={address}
                  autoComplete="off"
                  placeholder={t("Full street address, city, state, ZIP")}
                  onChange={(e) => setAddress(e.target.value)}
                />
                <button
                  type="button"
                  disabled={lookBusy || address.length < 8}
                  onClick={lookup}
                >
                  {lookBusy ? t("Looking up…") : t("Find district")}
                </button>
              </div>
              {lookupMessage && <Notice>{t(lookupMessage)}</Notice>}
            </details>
          )}
          <fieldset className="involvement">
            <legend>
              {t("Are you personally involved in a visa process? *")}
            </legend>
            <label>
              <input
                type="radio"
                name="involved"
                checked={form.personallyInvolved}
                onChange={() => set("personallyInvolved", true)}
              />
              {t("Yes — for me or someone relevant to me")}
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
        <section className="account-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t("VISA TIMELINES")}</span>
              <h2>{t("Your visa cases")}</h2>
            </div>
            <span className="tag">{t("Optional · public")}</span>
          </div>
          <p>
            {t(
              "Add yourself or someone relevant to you. US citizens can add applicants other than themselves. Use nicknames and only share another person’s details with their permission.",
            )}
          </p>
          {form.cases.map((c, i) => (
            <VisaEditor
              key={c.id}
              index={i}
              citizen={form.legalStatus === "US citizen"}
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
        <section className="account-section consent-section">
          <span className="eyebrow">{t("CONSENT & PREFERENCES")}</span>
          <h2>
            {me.profile ? t("Review and save") : t("Confirm your signature")}
          </h2>
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
            <span>{t("I sign the Reunite Now petition. *")}</span>
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
                "and understand that my name or nickname, profile, location, legal status, optional affiliation, and submitted visa timelines will be publicly accessible. My email stays private. *",
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
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.reminders}
              onChange={(e) => set("reminders", e.target.checked)}
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
          <button className="button coral" disabled={busy}>
            {busy
              ? t("Saving…")
              : me.profile
                ? t("Save & confirm all information")
                : t("Sign the petition")}
            <ArrowUpRight size={18} />
          </button>
          <p className="small-copy">
            {t(
              "Saving confirms that you have reviewed all listed cases and updates their last-checked date.",
            )}
          </p>
        </section>
      </form>
      {me.profile && <StoryEditor />}
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
