-- The browser optimizes accepted photos to 320x320 WebP before upload.
-- This limit applies to the original file selected by the user.
UPDATE storage.buckets
SET file_size_limit = 20971520
WHERE id = 'chat-avatars';
