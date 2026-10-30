export type RawTrack = {
  id: string;
  title: string;
  artist: string;
  artistIds: string[];
  album: string | null;
  coverUrl: string | null;
  durationMs: number;
};

type NamedEntity = {
  id?: string | number;
  name?: string;
};

export type NeteaseSongShape = {
  id: string | number;
  name: string;
  artists?: NamedEntity[];
  ar?: NamedEntity[];
  album?: { name?: string; picUrl?: string | null };
  al?: { name?: string; picUrl?: string | null };
  duration?: number;
  dt?: number;
};

function secureUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.startsWith("http://")
    ? `https://${value.slice("http://".length)}`
    : value;
}

export function mapSong(song: NeteaseSongShape): RawTrack {
  const artists = song.artists ?? song.ar ?? [];
  const album = song.album ?? song.al;

  return {
    id: String(song.id),
    title: song.name,
    artist:
      artists
        .map((artist) => artist.name?.trim())
        .filter(Boolean)
        .join(" / ") || "Unknown artist",
    artistIds: artists
      .map((artist) => artist.id)
      .filter((id): id is string | number => id !== undefined && id !== 0)
      .map(String),
    album: album?.name?.trim() || null,
    coverUrl: secureUrl(album?.picUrl),
    durationMs: song.duration ?? song.dt ?? 0,
  };
}
