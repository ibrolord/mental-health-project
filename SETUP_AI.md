# AI Setup Guide

## Hybrid AI System

MHtoolkit uses a **smart hybrid approach**:
- **Google Gemini 1.5 Flash** (free) for 90% of conversations
- **Claude 3.5 Sonnet** (paid) only for complex/crisis situations

This minimizes costs while maintaining high quality for sensitive cases.

## 1. Get Google AI API Key (Free)

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Get API Key" or "Create API Key"
4. Copy your key

**Free Tier Limits:**
- 15 requests per minute
- 1,500 requests per day
- Completely free, no credit card required

## 2. (Optional) Get Claude API Key

Only needed if you want the premium Claude model for complex cases. Without it, all conversations will use Gemini.

1. Go to [Anthropic Console](https://console.anthropic.com)
2. Sign up and add payment method
3. Create API key
4. Copy your key

**Note:** Claude is only used for:
- Crisis situations (suicide, self-harm mentions)
- Trauma/abuse discussions
- Conversations longer than 10 messages
- When user explicitly requests deeper help

## 3. Add to .env.local

```bash
# Required
GOOGLE_API_KEY=your_google_ai_api_key_here

# Optional (system falls back to Gemini if not set)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

## Model Routing Logic

The system automatically detects:

```
✅ Uses Gemini (Free):
- General mental health questions
- Daily check-ins
- Mood tracking discussions
- CBT technique requests
- Habit/goal advice

🔄 Switches to Claude (Paid):
- Crisis keywords detected
- Trauma/PTSD topics
- Long conversations (>10 messages)
- User says "I need more help"
```

## Testing

Run the app and check the console logs - you'll see:
```
[Model Router] Standard conversation → Using Gemini (free)
[Model Router] Crisis detected → Using Claude
```
