import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getOrCreateConversation, resolveNudgeTargetUserIds } from "./chat-validation.functions";
import { sendMessage } from "./chat.functions";

export const callContactAttention = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({
    conversationId: z.string().uuid().optional(),
    recipientProfileId: z.string().uuid().optional(),
    clientMessageId: z.string().uuid(),
  }).refine(value => value.conversationId || value.recipientProfileId, {
    message: "Informe a conversa ou o destinatário.",
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    try {
      // Existing support conversations do not store an explicit ADM participant.
      // Prefer their conversation ID; keep recipient lookup for new contacts.
      const conversationId = data.conversationId || (
        await getOrCreateConversation({
          data: { recipientProfileId: data.recipientProfileId! }
        })
      ).conversationId;

      // 2. Persistir via fluxo canônico de mensagens
      const savedMessage = await sendMessage({
        data: {
          conversationId,
          clientMessageId: data.clientMessageId,
          content: "🫨",
          event: "nudge"
        }
      });

      // 3. Emitir o Realtime Broadcast para som e tremor
      const targetUserIds = await resolveNudgeTargetUserIds({ data: { conversationId } });
      
      if (targetUserIds && targetUserIds.length > 0) {
        const payload = {
          eventId: savedMessage.id,
          messageId: savedMessage.id,
          event: "nudge",
          conversationId,
          senderProfileId: userId,
          fromUserId: userId,
          targetUserIds,
          createdAt: savedMessage.created_at,
          sentAt: savedMessage.created_at,
        };

        const nudgeChannelNames = targetUserIds.flatMap((targetId) => [
          `local:widget:nudge:${targetId}`,
          `local:nudge:${targetId}`,
        ]);

        await Promise.all(nudgeChannelNames.map(async (channelName) => {
          const channel = supabase.channel(channelName);

          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 1500);
            channel.subscribe((status) => {
              if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                clearTimeout(timer);
                resolve();
              }
            });
          });

          await channel.send({
            type: "broadcast",
            event: "chat:nudge",
            payload,
          });
          
          void supabase.removeChannel(channel);
        }));
      }

      return { 
        conversationId, 
        eventId: savedMessage.id,
        messageId: savedMessage.id,
        senderProfileId: savedMessage.sender_id,
        recipientProfileId: targetUserIds[0] || null,
        clientMessageId: savedMessage.client_message_id,
        content: savedMessage.content
      };
    } catch (error: any) {
      console.error("callContactAttention failed", {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        conversationId: data.conversationId,
        recipientProfileId: data.recipientProfileId,
        currentProfileId: userId,
      });
      throw error;
    }
  });
