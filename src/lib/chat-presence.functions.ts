import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const updateMyPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        status: z.enum(["online", "away", "busy", "offline"]),
        nowPlaying: z.string().trim().max(160).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error } = await supabase
      .from('chat_user_presence')
      .upsert({
        user_id: userId,
        status: data.status as any, // Cast to any because types might be out of sync
        now_playing: data.nowPlaying ?? null,
        last_seen_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('[Presence] Error updating status:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  });

export const getPresenceStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        profileIds: z.array(z.string()),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: presence, error } = await supabase
      .from('chat_user_presence')
      .select('user_id, status, last_seen_at, now_playing')
      .in('user_id', data.profileIds);

    if (error) {
      console.error('[Presence] Error fetching status:', error);
      return [];
    }

    return (presence || []).map(p => ({
      profile_id: p.user_id,
      status: p.status,
      last_seen_at: p.last_seen_at
      ,now_playing: p.now_playing
    }));
  });

