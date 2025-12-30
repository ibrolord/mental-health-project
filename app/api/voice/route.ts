import { NextRequest, NextResponse } from 'next/server';
import { generateVoiceResponse, transcribeAudio } from '@/lib/ai/voice-chat';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    // Handle text-to-speech
    if (contentType.includes('application/json')) {
      const { text, voice } = await request.json();
      
      if (!text) {
        return NextResponse.json(
          { error: 'Text is required' },
          { status: 400 }
        );
      }

      const audioResponse = await generateVoiceResponse(text, voice);
      const buffer = Buffer.from(await audioResponse.arrayBuffer());

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': buffer.length.toString(),
        },
      });
    }
    
    // Handle speech-to-text
    if (contentType.includes('multipart/form-data') || contentType.includes('audio/')) {
      const formData = await request.formData();
      const audioFile = formData.get('audio') as File;

      if (!audioFile) {
        return NextResponse.json(
          { error: 'Audio file is required' },
          { status: 400 }
        );
      }

      const transcription = await transcribeAudio(audioFile);

      return NextResponse.json({ transcription });
    }

    return NextResponse.json(
      { error: 'Invalid content type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Voice API error:', error);
    return NextResponse.json(
      { error: 'Failed to process voice request' },
      { status: 500 }
    );
  }
}
