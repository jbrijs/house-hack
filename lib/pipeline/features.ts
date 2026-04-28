import OpenAI from 'openai'

export interface ExtractedFeatures {
  hasBasementApt: boolean
  hasAdu: boolean
  separateEntrance: boolean
  parkingSpaces: number
  layoutNotes: string
}

let _client: OpenAI | null = null
function getClient(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _client
}

const SYSTEM_PROMPT = `You are a real estate analyst specializing in house hacking.
Extract features from listing descriptions. Return valid JSON with exactly these fields:
- hasBasementApt: boolean — true if description mentions basement apartment/unit/suite, MIL suite, mother-in-law suite
- hasAdu: boolean — true if description mentions ADU, accessory dwelling unit, casita, guest house, carriage house
- separateEntrance: boolean — true if description mentions separate entrance, private entrance, separate entry, own entrance
- parkingSpaces: number — total parking spaces mentioned (garage + driveway), 0 if not mentioned
- layoutNotes: string — 1 sentence on house-hack potential based on the description`

export async function extractFeatures(description: string): Promise<ExtractedFeatures> {
  if (!description || description.trim().length < 20) {
    return { hasBasementApt: false, hasAdu: false, separateEntrance: false, parkingSpaces: 0, layoutNotes: '' }
  }

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: description.slice(0, 1500) },
    ],
    max_tokens: 200,
    temperature: 0,
  })

  const raw = response.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw)
  return {
    hasBasementApt: Boolean(parsed.hasBasementApt),
    hasAdu: Boolean(parsed.hasAdu),
    separateEntrance: Boolean(parsed.separateEntrance),
    parkingSpaces: Number(parsed.parkingSpaces) || 0,
    layoutNotes: String(parsed.layoutNotes ?? ''),
  }
}
