import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260904023000_redesign_chat_routing_keys.sql"),
  "utf8",
);
const preferenceFix = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260904023500_fix_chat_routing_preference_insert.sql"),
  "utf8",
);

describe("critical SQL contracts", () => {
  it("keeps chat routing deterministic and protected from direct client execution", () => {
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS conversations_company_routing_key_uidx");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.chat_find_or_create_conversation[\s\S]*FROM PUBLIC, anon, authenticated/);
    expect(migration).toContain("p_canonical_key");
  });

  it("keeps preference writes idempotent", () => {
    expect(preferenceFix).toContain("WHERE NOT EXISTS");
    expect(preferenceFix).toContain("chat_find_or_create_conversation");
    expect(preferenceFix).not.toContain("ON CONFLICT (user_id, conversation_id)");
  });
});

