import {
  createContext,
  useContext,
  useState,
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
  const r = await fetch(`/api${url}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}
export type Me = {
  user: { id: string; email: string } | null;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function refresh() {
    try {
      const [m, c, p, s] = await Promise.all([
        api<Me>("/me"),
        api<Config>("/config"),
        api<{ profiles: PublicProfile[] }>("/public"),
        api<{ stories: PublicStory[] }>("/stories"),
      ]);
      setMe(m);
      setConfig(c);
      setProfiles(p.profiles);
      setStories(s.stories);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <Context.Provider
      value={{ me, config, profiles, stories, loading, error, refresh }}
    >
      {children}
    </Context.Provider>
  );
}
export const useData = () => useContext(Context);
