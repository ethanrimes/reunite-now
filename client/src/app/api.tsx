import { useLocation } from "react-router-dom";
import { previewMode } from "./preview";
import { keyedSnapshotCache, snapshotCache } from "./snapshot-cache";
import type { SignatureGroup } from "../../../shared/coverage";
import type { StoryPage } from "../../../shared/public-views";
import type { SignatoryRoster } from "../../../shared/signatories";
import type { timelineSnapshot } from "../../../shared/visa-timelines";
import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import type {
  Profile,
  PublicProfile,
  PublicStory,
  Story,
} from "../../../shared/schema";
export async function api<T = any>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  if (previewMode && (options.method || "GET").toUpperCase() !== "GET")
    throw new Error(
      "Sample data is read-only. Open the live site to sign or edit your account.",
    );
  const r = await fetch(`/api${url}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Request failed");
  const method = (options.method || "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method)) {
    const profile = url === "/me/profile" || url === "/me/profile/profile";
    const deleted = url === "/me" && method === "DELETE";
    if (profile || deleted || url === "/me/profile/cases") {
      coverageSnapshot.clear();
    }
    if (profile || deleted || url === "/me/profile/settings") {
      signatorySnapshots.clear();
    }
    if (
      profile ||
      deleted ||
      url === "/me/profile/cases" ||
      url === "/me/confirm"
    ) {
      visaSnapshot.clear();
    }
    if (profile || deleted || url === "/me/story") {
      storyPages.clear();
      storyDetails.clear();
    }
  }
  return data;
}
export const coverageSnapshot = snapshotCache(() =>
  api<SignatureGroup[]>("/stats/coverage/groups"),
);
export const visaSnapshot = snapshotCache(() =>
  api<ReturnType<typeof timelineSnapshot>>("/stats/visas/snapshot?view=cases"),
);
const storyPages = keyedSnapshotCache<StoryPage>(8);
const storyDetails = keyedSnapshotCache<PublicStory>(4);
export function readStoryPage(q: string, after: string) {
  const params = new URLSearchParams({ q, after }).toString();
  return storyPages.read(params, () =>
    api<StoryPage>("/story-cards?" + params),
  );
}
export function readStoryDetail(id: string) {
  return storyDetails.read(id, () =>
    api<PublicStory>("/story/" + encodeURIComponent(id)),
  );
}
const signatorySnapshots = keyedSnapshotCache<SignatoryRoster>(8);
export function readSignatoryPage(before?: string) {
  return signatorySnapshots.read(before ?? "", () =>
    api<SignatoryRoster>(
      "/signatories" + (before ? "?" + new URLSearchParams({ before }) : ""),
    ),
  );
}

type SnapshotSource<T> = { read(): Promise<T> };
export function useSnapshot<T>(source: SnapshotSource<T>, enabled = true) {
  const [result, setResult] = useState<{
    source: SnapshotSource<T>;
    data?: T;
    error?: boolean;
  }>();
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    source.read().then(
      (data) => {
        if (active) setResult({ source, data });
      },
      () => {
        if (active) setResult({ source, error: true });
      },
    );
    return () => {
      active = false;
    };
  }, [source, enabled]);
  return enabled && result?.source === source ? result : undefined;
}
const demoSnapshot = snapshotCache(() =>
  api<{ profiles: PublicProfile[]; stories: PublicStory[] }>("/demo"),
);
export type Me = {
  user: {
    id: string;
    email?: string | null;
    microsoftEmail?: string;
    storageRegion?: "eu" | "us";
  } | null;
  profile: (Profile & { updatedAt: string; signedAt: string }) | null;
  story: Story | null;
};
type Config = {
  demoData: boolean;
  emailAuth: boolean;
  googleAuth: boolean;
  oauthProviders?: string[];
  devAuth: boolean;
  reminders: boolean;
};
const Context = createContext<{
  me: Me;
  config: Config;
  profiles: PublicProfile[];
  stories: PublicStory[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}>({} as any);
export function DataProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me>({ user: null, profile: null, story: null });
  const [config, setConfig] = useState<Config>({
    demoData: false,
    emailAuth: false,
    googleAuth: false,
    devAuth: false,
    reminders: false,
  });
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [stories, setStories] = useState<PublicStory[]>([]);
  const { pathname } = useLocation();
  const path = pathname.replace(/\/$/, "");
  const scope = ["/account", "/thank-you"].includes(path)
    ? "account"
    : path === "/feedback"
      ? "feedback"
      : "session";
  const [loadedScope, setLoadedScope] = useState("");
  const requestId = useRef(0);
  const loading = loadedScope !== scope;
  const [error, setError] = useState("");
  async function refresh() {
    const id = ++requestId.current;
    try {
      if (previewMode) {
        const sample = await demoSnapshot.read();
        if (id !== requestId.current) return;
        setMe({ user: null, profile: null, story: null });
        setConfig({
          demoData: true,
          emailAuth: false,
          googleAuth: false,
          devAuth: false,
          reminders: false,
        });
        setProfiles(sample.profiles);
        setStories(sample.stories);
        setError("");
        return;
      }
      const [m, c] = await Promise.all([
        api<Me>(scope === "account" ? "/me" : `/me?view=${scope}`),
        api<Config>("/config"),
      ]);
      if (id !== requestId.current) return;
      setMe(m);
      setConfig(c);
      setError("");
    } catch (e) {
      if (id === requestId.current) {
        setMe({ user: null, profile: null, story: null });
        setError((e as Error).message);
      }
    } finally {
      if (id === requestId.current) setLoadedScope(scope);
    }
  }
  useEffect(() => {
    void refresh();
    return () => {
      requestId.current++;
    };
  }, [scope]);
  return (
    <Context.Provider
      value={{ me, config, profiles, stories, loading, error, refresh }}
    >
      {children}
    </Context.Provider>
  );
}
export const useData = () => useContext(Context);
