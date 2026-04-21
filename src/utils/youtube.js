export function toEmbedUrl(url) {
  if (!url) return "";

  // Case 1: youtu.be/VIDEO_ID
  if (url.includes("youtu.be/")) {
    const id = url.split("youtu.be/")[1];
    return `https://www.youtube.com/embed/${id}`;
  }

  // Case 2: youtube.com/watch?v=VIDEO_ID
  if (url.includes("watch?v=")) {
    const id = url.split("watch?v=")[1].split("&")[0];
    return `https://www.youtube.com/embed/${id}`;
  }

  // Already embed or unknown format
  return url;
}