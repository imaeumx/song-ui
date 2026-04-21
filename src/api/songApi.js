import axios from "axios";

const API_URL = "https://song-api-qfoc.onrender.com/henson/songs";

export const getSongs = () => axios.get(API_URL);

export const searchSongs = (keyword) =>
  axios.get(`${API_URL}/search/${keyword}`);