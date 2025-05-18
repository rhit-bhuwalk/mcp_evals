import axios from "axios";

export const kushApi = axios.create({
  baseURL: "http://0.0.0.0:8000",
  withCredentials: true,
});

export const arianApi = axios.create({
  baseURL: "http://127.0.0.1:3000",
  withCredentials: true,
});
