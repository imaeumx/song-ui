import { useCallback, useEffect, useRef, useState } from "react";
import { getSongs, searchSongs } from "./api/songApi";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { getYouTubeId, toThumbnailUrl } from "./utils/youtube";

const loadYouTubeApi = () => {
  if (window.YT?.Player) {
    return Promise.resolve();
  }

  if (!window.__songUiYouTubeApiPromise) {
    window.__songUiYouTubeApiPromise = new Promise((resolve) => {
      const existingScript = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]',
      );
      const previousReady = window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady = () => {
        if (typeof previousReady === "function") {
          previousReady();
        }

        resolve();
      };

      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.body.appendChild(script);
      }
    });
  }

  return window.__songUiYouTubeApiPromise;
};

export default function App() {
  const [songs, setSongs] = useState([]);
  const [queue, setQueue] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedSong, setSelectedSong] = useState(null);
  const [isShuffleEnabled, setIsShuffleEnabled] = useState(false);
  const [queueMenuAnchor, setQueueMenuAnchor] = useState(null);
  const [queueMenuSong, setQueueMenuSong] = useState(null);
  const [draggedQueueSongId, setDraggedQueueSongId] = useState(null);
  const playerContainerRef = useRef(null);
  const playerRef = useRef(null);
  const songsRef = useRef([]);
  const queueRef = useRef([]);
  const selectedSongRef = useRef(null);
  const shufflePoolRef = useRef([]);
  const goToNextSongRef = useRef(() => {});

  useEffect(() => {
    songsRef.current = songs;
  }, [songs]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    selectedSongRef.current = selectedSong;
  }, [selectedSong]);

  const addToQueueTop = useCallback((song) => {
    setQueue((currentQueue) => {
      const remainingQueue = currentQueue.filter((queuedSong) => queuedSong.id !== song.id);
      return [song, ...remainingQueue];
    });
  }, []);

  const removeFromQueue = useCallback((songId) => {
    setQueue((currentQueue) => currentQueue.filter((queuedSong) => queuedSong.id !== songId));
  }, []);

  const moveQueueItem = useCallback((songId, targetIndex) => {
    setQueue((currentQueue) => {
      const fromIndex = currentQueue.findIndex((queuedSong) => queuedSong.id === songId);

      if (fromIndex === -1) return currentQueue;

      const boundedTarget = Math.max(0, Math.min(targetIndex, currentQueue.length - 1));

      if (fromIndex === boundedTarget) return currentQueue;

      const nextQueue = [...currentQueue];
      const [movedSong] = nextQueue.splice(fromIndex, 1);
      nextQueue.splice(boundedTarget, 0, movedSong);

      return nextQueue;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const playSongAndSyncQueue = useCallback((song) => {
    if (!song) return;

    const currentQueue = queueRef.current;
    const selectedIndex = currentQueue.findIndex((queuedSong) => queuedSong.id === song.id);

    if (selectedIndex !== -1) {
      // If user plays #2 or #3 in queue, consume everything before it as skipped.
      setQueue((existingQueue) => {
        const liveIndex = existingQueue.findIndex((queuedSong) => queuedSong.id === song.id);
        if (liveIndex === -1) return existingQueue;
        return existingQueue.slice(liveIndex + 1);
      });
    }

    setSelectedSong(song);
  }, []);

  const goToPreviousSong = useCallback(() => {
    const library = songsRef.current;

    if (!library.length) return;

    const activeId = selectedSongRef.current?.id;
    const activeIndex = library.findIndex((song) => song.id === activeId);
    const safeIndex = activeIndex >= 0 ? activeIndex : 0;
    const previousIndex = (safeIndex - 1 + library.length) % library.length;

    setSelectedSong(library[previousIndex]);
  }, []);

  const goToNextSong = useCallback(() => {
    const queuedSong = queueRef.current[0];

    if (queuedSong) {
      setQueue((currentQueue) => currentQueue.slice(1));
      setSelectedSong(queuedSong);
      return;
    }

    const library = songsRef.current;

    if (!library.length) return;

    if (isShuffleEnabled) {
      const currentId = selectedSongRef.current?.id;
      const validIds = new Set(library.map((song) => song.id));

      shufflePoolRef.current = shufflePoolRef.current.filter((id) => validIds.has(id));

      if (!shufflePoolRef.current.length) {
        const baseIds = library
          .map((song) => song.id)
          .filter((id) => id !== currentId);

        for (let i = baseIds.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [baseIds[i], baseIds[j]] = [baseIds[j], baseIds[i]];
        }

        shufflePoolRef.current = baseIds;
      }

      const nextShuffledId = shufflePoolRef.current.shift();
      const nextShuffledSong = library.find((song) => song.id === nextShuffledId);

      if (nextShuffledSong) {
        setSelectedSong(nextShuffledSong);
        return;
      }
    }

    const activeId = selectedSongRef.current?.id;
    const activeIndex = library.findIndex((song) => song.id === activeId);
    const safeIndex = activeIndex >= 0 ? activeIndex : 0;
    const nextIndex = (safeIndex + 1) % library.length;

    setSelectedSong(library[nextIndex]);
  }, [isShuffleEnabled]);

  const handleShuffleSong = useCallback(() => {
    setIsShuffleEnabled((current) => {
      const nextValue = !current;

      if (!nextValue) {
        shufflePoolRef.current = [];
      }

      return nextValue;
    });
  }, []);

  useEffect(() => {
    goToNextSongRef.current = goToNextSong;
  }, [goToNextSong]);

  const loadSongs = async (keyword = "") => {
    setLoading(true);
    setError("");

    try {
      const res = keyword ? await searchSongs(keyword) : await getSongs();
      const list = Array.isArray(res.data) ? res.data : [];

      setSongs(list);

      if (list.length === 0) {
        setSelectedSong(null);
        return;
      }

      setSelectedSong((prevSong) => {
        if (!prevSong) return list[0];
        return list.find((song) => song.id === prevSong.id) || list[0];
      });
    } catch (err) {
      setError("Could not load songs right now. Please try again.");
      setSongs([]);
      setSelectedSong(null);
      console.error("Song API error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSongs(search.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    return () => {
      if (playerRef.current?.destroy) {
        playerRef.current.destroy();
      }

      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!selectedSong?.url) return;

    const videoId = getYouTubeId(selectedSong.url);

    if (!videoId) return;

    let cancelled = false;

    const syncPlayer = async () => {
      await loadYouTubeApi();

      if (cancelled || !playerContainerRef.current) return;

      if (!playerRef.current) {
        playerRef.current = new window.YT.Player(playerContainerRef.current, {
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onStateChange: (event) => {
              if (event.data === window.YT.PlayerState.ENDED) {
                goToNextSongRef.current();
              }
            },
          },
        });

        return;
      }

      playerRef.current.loadVideoById(videoId);
    };

    syncPlayer().catch((err) => {
      console.error("YouTube player error", err);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedSong?.id, selectedSong?.url]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
  };

  const closeQueueMenu = () => {
    setQueueMenuAnchor(null);
    setQueueMenuSong(null);
  };

  const handleQueueMenuOpen = (event, song) => {
    event.stopPropagation();
    setQueueMenuAnchor(event.currentTarget);
    setQueueMenuSong(song);
  };

  const handleAddQueuedSong = () => {
    if (queueMenuSong) {
      addToQueueTop(queueMenuSong);
    }

    closeQueueMenu();
  };

  const handleQueueDragStart = (event, songId) => {
    event.stopPropagation();
    setDraggedQueueSongId(songId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(songId));
  };

  const handleQueueDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
  };

  const handleQueueDrop = (event, targetIndex) => {
    event.preventDefault();
    event.stopPropagation();

    const rawId = event.dataTransfer.getData("text/plain");
    const parsedId = Number(rawId);
    const sourceId = draggedQueueSongId ?? (Number.isNaN(parsedId) ? rawId : parsedId);

    if (sourceId === null || sourceId === undefined || sourceId === "") {
      return;
    }

    moveQueueItem(sourceId, targetIndex);
    setDraggedQueueSongId(null);
  };

  const handleQueueDragEnd = () => {
    setDraggedQueueSongId(null);
  };

  return (
    <div className="min-h-screen app-shell">
      <div className="glow glow-left" />
      <div className="glow glow-right" />

      <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">MUSIC VIDEO CATALOG</p>
            <h1 className="title">SongTube</h1>
            <p className="subtitle">Search tracks, pick a card, and play instantly.</p>
          </div>

          <TextField
            value={search}
            onChange={handleSearch}
            placeholder="Search songs, artists, albums..."
            variant="outlined"
            size="small"
            sx={{
              width: { xs: "100%", sm: 380 },
              "& .MuiOutlinedInput-root": {
                backgroundColor: "rgba(10, 16, 28, 0.7)",
                color: "#eef3ff",
                borderRadius: "12px",
                "& fieldset": { borderColor: "rgba(30, 215, 96, 0.22)" },
                "&:hover fieldset": { borderColor: "rgba(30, 215, 96, 0.42)" },
                "&.Mui-focused fieldset": { borderColor: "#1ed760" },
              },
              "& .MuiInputBase-input::placeholder": {
                color: "rgba(220, 231, 255, 0.7)",
                opacity: 1,
              },
            }}
          />
        </header>

        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 3,
              borderRadius: "12px",
              backgroundColor: "rgba(70, 12, 18, 0.68)",
              color: "#ffd9de",
              border: "1px solid rgba(255, 59, 48, 0.35)",
            }}
          >
            {error}
          </Alert>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <article className="panel p-4 sm:p-6">
            {selectedSong ? (
              <>
                <div className="video-wrap mb-4">
                  <div ref={playerContainerRef} className="player-frame" aria-label="YouTube player" />
                </div>

                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Typography variant="h5" sx={{ color: "#f6f9ff", fontWeight: 700, mb: 0.5 }}>
                      {selectedSong.title}
                    </Typography>
                    <Typography sx={{ color: "rgba(232, 240, 255, 0.82)", mb: 0.5 }}>
                      {selectedSong.artist}
                    </Typography>
                    <Typography sx={{ color: "rgba(183, 202, 237, 0.82)", fontSize: "0.95rem" }}>
                      {selectedSong.album} • {selectedSong.genre}
                    </Typography>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <IconButton
                      onClick={handleShuffleSong}
                      aria-label={isShuffleEnabled ? "Disable shuffle" : "Enable shuffle"}
                      title={isShuffleEnabled ? "Shuffle enabled" : "Shuffle disabled"}
                      className={`shuffle-button ${isShuffleEnabled ? "is-active" : ""}`}
                    >
                      <svg
                        className="shuffle-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M3 7h3l8 10h3" />
                        <path d="M17 17l4 0l-2 2" />
                        <path d="M3 17h3l2.6-3.3" />
                        <path d="M14.4 10.3L17 7h4" />
                        <path d="M19 5l2 2l-2 2" />
                      </svg>
                      {isShuffleEnabled && <span className="shuffle-dot" />}
                    </IconButton>

                    <Button
                      onClick={() => addToQueueTop(selectedSong)}
                      variant="outlined"
                      sx={{
                        borderColor: "rgba(255, 59, 48, 0.72)",
                        color: "#ffd8d5",
                        borderRadius: "999px",
                        px: 2.1,
                        py: 0.85,
                        textTransform: "none",
                        fontWeight: 700,
                        "&:hover": {
                          borderColor: "#ff3b30",
                          backgroundColor: "rgba(255, 59, 48, 0.1)",
                        },
                      }}
                    >
                      Add to queue
                    </Button>

                    <Button
                      href={selectedSong.url}
                      target="_blank"
                      rel="noreferrer"
                      variant="contained"
                      sx={{
                        backgroundColor: "#1ed760",
                        borderRadius: "999px",
                        px: 2.4,
                        py: 0.9,
                        textTransform: "none",
                        fontWeight: 700,
                        color: "#05110a",
                        "&:hover": { backgroundColor: "#18c355" },
                      }}
                    >
                      Open on YouTube
                    </Button>
                  </div>
                </div>

              </>
            ) : (
              <div className="empty-panel">
                <Typography variant="h6" sx={{ color: "#eff4ff", mb: 1 }}>
                  No song selected
                </Typography>
                <Typography sx={{ color: "rgba(204, 218, 243, 0.85)" }}>
                  Try a different keyword to find tracks.
                </Typography>
              </div>
            )}

            <div className="mt-6 border-t border-[rgba(120,152,214,0.24)] pt-4">
              <div className="mb-2 flex items-center justify-between px-1">
                <Typography variant="subtitle1" sx={{ color: "#eef4ff", fontWeight: 700 }}>
                  Up Next Queue
                </Typography>
                <Typography sx={{ color: "rgba(188, 206, 238, 0.9)", fontSize: "0.9rem" }}>
                  {queue.length} songs
                </Typography>
              </div>

              <div className="mb-3 flex gap-2 px-1">
                <Button
                  onClick={goToPreviousSong}
                  disabled={!songs.length}
                  variant="outlined"
                  size="small"
                  sx={{
                    borderColor: "rgba(30, 215, 96, 0.6)",
                    color: "#dfffe8",
                    borderRadius: "999px",
                    textTransform: "none",
                    fontWeight: 700,
                    "&:hover": {
                      borderColor: "#1ed760",
                      backgroundColor: "rgba(30, 215, 96, 0.1)",
                    },
                  }}
                >
                  Previous
                </Button>

                <Button
                  onClick={goToNextSong}
                  disabled={!queue.length && !songs.length}
                  variant="contained"
                  size="small"
                  sx={{
                    backgroundColor: "#ff8a84",
                    borderRadius: "999px",
                    textTransform: "none",
                    fontWeight: 700,
                    color: "#2a0604",
                    "&:hover": { backgroundColor: "#ff746d" },
                  }}
                >
                  Next
                </Button>

                <Button
                  onClick={clearQueue}
                  disabled={!queue.length}
                  variant="outlined"
                  size="small"
                  sx={{
                    borderColor: "rgba(30, 215, 96, 0.6)",
                    color: "#dfffe8",
                    borderRadius: "999px",
                    textTransform: "none",
                    fontWeight: 700,
                    "&:hover": {
                      borderColor: "#1ed760",
                      backgroundColor: "rgba(30, 215, 96, 0.1)",
                    },
                  }}
                >
                  Clear
                </Button>
              </div>

              {queue.length === 0 ? (
                <div className="empty-panel min-h-28">
                  <Typography sx={{ color: "rgba(197, 214, 244, 0.88)" }}>
                    Add songs to queue to keep them lined up here.
                  </Typography>
                </div>
              ) : (
                <div className="queue-list">
                  {queue.map((song, index) => (
                    <div
                      key={`${song.id}-queue`}
                      className="queue-item"
                      onClick={() => playSongAndSyncQueue(song)}
                      onDragOver={handleQueueDragOver}
                      onDrop={(event) => handleQueueDrop(event, index)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          playSongAndSyncQueue(song);
                        }
                      }}
                    >
                      <IconButton
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        draggable
                        onDragStart={(event) => handleQueueDragStart(event, song.id)}
                        onDragEnd={handleQueueDragEnd}
                        className="queue-handle"
                        aria-label="Reorder queue item"
                      >
                        <Typography sx={{ fontSize: "1rem", lineHeight: 1, color: "#ffffff" }}>☰</Typography>
                      </IconButton>

                      <CardMedia
                        component="img"
                        image={toThumbnailUrl(song.url)}
                        alt={song.title}
                        sx={{ width: 72, height: 48, borderRadius: 1, objectFit: "cover" }}
                      />

                      <div className="queue-item-copy">
                        <Typography sx={{ color: "#f4f8ff", fontWeight: 700, lineHeight: 1.2 }}>
                          {index + 1}. {song.title}
                        </Typography>
                        <Typography sx={{ color: "rgba(207, 220, 246, 0.9)", fontSize: "0.84rem" }}>
                          {song.artist}
                        </Typography>
                      </div>

                      <div className="queue-item-actions">
                        <Button
                          onClick={(event) => {
                            event.stopPropagation();
                            removeFromQueue(song.id);
                          }}
                          variant="text"
                          size="small"
                          sx={{
                            color: "#ffb3ad",
                            minWidth: "auto",
                            px: 1,
                            textTransform: "none",
                            fontWeight: 700,
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </article>

          <aside className="panel p-3 sm:p-4">
            <div className="mb-2 flex items-center justify-between px-1">
              <Typography variant="subtitle1" sx={{ color: "#eef4ff", fontWeight: 700 }}>
                Song List
              </Typography>
              <Typography sx={{ color: "rgba(188, 206, 238, 0.9)", fontSize: "0.9rem" }}>
                {songs.length} tracks
              </Typography>
            </div>

            <Divider sx={{ borderColor: "rgba(120, 152, 214, 0.24)", mb: 1.5 }} />

            {loading ? (
              <div className="flex min-h-56 items-center justify-center">
                <CircularProgress sx={{ color: "#1ed760" }} />
              </div>
            ) : songs.length === 0 ? (
              <div className="empty-panel min-h-56">
                <Typography sx={{ color: "rgba(197, 214, 244, 0.88)" }}>
                  No songs found for this search.
                </Typography>
              </div>
            ) : (
              <div className="song-list">
                {songs.map((song, index) => {
                  const isActive = selectedSong?.id === song.id;

                  return (
                    <Card
                      key={song.id}
                      onClick={() => playSongAndSyncQueue(song)}
                      className="song-card"
                      sx={{
                        cursor: "pointer",
                        borderRadius: "14px",
                        position: "relative",
                        overflow: "hidden",
                        border: isActive
                          ? "1px solid rgba(30, 215, 96, 0.62)"
                          : "1px solid rgba(115, 145, 205, 0.2)",
                        background: isActive
                          ? "linear-gradient(130deg, rgba(30, 215, 96, 0.18), rgba(7, 18, 12, 0.96))"
                          : "linear-gradient(130deg, rgba(23, 36, 62, 0.82), rgba(10, 16, 30, 0.9))",
                        boxShadow: isActive
                          ? "0 14px 30px rgba(30, 215, 96, 0.18)"
                          : "0 10px 22px rgba(0, 0, 0, 0.32)",
                        animationDelay: `${index * 60}ms`,
                      }}
                    >
                      <div className="flex">
                        <CardMedia
                          component="img"
                          image={toThumbnailUrl(song.url)}
                          alt={song.title}
                          sx={{ width: 140, objectFit: "cover" }}
                        />

                        <CardContent sx={{ p: 1.5, pr: 5.5, "&:last-child": { pb: 1.5 } }}>
                          <Typography sx={{ color: "#f4f8ff", fontWeight: 700, lineHeight: 1.3, mb: 0.4 }}>
                            {song.title}
                          </Typography>
                          <Typography sx={{ color: "rgba(207, 220, 246, 0.9)", fontSize: "0.86rem", mb: 0.6 }}>
                            {song.artist}
                          </Typography>
                          <Typography sx={{ color: "rgba(173, 194, 231, 0.88)", fontSize: "0.78rem" }}>
                            {song.album}
                          </Typography>
                        </CardContent>

                        <IconButton
                          onClick={(event) => handleQueueMenuOpen(event, song)}
                          onMouseDown={(event) => event.stopPropagation()}
                          sx={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            width: 34,
                            height: 34,
                            color: "#f3f7ff",
                            backgroundColor: "rgba(6, 10, 18, 0.45)",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                            "&:hover": {
                              backgroundColor: "rgba(30, 215, 96, 0.16)",
                              color: "#1ed760",
                            },
                          }}
                          aria-label="Open queue options"
                        >
                          <Typography sx={{ fontSize: "1.5rem", lineHeight: 1, mt: -0.2 }}>
                            ⋮
                          </Typography>
                        </IconButton>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            <Menu
              anchorEl={queueMenuAnchor}
              open={Boolean(queueMenuAnchor)}
              onClose={closeQueueMenu}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              sx={{
                "& .MuiPaper-root": {
                  mt: 1,
                  borderRadius: 3,
                  backgroundColor: "#08160d !important",
                  border: "1px solid rgba(30, 215, 96, 0.26)",
                  minWidth: 180,
                  color: "#eef6ff",
                  boxShadow: "0 14px 30px rgba(0, 0, 0, 0.45)",
                },
              }}
              PaperProps={{
                sx: {
                  mt: 1,
                  borderRadius: 3,
                  backgroundColor: "#08160d",
                  border: "1px solid rgba(30, 215, 96, 0.2)",
                  minWidth: 180,
                  color: "#eef6ff",
                },
              }}
            >
              <MenuItem
                onClick={handleAddQueuedSong}
                sx={{
                  color: "#eef6ff !important",
                  fontWeight: 700,
                  "&:hover": { backgroundColor: "rgba(30, 215, 96, 0.18)" },
                }}
              >
                Add to queue
              </MenuItem>
            </Menu>
          </aside>
        </section>
      </div>
    </div>
  );
}