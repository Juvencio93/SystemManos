import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const saveAiMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => 
    z.object({
      content: z.string().min(1),
      category: z.enum(['decision', 'preference', 'strategy', 'goal', 'task', 'client', 'issue', 'recommendation', 'platform']),
      relatedId: z.string().uuid().optional(),
    }).parse(input)
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("ai_memories")
      .insert({
        user_id: context.userId,
        content: data.content,
        category: data.category,
        related_id: data.relatedId ?? null,
      });

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getAiMemories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => 
    z.object({
      search: z.string().optional(),
    }).parse(input)
  )
  .handler(async ({ context, data }) => {
    let query = context.supabase
      .from("ai_memories")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    if (data.search) {
      query = query.ilike("content", `%${data.search}%`);
    }

    const { data: memories, error } = await query;
    if (error) throw new Error(error.message);
    return memories;
  });

export const deleteAiMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => 
    z.object({
      id: z.string().uuid(),
    }).parse(input)
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("ai_memories")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const clearAiMemories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("ai_memories")
      .delete()
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { success: true };
  });
