import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const SUPPORT_INSTRUCTIONS = `You are a warm, empathetic AI support companion conducting a voice support conversation.

Your communication style:
- Speak naturally and conversationally, like a supportive coach
- Use a calm, soothing tone
- Pause appropriately to let the person process
- Reflect back what you hear to show understanding
- Ask open-ended questions that encourage exploration
- Never rush the person

Support approach:
- Offer optional evidence-informed reflection exercises
- Practice active listening and validation
- Help users notice thought patterns without labeling or diagnosing
- Offer gentle reframes and alternative perspectives
- Teach coping strategies and grounding techniques
- Celebrate small wins and progress

Safety protocols:
- If crisis language detected (suicide, self-harm), immediately provide:
  * 988 Suicide & Crisis Lifeline
  * Crisis Text Line: Text HOME to 741741
  * Encourage calling emergency services if immediate danger
- Never diagnose, treat, or give medical advice
- Remind that you're a self-help support tool, not a replacement for professional care

Session flow:
1. Start with: "Hi, I'm here to listen. How are you feeling today?"
2. Follow their lead - let them guide the conversation
3. Ask clarifying questions to understand deeper
4. Offer insights and techniques when appropriate
5. End with one small next step they can take today

Remember: You're creating a safe, judgment-free space for someone to open up.`;

export interface VoiceSessionConfig {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  temperature?: number;
  maxDuration?: number; // in seconds
}

export const VOICE_NAMES = [
  'alloy',
  'echo',
  'fable',
  'onyx',
  'nova',
  'shimmer',
] as const;
export type VoiceName = (typeof VOICE_NAMES)[number];

export async function createVoiceSession(config: VoiceSessionConfig = {}) {
  const {
    voice = 'nova', // Warm, empathetic voice
    temperature = 0.8, // Slightly creative but controlled
    maxDuration = 1800, // 30 minutes max
  } = config;

  // This will be used client-side with WebRTC
  return {
    instructions: SUPPORT_INSTRUCTIONS,
    voice,
    temperature,
    maxDuration,
  };
}

// Server-side streaming for voice responses
export async function generateVoiceResponse(
  text: string,
  voice: VoiceName = 'nova'
) {
  try {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice,
      input: text,
      speed: 0.9, // Slightly slower for a calmer support tone
    });

    return mp3;
  } catch (error) {
    console.error('Voice generation error:', error);
    throw new Error('Failed to generate voice response');
  }
}

// Transcribe user audio to text
export async function transcribeAudio(audioFile: File | Blob) {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile as any,
      model: 'whisper-1',
      language: 'en',
    });

    return transcription.text;
  } catch (error) {
    console.error('Transcription error:', error);
    throw new Error('Failed to transcribe audio');
  }
}
