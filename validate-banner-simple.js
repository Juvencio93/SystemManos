
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.TECH_SUPABASE_SERVICE_KEY;

const BannerResponseSchema = z.object({
  needsMoreInfo: z.boolean(),
  question: z.string().nullable(),
  promptOptions: z.array(z.object({ title: z.string(), prompt: z.string() })).length(2).nullable(),
  reminder: z.string().nullable(),
});

async function runTest() {
  console.log('--- STARTING VALIDATION [askBannerAgent] ---');
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
  const companyId = 'c7ada6f9-fd56-4572-8a10-2338a7a8fe42';

  try {
    const { computeCompanySnapshot, companyPrompt, BANNER_SYSTEM } = await import('./src/lib/company.server');
    const { CompanySnapshotSchema } = await import('./src/lib/utils/date-utils');
    const { callGateway } = await import('./src/lib/ai.server');

    const rawSnapshot = await computeCompanySnapshot(supabaseAdmin, companyId, null);
    const snapshot = CompanySnapshotSchema.parse(rawSnapshot);
    const companyCtx = companyPrompt(snapshot);

    const systemPrompt = BANNER_SYSTEM + '\n\nCONTEXTO DA EMPRESA:\n' + companyCtx;
    const userPrompt = 'USER: Banner de bolo de cenoura com cobertura de chocolate\n\nResponda apenas com o JSON.';

    const aiResponse = await callGateway(systemPrompt, userPrompt);
    if (!aiResponse.ok) throw new Error(aiResponse.error);

    const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
    const validated = BannerResponseSchema.parse(JSON.parse(jsonMatch[0]));

    console.log('SUCCESS: true');
    console.log('RESULT:', JSON.stringify(validated, null, 2));
  } catch (e) {
    console.error('FATAL ERROR:', e.message);
  }
}

runTest();
