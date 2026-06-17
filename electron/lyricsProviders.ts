export type LyricsSearchQuery = {
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
};

export type LyricsCandidate = {
  id?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  syncedLyrics?: string;
  plainLyrics?: string;
};

export type LyricsSearchResult =
  | {
      status: "matched";
      source: string;
      id?: number;
      trackName?: string;
      artistName?: string;
      albumName?: string;
      duration?: number;
      syncedLyrics?: string;
      plainLyrics?: string;
      candidates?: LyricsCandidate[];
    }
  | { status: "not-found"; candidates?: LyricsCandidate[] }
  | { status: "failed"; error?: string };

export interface LyricsProvider {
  id: string;
  search(query: LyricsSearchQuery): Promise<LyricsSearchResult>;
}

function scoreLyricsCandidate(candidate: LyricsCandidate, query: LyricsSearchQuery) {
  const title = String(candidate.trackName ?? "").toLowerCase();
  const artist = String(candidate.artistName ?? "").toLowerCase();
  const album = String(candidate.albumName ?? "").toLowerCase();
  let score = 0;
  if (query.title && title === String(query.title).toLowerCase()) score += 5;
  if (query.artist && artist === String(query.artist).toLowerCase()) score += 4;
  if (query.album && album === String(query.album).toLowerCase()) score += 2;
  if (candidate.syncedLyrics) score += 3;
  if (query.duration && candidate.duration) {
    const diff = Math.abs(Number(candidate.duration) - Number(query.duration));
    if (diff <= 2) score += 3;
    else if (diff <= 6) score += 1;
  }
  return score;
}

function buildLyricsSearchQueries(query: LyricsSearchQuery) {
  const artists = String(query.artist ?? "")
    .split(/\s*(?:,|£¬|&|¡¢|\||feat\.?|ft\.?)\s*/i)
    .map((artist) => artist.trim())
    .filter(Boolean);
  const primaryArtist = artists[0] || query.artist;
  const candidates = [
    query,
    { ...query, artist: primaryArtist, album: undefined },
    { ...query, artist: undefined, album: undefined },
    { ...query, artist: primaryArtist, album: undefined, duration: undefined },
    { ...query, artist: undefined, album: undefined, duration: undefined },
  ];
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = JSON.stringify(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sanitizeLyricsCandidate(candidate: any): LyricsCandidate {
  return {
    id: typeof candidate?.id === "number" ? candidate.id : undefined,
    trackName: typeof candidate?.trackName === "string" ? candidate.trackName : undefined,
    artistName: typeof candidate?.artistName === "string" ? candidate.artistName : undefined,
    albumName: typeof candidate?.albumName === "string" ? candidate.albumName : undefined,
    duration: typeof candidate?.duration === "number" ? candidate.duration : undefined,
    syncedLyrics: typeof candidate?.syncedLyrics === "string" ? candidate.syncedLyrics : undefined,
    plainLyrics: typeof candidate?.plainLyrics === "string" ? candidate.plainLyrics : undefined,
  };
}

async function searchLrclibOnce(query: LyricsSearchQuery) {
  const params = new URLSearchParams();
  params.set("track_name", query.title);
  if (query.artist) params.set("artist_name", query.artist);
  if (query.album) params.set("album_name", query.album);
  if (query.duration && Number.isFinite(query.duration)) params.set("duration", String(Math.round(query.duration)));

  const response = await fetch(`https://lrclib.net/api/search?${params.toString()}`, {
    headers: {
      "User-Agent": "TransparentLyrics/0.1.0 (local personal music player)",
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    return { ok: false as const, error: `LRCLIB ${response.status}` };
  }
  const candidates = await response.json();
  return { ok: true as const, candidates: Array.isArray(candidates) ? candidates : [], query };
}

export class LrclibLyricsProvider implements LyricsProvider {
  id = "lrclib";

  async search(query: LyricsSearchQuery): Promise<LyricsSearchResult> {
    try {
      let lastCandidates: LyricsCandidate[] = [];
      let lastError = "";
      for (const searchQuery of buildLyricsSearchQueries(query)) {
        const searchResult = await searchLrclibOnce(searchQuery);
        if (!searchResult.ok) {
          lastError = searchResult.error;
          continue;
        }
        const candidates = searchResult.candidates.map(sanitizeLyricsCandidate);
        const usableCandidates = candidates.filter((candidate) => candidate.syncedLyrics || candidate.plainLyrics);
        lastCandidates = usableCandidates.length ? usableCandidates : lastCandidates;
        if (!candidates.length) {
          continue;
        }
        const sorted = usableCandidates
          .map((candidate) => ({ candidate, score: scoreLyricsCandidate(candidate, searchQuery) }))
          .sort((left, right) => right.score - left.score);
        const best = sorted[0]?.candidate;
        if (!best?.syncedLyrics && !best?.plainLyrics) {
          continue;
        }
        return {
          status: "matched",
          source: this.id,
          id: best.id,
          trackName: best.trackName,
          artistName: best.artistName,
          albumName: best.albumName,
          duration: best.duration,
          syncedLyrics: best.syncedLyrics || undefined,
          plainLyrics: best.plainLyrics || undefined,
          candidates,
        };
      }
      if (lastError && !lastCandidates.length) {
        return { status: "failed", error: lastError };
      }
      return { status: "not-found", candidates: lastCandidates };
    } catch (error) {
      return { status: "failed", error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export function createLyricsProviders(): LyricsProvider[] {
  return [new LrclibLyricsProvider()];
}

export async function searchLyricsWithProviders(providers: LyricsProvider[], query: LyricsSearchQuery) {
  let lastFailure: LyricsSearchResult | undefined;
  for (const provider of providers) {
    const result = await provider.search(query);
    if (result.status === "matched") return result;
    if (result.status === "not-found" && result.candidates?.length) return result;
    if (result.status === "failed") lastFailure = result;
  }
  return lastFailure ?? { status: "not-found" };
}
