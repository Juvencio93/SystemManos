export interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at?: string | null;
  delivered_at?: string | null;
  event?: string | null;
  conversation_id: string;
  chat_attachments?: unknown[];
  reply_to?: unknown;
  reply_to_message_id?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  isLocal?: boolean;
  isOptimistic?: boolean;
  sender_profile?: unknown;
  chat_message_receipts?: unknown[];
}

export interface ChatParticipant {
  profile_id?: string;
  branch_id?: string;
  participant_type?: string;
  branch?: {
    id: string;
    name: string;
    trade_name?: string;
  };
}

export interface ChatConversation {
  id: string;
  company_id?: string;
  last_message_at: string;
  conversation_participants: ChatParticipant[];
  messages: ChatMessage[];
}

