# 🎙️ Voice Therapy Setup Guide

## Overview

MHtoolkit now includes **AI Voice Therapy** - have natural voice conversations with an empathetic AI therapist powered by OpenAI.

## Features

✅ **Natural voice conversations** - Speak and listen like talking to a real therapist  
✅ **Real-time transcription** - Powered by OpenAI Whisper  
✅ **Therapeutic voice** - Warm, empathetic "Nova" voice  
✅ **Audio visualization** - See your voice as you speak  
✅ **Privacy-focused** - Audio processed securely, not stored  

## Setup

### 1. Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign up or log in
3. Click "Create new secret key"
4. Copy your key

### 2. Add to `.env.local`

```bash
OPENAI_API_KEY=sk-proj-your-key-here
```

### 3. Restart Dev Server

```bash
npm run dev
```

## How It Works

### Voice Input (Speech-to-Text)
- Uses your browser's microphone
- Transcribed by **OpenAI Whisper** (best accuracy)
- Sent to AI chat (Gemini/Claude)

### Voice Output (Text-to-Speech)
- AI response generated (text)
- Converted to speech by **OpenAI TTS-HD**
- "Nova" voice (warm, empathetic female voice)
- Slightly slower speed for therapeutic pacing

## Usage

1. Go to **AI Chat** page
2. Click **"🎙️ Voice Mode"** button
3. Grant microphone permission
4. Click **"Start Talking"** and speak naturally
5. AI will respond with voice

## Pricing

OpenAI charges for voice features:

| Feature | Model | Cost |
|---------|-------|------|
| Speech-to-Text | Whisper | $0.006/minute |
| Text-to-Speech | TTS-HD | $0.030/1K chars |

**Example:** 10-minute therapy session ≈ $0.30

### Cost-Saving Tips:
- Use text mode for casual conversations
- Reserve voice mode for deeper sessions
- Voice responses are ~300 chars = ~$0.01 each

## Voice Selection

Available therapeutic voices:
- **Nova** (default) - Warm, empathetic female
- **Alloy** - Neutral, calm
- **Echo** - Male, supportive
- **Fable** - Gentle, reassuring

Edit `lib/ai/voice-chat.ts` to change default voice.

## Privacy & Security

🔒 **Your voice is secure:**
- Audio streams directly to OpenAI
- Not stored in database
- Transcripts can be saved (optional)
- No third-party access

## Browser Support

Works best on:
- ✅ Chrome/Edge (best support)
- ✅ Safari (iOS/macOS)
- ⚠️ Firefox (limited features)

Requires:
- HTTPS connection (mic access)
- Microphone permission

## Troubleshooting

**Microphone not working?**
- Check browser permissions
- Ensure HTTPS (not HTTP)
- Try different browser

**No audio output?**
- Check device volume
- Verify OpenAI API key
- Check browser console for errors

**High latency?**
- Check internet connection
- OpenAI API may be slow (their issue)
- Consider text mode for faster responses

## Future Enhancements

Planned features:
- 🔄 Real-time streaming (lower latency)
- 🎭 Emotion detection in voice
- 📊 Session insights from voice tone
- 🌍 Multi-language support
- 💾 Session recording & playback

---

**Need help?** Check the console logs or open an issue on GitHub.
