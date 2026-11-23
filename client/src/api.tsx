import { useLocation } from "react-router-dom";
import { previewMode } from "./preview";
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
} from "../../shared/schema";
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
  return data;
}
export type Me = {
  user: { id: string; email?: string; storageRegion?: "eu" | "us" } | null;
  profile: (Profile & { updatedAt: string; signedAt: string }) | null;
  story: Story | null;
};
type Config = {
  demoData: boolean;
  emailAuth: boolean;
  googleAuth: boolean;
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
        const sample = await api<{
          profiles: PublicProfile[];
          stories: PublicStory[];
        }>("/demo");
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

// Key results to the request so a slow response cannot replace newer filters.
export function usePublicView<T>(path: string | null) {
  const [result, setResult] = useState<{
    path: string;
    data?: T;
    error?: boolean;
  }>();
  useEffect(() => {
    if (!path || previewMode) {
      setResult(undefined);
      return;
    }
    const controller = new AbortController();
    api<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ path, data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ path, error: true });
      });
    return () => controller.abort();
  }, [path]);
  return result?.path === path ? result : undefined;
}
