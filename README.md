# MHtoolkit

A privacy-first self-reflection toolkit offering mood tracking, optional AI-guided prompts, published-source self-assessments, private planning, routines, focus tools, and local exercises.

## ✨ Features

- **🎭 Mood Tracking**: Daily check-ins with trend visualization and tagging
- **📋 Self-Assessments**: GAD-7 and PHQ-9 symptom screeners plus the CBI personal burnout measure, with published scoring and limitations
- **💬 AI Chat**: Evidence-informed self-reflection support powered by Claude
- **✅ Life Organizer**: Goal setting with Eisenhower Matrix, Ivy Lee, 1-3-5, ABCDE frameworks
- **📚 Resource Library**: Direct paths to app tools plus reviewed book notes that separate author claims from clinical guidance
- **🎯 Habits & Routines**: Build or reduce habits with cues, tiny steps, templates, streaks, and reward milestones
- **⏱ Focus Mode**: Goal-linked focus and break blocks with optional locally generated sound
- **🧠 Mind Games**: Five evidence-honest exercises cached for offline use after the first visit
- **🧭 Life Planner**: Private dreams, motivations, obstacles, milestones, horizons, and next steps
- **🔔 Reminders**: Opt-in generic Web Push with owner-scoped schedules and delivery records
- **✨ Smart Affirmations**: AI-personalized daily affirmations based on your data
- **🔒 Anonymous Mode**: Start using without signup, optionally create account later
- **🔐 Privacy First**: Full data export, one-click deletion, no ads or cross-app tracking

## 🛠 Tech Stack

- **Frontend**: Next.js 15 with App Router, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **AI**: Hybrid (Google Gemini 1.5 Flash [free] + Claude 3.5 Sonnet for complex cases)
- **Voice Support**: OpenAI-powered natural voice conversations
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

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then fill in your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

3. **Set up Supabase database**

Apply every migration in `supabase/migrations/` in filename order. New tables
are explicitly granted to the authenticated role and protected with owner-scoped
Row Level Security.

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
  /focus                 - Focus and break timer
  /mind-games            - Local attention exercises
  /planner               - Private life planner
  /research              - Evidence and limitations
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
- `life_plan_items` - Private directions, obstacles, and milestones
- `focus_sessions` - Focus configuration and completion history
- `wellbeing_reminders` - Owner-scoped recurring and one-time schedules
- `push_subscriptions` - Optional per-browser Web Push subscription
- `reminder_deliveries` - Deduplicated generic delivery receipts
- `dismissed_notices` - Owner-scoped UI notice preferences
- `chat_history` - AI conversation history
- `affirmations` - Affirmation library
- `books` - Book summaries

Core user-data tables support legacy anonymous (`session_id`) and authenticated
(`user_id`) ownership. Current anonymous sessions use Supabase anonymous Auth
users, and aggregate acquisition attribution is keyed only by `user_id`.

## 🔐 Privacy & Security

- **Anonymous by default**: No signup required
- **Row Level Security**: All data isolated by user/session
- **Data migration**: Seamless transition from anonymous to authenticated
- **Export & Delete**: One-click data export (JSON) and deletion
- **Privacy-preserving measurement**: Anonymous page analytics and allowlisted
  campaign labels support aggregate activation reporting; no advertising IDs,
  referrer URLs, or mental-health content are included
- **Encryption**: All data encrypted at rest
- **User-controlled data**: Complete export and permanent deletion controls

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
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
CRON_SECRET
NEXT_PUBLIC_REMINDER_DISPATCH_ENABLED
```

Generate VAPID keys with `npx web-push generate-vapid-keys`. Background
reminders also require a scheduler to call
`GET /api/reminders/dispatch` every five minutes with
`Authorization: Bearer <CRON_SECRET>`. The current Vercel project is on Hobby,
whose cron minimum is once per day, so `vercel.json` intentionally does not
declare an invalid five-minute cron. Set
`NEXT_PUBLIC_REMINDER_DISPATCH_ENABLED=true` only after a compatible external
scheduler or Vercel Pro cron is active.

## 📝 Development Notes

- Mind Games is cached for offline use after its first successful visit; the
  rest of the app requires network access for synchronized private data
- Data migration happens automatically on signup
- Assessments use widely used screening questionnaires
- AI responses provide self-reflection prompts and crisis resource routing
- Affirmations are personalized based on mood trends

## 🤝 Contributing

This is a personal mental health project. If you'd like to contribute or suggest features, please open an issue.

## ⚠️ Disclaimer

This app is a self-help tool and **not a replacement for professional therapy**.
If you are in immediate danger, contact local emergency services or go to the
nearest emergency department. For verified country-specific support, visit
[findahelpline.com](https://findahelpline.com).

## 📄 License

[GNU AGPL-3.0-only](LICENSE).

You are free to use, study, modify and share this code. If you run a
modified version as a network service, the AGPL requires you to publish your
changes under the same licence.

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, and
[SECURITY.md](SECURITY.md) to report a vulnerability privately.
