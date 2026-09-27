// Mock sounds for local development to avoid 404s
// In a real environment, these would be actual mp3 files in public/src/assets/sounds/
const silence = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

export const MOCK_SOUNDS = {
  message: silence,
  online: silence,
  nudge: silence,
};
