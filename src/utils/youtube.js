export function getYouTubeId(url = "") {
  if (!url) return "";

  if (url.includes("youtu.be/")) {
    return url.split("youtu.be/")[1].split("?")[0].split("&")[0];
  }

  if (url.includes("watch?v=")) {
    return url.split("watch?v=")[1].split("&")[0];
  }

  if (url.includes("/embed/")) {
    return url.split("/embed/")[1].split("?")[0].split("&")[0];
  }

  return "";
}

export function toEmbedUrl(url) {
  const id = getYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : url;
}

export function toThumbnailUrl(url) {
  const id = getYouTubeId(url);
  return id
    ? `https://img.youtube.com/vi/${id}/mqdefault.jpg`
    : "https://placehold.co/320x180/0e1a2f/d6e2ff?text=Song";
}