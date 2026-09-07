# Plan - Campaign Banner Upload Refactor

The objective is to fix the 413 "Request Entity Too Large" error when uploading campaign banners. The root cause is likely the sequential upload of large files inside the campaign saving process, or browser-side request limits being triggered by the payload.

I will implement a "Direct Upload" strategy where each banner is uploaded immediately upon selection, updating the UI with progress and preventing the campaign from being saved until all uploads are complete.

## User Review Required

> [!IMPORTANT]
>
> - I will remove the automatic upload during "Save". Files will be uploaded to the `campaign-assets` bucket as soon as they are selected in the form.
> - A loading state will be added to each individual banner during its upload.
> - The "Save" button will be disabled until all pending uploads are finished.

## Technical Details

### 1. State Management Changes

- Update `CampaignsPage` state to track `uploadingFiles` (a set of filenames or unique IDs currently being uploaded).
- Store `bannerUrls` directly in the component state instead of just `File[]`.

### 2. Immediate Upload Logic

- Modify the `onChange` handler for banner and logo inputs to trigger an immediate upload to Supabase Storage.
- Maintain a local state of URLs for the preview.
- Ensure that if an upload fails, the specific error is shown and the file is not added to the campaign payload.

### 3. Save Payload Optimization

- The `saveCampaign` mutation will no longer receive `File` objects. It will only receive the pre-uploaded storage paths/URLs.
- This ensures the JSON payload remains small, avoiding any server-side request size limits (Base64 overhead).

### 4. Constraints Enforcement

- Enforce `MAX_IMAGE_SIZE = 10 * 1024 * 1024` (10MB) per file.
- Individual progress messages like "Enviando imagem 1 de 3..." will be displayed.

## Files to be modified

- `src/routes/_authenticated/campanhas.tsx`: Main logic for the campaign form and upload handling.
