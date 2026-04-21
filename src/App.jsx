import { useEffect, useState } from "react";
import { getSongs, searchSongs } from "./api/songApi";
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Dialog,
} from "@mui/material";
import { toEmbedUrl } from "./utils/youtube";

export default function App() {
  const [songs, setSongs] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedSong, setSelectedSong] = useState(null);

  useEffect(() => {
    loadSongs();
  }, []);

  const loadSongs = async () => {
    const res = await getSongs();
    setSongs(res.data);
  };

  const handleSearch = async (e) => {
    const value = e.target.value;
    setSearch(value);

    if (value === "") {
      loadSongs();
    } else {
      const res = await searchSongs(value);
      setSongs(res.data);
    }
  };

  return (
    <div className="bg-black min-h-screen text-white p-4">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">🎵 SongTube</h1>

        <TextField
          value={search}
          onChange={handleSearch}
          placeholder="Search songs..."
          variant="outlined"
          size="small"
          sx={{ backgroundColor: "white", borderRadius: 1 }}
        />
      </div>

      {/* SONG GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

        {songs.map((song) => (
          <Card
            key={song.id}
            onClick={() => setSelectedSong(song)}
            className="cursor-pointer hover:scale-105 transition"
          >
            <CardContent>
              <Typography variant="h6">{song.title}</Typography>
              <Typography variant="body2">
                {song.artist}
              </Typography>
              <Typography variant="caption">
                {song.album} • {song.genre}
              </Typography>
            </CardContent>
          </Card>
        ))}

      </div>

      {/* VIDEO MODAL */}
      <Dialog
        open={!!selectedSong}
        onClose={() => setSelectedSong(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedSong && (
          <div className="p-4 bg-black text-white">
            <h2 className="text-xl mb-2">{selectedSong.title}</h2>

            <iframe
              width="100%"
              height="400"
              src={toEmbedUrl(selectedSong.url)}
              title="Song Video"
              allowFullScreen
            />
          </div>
        )}
      </Dialog>

    </div>
  );
}