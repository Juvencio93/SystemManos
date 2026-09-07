# Plan for Implementing Chat Image and PDF Attachments

This plan outlines the steps to enable sending and viewing images and PDFs in the chat system, integrating Supabase Storage and a dedicated `chat_attachments` table.

## User Review Required

> [!IMPORTANT]
> - The current implementation uses a `chat_attachments` bucket and a `chat_attachments` table.
> - I will verify if a foreign key exists between `chat_attachments.message_id` and `messages.id` before proceeding. If missing, I will add it via migration.
> - The 20MB limit will be enforced both client-side and server-side.
> - Files will be stored in `chat/{conversationId}/{userId}/{uuid}-{filename}`.

## Proposed Changes

### Database & Storage
- Create a migration to ensure `chat_attachments` has a foreign key to `messages.id`.
- Ensure RLS policies for `chat_attachments` allow participants of the conversation to read the attachments.
- Update storage policies for the `chat_attachments` bucket to allow authenticated users to upload and read their conversation files.

### Backend (Server Functions)
- Update `sendMessage` in `src/lib/chat.functions.ts` to:
    - Accept optional `attachments` array.
    - Create the message first to get `messageId`.
    - Insert records into `chat_attachments`.
    - Allow empty `content` if attachments are present.
- Update `getConversations` in `src/lib/chat.functions.ts` to fetch attachments for each message using an optimized query (joining or a second fetch).

### Frontend (UI/UX)
- **File Selection & Validation:**
    - Update `GlobalChatWidget.tsx` and `mensagens.tsx` to handle file selection.
    - Implement validation for formats (PNG, JPG, JPEG, WEBP, GIF, PDF) and 20MB size.
- **Upload Flow:**
    - Implement the upload to Supabase Storage before calling `sendMessage`.
    - Show loading states during upload.
- **Rendering:**
    - Create a new `ChatAttachment` component to render images (with preview/lightbox) and PDFs (with icon/download).
    - Ensure real-time updates show attachments immediately.
- **Real-time:**
    - Update listeners to handle incoming messages with attachments.

## Technical Details
- **Storage Path:** `chat/${conversationId}/${userId}/${crypto.randomUUID()}-${file.name}`.
- **Security:** Use signed URLs for private bucket access.
- **Real-time:** The `chat:message` broadcast payload will be updated to signal that a message has attachments, triggering a refetch or including attachment metadata.

## Validation Plan
- [ ] ADM sends PNG to Matriz -> Matriz receives and visualizes.
- [ ] Matriz sends PDF to ADM -> ADM receives and visualizes.
- [ ] Verify 20MB limit blocks large files.
- [ ] Verify unsupported formats are blocked.
- [ ] Confirm database integrity (message once, attachment linked).
- [ ] Test persistence after page reload.
- [ ] Check mobile responsiveness.
