// Marketing demonstrations load the live public portal configuration, but keep
// their isolated demo slugs so simulated check-ins never create visitor records.
const marketingPortalSources: Record<string, string> = {
  "demo-efraim": "6us8mzhk8ffh",
  "demo-barao": "j788xmylocks",
};

export function getMarketingPortalSourceSlug(slug: string) {
  return marketingPortalSources[slug] ?? null;
}

