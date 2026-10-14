// Links out to a piece of music on Spotify and Apple Music.
const tidy = (text: string) => text.replace(/\([^)]*\)/g, " ").replace(/\bfrom\b/gi, " ").replace(/[,:]/g, " ").replace(/\s+/g, " ").trim();
export const listenLinks = (what: string, exact?: { spotify?: string; appleMusic?: string }) => {
  const q = encodeURIComponent(tidy(what));
  return { spotify: exact?.spotify || `https://open.spotify.com/search/${q}`, appleMusic: exact?.appleMusic || `https://music.apple.com/search?term=${q}` };
};

const Spotify = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="#1ed760" />
    <path d="M6.600 9.300c3.700-1.100 7.700-.8 10.800 1M7.200 12.400c3-.9 6.200-.6 8.800.9M7.900 15.300c2.300-.6 4.600-.4 6.500.7" fill="none" stroke="#0b0810" strokeWidth="1.700" strokeLinecap="round" />
  </svg>
);
const Apple = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="am-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ff5e73" />
        <stop offset="1" stopColor="#fa2d48" />
      </linearGradient>
    </defs>
    <rect width="24" height="24" rx="6.500" fill="url(#am-fill)" />
    <path d="M10 16.300V8.200l6.200-1.400v7.900" fill="none" stroke="#fff" strokeWidth="1.600" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="8.400" cy="16.400" r="1.700" fill="#fff" />
    <circle cx="14.600" cy="14.800" r="1.700" fill="#fff" />
  </svg>
);

// `compact` shows the two badges on their own (for lists); otherwise each is a labelled button.
export function ListenLinks({ what, exact, label, compact = false }: { what: string; exact?: { spotify?: string; appleMusic?: string }; label?: string; compact?: boolean }) {
  const to = listenLinks(what, exact);
  return (
    <span className="listen" data-compact={compact}>
      {label && <span className="mono">{label}</span>}
      <span className="listen-pair">
        <a href={to.spotify} target="_blank" rel="noreferrer" aria-label={`${tidy(what)} on Spotify`} title="Open in Spotify">
          <Spotify />
          {!compact && <span>Spotify</span>}
        </a>
        <a href={to.appleMusic} target="_blank" rel="noreferrer" aria-label={`${tidy(what)} on Apple Music`} title="Open in Apple Music">
          <Apple />
          {!compact && <span>Apple Music</span>}
        </a>
      </span>
    </span>
  );
}
