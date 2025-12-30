# MHtoolkit

A privacy-first mental health support platform offering mood tracking, CBT-informed AI chat, assessments, goal setting with prioritization frameworks, habit tracking, and more.

## ✨ Features

- **🎭 Mood Tracking**: Daily check-ins with trend visualization and tagging
- **📋 Self-Assessments**: GAD-7, PHQ-9, CBI, PSS-4 assessments with interpretations
- **💬 AI Chat**: CBT-informed conversational support powered by Claude 3.5 Sonnet
- **✅ Life Organizer**: Goal setting with Eisenhower Matrix, Ivy Lee, 1-3-5, ABCDE frameworks
- **📚 Book Library**: Curated mental health book summaries with key takeaways
- **🎯 Habit Tracker**: Build and track daily habits with streak counting
- **✨ Smart Affirmations**: AI-personalized daily affirmations based on your data
- **🔒 Anonymous Mode**: Start using without signup, optionally create account later
- **🔐 Privacy First**: Full data export, one-click deletion, no tracking

## 🛠 Tech Stack

- **Frontend**: Next.js 15 with App Router, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **AI**: Hybrid (Google Gemini 1.5 Flash [free] + Claude 3.5 Sonnet for complex cases)
- **Voice Therapy**: OpenAI-powered natural voice conversations
- **Charts**: Recharts
- **Deployment**: Vercel

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account ([supabase.com](https://supabase.com))
- Google AI API key (free at ai.google.dev)
- Anthropic API key (optional, only for complex/crisis cases) ([console.anthropic.com](https://console.anthropic.com))

### Installation

1. **Clone and install dependencies**

```bash
git clone <repository-url>
cd MentalHealthProject
npm install
```

2. **Set up environment variables**

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Then fill in your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

3. **Set up Supabase database**

Run the migrations in `supabase/migrations/` in your Supabase SQL editor in order:

```
001_initial_schema.sql   → Creates tables, types, indexes
002_rls_policies.sql     → Sets up Row Level Security
003_seed_data.sql        → Seeds affirmations and books
```

4. **Run the development server**

```bash
npm run dev
```

5. **Open [http://localhost:3000](http://localhost:3000)**

## 📂 Project Structure

```
/app
  /page.tsx              - Landing page
  /onboarding            - Onboarding flow
  /dashboard             - Main dashboard
  /tracker               - Mood tracking
  /assessments           - Self-assessments
  /chat                  - AI chat
  /goals                 - Life organizer
  /library               - Book summaries
  /habits                - Habit tracker
  /affirmations          - Daily affirmations
  /settings              - Privacy & account settings
  /auth                  - Login/signup
  /api                   - API routes

/components
  /ui                    - shadcn/ui components
  /mood                  - Mood selector
  /navigation.tsx        - Main navigation

/lib
  /supabase              - Supabase client & types
  /ai                    - Claude AI integration
  /assessments           - Assessment definitions
  /affirmations          - Affirmation engine
  /session.ts            - Anonymous session management
  /auth-context.tsx      - Auth provider
  /hooks                 - Custom hooks

/supabase
  /migrations            - SQL migrations
```

## 🗄️ Database Schema

The platform uses Supabase (PostgreSQL) with Row Level Security. Key tables:

- `anonymous_sessions` - Anonymous user sessions
- `moods` - Daily mood check-ins
- `assessments` - Self-assessment results
- `goals` - Daily goals and priorities
- `habits` - User habits
- `habit_logs` - Daily habit check-ins
- `chat_history` - AI conversation history
- `affirmations` - Affirmation library
- `books` - Book summaries

All tables support both anonymous (session_id) and authenticated (user_id) access.

## 🔐 Privacy & Security

- **Anonymous by default**: No signup required
- **Row Level Security**: All data isolated by user/session
- **Data migration**: Seamless transition from anonymous to authenticated
- **Export & Delete**: One-click data export (JSON) and deletion
- **No tracking**: No analytics pixels or unnecessary data collection
- **Encryption**: All data encrypted at rest
- **GDPR/CCPA compliant**: Full data portability and right to deletion

## 🚀 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import project to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

Vercel will automatically detect Next.js and configure the build.

### Environment Variables (Production)

Set these in your Vercel dashboard:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
```

## 📝 Development Notes

- The app works fully offline-first with anonymous sessions
- Data migration happens automatically on signup
- All assessments use clinically-validated scales
- AI responses use CBT techniques and crisis detection
- Affirmations are personalized based on mood trends

## 🤝 Contributing

This is a personal mental health project. If you'd like to contribute or suggest features, please open an issue.

## ⚠️ Disclaimer

This app is a self-help tool and **not a replacement for professional therapy**. If you're in crisis:

- 🆘 Call **988** (Suicide & Crisis Lifeline)
- 💬 Text **HELLO** to **741741** (Crisis Text Line)
- 🌍 Visit [findahelpline.com](https://findahelpline.com)

## 📄 License

MIT

