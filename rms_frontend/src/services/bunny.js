/**
 * Bunny Stream CDN Service
 * Unified media path configuration for the entire RMS.
 * All modules (Audit Logs, Document Studio, etc.) use this service.
 */

const BUNNY_LIBRARY_ID = import.meta.env.VITE_BUNNY_LIBRARY_ID || '';
const BUNNY_CDN_HOST = import.meta.env.VITE_BUNNY_CDN_HOST || '';
const BUNNY_API_KEY = import.meta.env.VITE_BUNNY_API_KEY || '';

// Base URL for streaming/embedding videos
const CDN_BASE = `https://${BUNNY_CDN_HOST}`;

/**
 * Get the embed/playback URL for a video by its Bunny video ID.
 * @param {string} videoId - The Bunny Stream video GUID
 * @returns {string} Full playback URL
 */
export const getVideoUrl = (videoId) => {
  if (!videoId || !BUNNY_CDN_HOST) return '';
  return `${CDN_BASE}/${videoId}/play_720p.mp4`;
};

/**
 * Get the HLS streaming URL for adaptive playback.
 * @param {string} videoId
 * @returns {string} HLS manifest URL
 */
export const getHlsUrl = (videoId) => {
  if (!videoId || !BUNNY_CDN_HOST) return '';
  return `${CDN_BASE}/${videoId}/playlist.m3u8`;
};

/**
 * Get the thumbnail URL for a video.
 * @param {string} videoId
 * @returns {string} Thumbnail image URL
 */
export const getThumbnailUrl = (videoId) => {
  if (!videoId || !BUNNY_CDN_HOST) return '';
  return `${CDN_BASE}/${videoId}/thumbnail.jpg`;
};

/**
 * Get the iframe embed URL for a video.
 * @param {string} videoId
 * @returns {string} Embed iframe src
 */
export const getEmbedUrl = (videoId) => {
  if (!videoId || !BUNNY_LIBRARY_ID) return '';
  return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${videoId}?autoplay=false&preload=true`;
};

/**
 * Upload a video to Bunny Stream via their API.
 * @param {string} title - Video title
 * @returns {Promise<object>} Created video object with guid
 */
export const createVideo = async (title) => {
  const res = await fetch(`https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`, {
    method: 'POST',
    headers: {
      'AccessKey': BUNNY_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });
  return res.json();
};

/**
 * Upload video binary to a created video slot.
 * @param {string} videoId - The GUID from createVideo
 * @param {File} file - The video file to upload
 * @returns {Promise<object>}
 */
export const uploadVideo = async (videoId, file) => {
  const res = await fetch(`https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`, {
    method: 'PUT',
    headers: {
      'AccessKey': BUNNY_API_KEY,
    },
    body: file,
  });
  return res.json();
};

export default {
  BUNNY_LIBRARY_ID,
  BUNNY_CDN_HOST,
  CDN_BASE,
  getVideoUrl,
  getHlsUrl,
  getThumbnailUrl,
  getEmbedUrl,
  createVideo,
  uploadVideo,
};
