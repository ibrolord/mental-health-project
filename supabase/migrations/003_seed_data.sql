-- Seed Affirmations
INSERT INTO affirmations (content, mood_tags, category) VALUES
  ('You don''t need to do more. You need to do what matters.', ARRAY['😐'::mood_emoji, '😞'::mood_emoji], 'self-compassion'),
  ('Your worth isn''t measured by your productivity.', ARRAY['😞'::mood_emoji, '😢'::mood_emoji], 'self-compassion'),
  ('It''s okay to rest. Rest is not weakness.', ARRAY['😐'::mood_emoji, '😞'::mood_emoji], 'rest'),
  ('You are capable of handling what comes your way.', ARRAY['😐'::mood_emoji, '🙂'::mood_emoji], 'capability'),
  ('Progress, not perfection. Every small step counts.', ARRAY['😐'::mood_emoji, '🙂'::mood_emoji], 'growth'),
  ('You deserve boundaries that protect your peace.', ARRAY['😞'::mood_emoji, '😢'::mood_emoji], 'boundaries'),
  ('Your feelings are valid, even when they''re messy.', ARRAY['😐'::mood_emoji, '😞'::mood_emoji, '😢'::mood_emoji], 'self-compassion'),
  ('You''re not falling behind. You''re exactly where you need to be.', ARRAY['😐'::mood_emoji, '😞'::mood_emoji], 'self-compassion'),
  ('Taking care of yourself isn''t selfish. It''s essential.', ARRAY['😐'::mood_emoji, '😞'::mood_emoji], 'rest'),
  ('You don''t have to have it all figured out today.', ARRAY['😐'::mood_emoji, '😞'::mood_emoji], 'self-compassion'),
  ('Small wins still count. Celebrate them.', ARRAY['🙂'::mood_emoji, '😐'::mood_emoji], 'growth'),
  ('You''re allowed to change your mind and your path.', ARRAY['😐'::mood_emoji], 'growth'),
  ('Your past doesn''t define your future.', ARRAY['😐'::mood_emoji, '🙂'::mood_emoji], 'growth'),
  ('You have overcome 100% of your worst days.', ARRAY['😐'::mood_emoji, '😞'::mood_emoji], 'capability'),
  ('It''s okay to say no. Your energy matters.', ARRAY['😐'::mood_emoji], 'boundaries'),
  ('You''re doing better than you think you are.', ARRAY['😐'::mood_emoji, '😞'::mood_emoji], 'self-compassion'),
  ('Healing isn''t linear. Be patient with yourself.', ARRAY['😐'::mood_emoji, '😞'::mood_emoji], 'growth'),
  ('You don''t need permission to prioritize yourself.', ARRAY['😐'::mood_emoji], 'boundaries'),
  ('Your mental health is just as important as your physical health.', ARRAY['😐'::mood_emoji, '😞'::mood_emoji], 'self-compassion'),
  ('You are enough, exactly as you are right now.', ARRAY['😐'::mood_emoji, '😞'::mood_emoji, '😢'::mood_emoji], 'self-compassion');

-- Seed Books
INSERT INTO books (title, author, summary, takeaways, quote, action_step, tags, read_time_minutes) VALUES
  (
    'Atomic Habits',
    'James Clear',
    'A practical guide to building good habits and breaking bad ones through tiny changes that compound over time.',
    '["Focus on systems, not goals", "Make habits obvious, attractive, easy, and satisfying", "The 1% improvement rule compounds dramatically over time"]',
    'You do not rise to the level of your goals. You fall to the level of your systems.',
    'Pick one tiny habit you want to build. Make it so small you can''t say no. Example: 2 push-ups after morning coffee.',
    ARRAY['habits', 'productivity', 'self-improvement'],
    7
  ),
  (
    'The Happiness Trap',
    'Russ Harris',
    'An introduction to Acceptance and Commitment Therapy (ACT) that helps you escape the trap of chasing happiness and instead build a meaningful life.',
    '["Trying to control thoughts and feelings often backfires", "Acceptance is not resignation—it''s acknowledging reality", "Connect with your values and take action aligned with them"]',
    'The struggle switch: the more you fight your feelings, the stronger they become.',
    'Name one value that matters to you (e.g., connection, growth). Do one small action today that aligns with it.',
    ARRAY['anxiety', 'ACT', 'mindfulness', 'therapy'],
    8
  ),
  (
    'Feeling Good',
    'David D. Burns',
    'The foundational book on Cognitive Behavioral Therapy (CBT) for depression. Teaches how to identify and challenge distorted thinking patterns.',
    '["Your thoughts create your emotions", "Cognitive distortions (all-or-nothing thinking, overgeneralization) fuel depression", "You can learn to catch and reframe negative thoughts"]',
    'You feel the way you think.',
    'Write down one negative thought you had today. Ask: Is this thought 100% true? What''s a more balanced way to think about this?',
    ARRAY['depression', 'CBT', 'therapy', 'anxiety'],
    10
  ),
  (
    'When the Body Says No',
    'Gabor Maté',
    'Explores the connection between stress, emotional repression, and chronic illness. Shows how suppressing emotions can manifest as disease.',
    '["Chronic stress suppresses the immune system", "People-pleasing and ignoring your needs leads to burnout", "Your body keeps score—emotions you don''t express show up as symptoms"]',
    'It is not a sign of health to be well-adjusted to a sick society.',
    'Notice one moment this week where you said yes but wanted to say no. Practice saying it out loud, even just to yourself.',
    ARRAY['burnout', 'trauma', 'stress', 'health'],
    9
  ),
  (
    'Burnout: The Secret to Unlocking the Stress Cycle',
    'Emily Nagoski & Amelia Nagoski',
    'Explains why stress gets stuck in your body and how to complete the stress cycle through movement, creativity, and connection.',
    '["Stress is physical, not just mental—you must complete the cycle", "Movement, breathing, and crying help release stress", "Rest is not the same as recovery"]',
    'Dealing with your stress is a separate process from dealing with the thing that caused your stress.',
    'After a stressful moment, do 60 seconds of movement (shake your body, dance, stretch) to complete the stress cycle.',
    ARRAY['burnout', 'stress', 'recovery', 'women'],
    8
  ),
  (
    'The Gifts of Imperfection',
    'Brené Brown',
    'A guide to embracing vulnerability, letting go of perfectionism, and cultivating self-compassion and wholehearted living.',
    '["Perfectionism is not self-improvement—it''s a shield", "Vulnerability is the birthplace of connection and courage", "You are worthy of love and belonging, as you are"]',
    'Owning our story and loving ourselves through that process is the bravest thing we will ever do.',
    'Write down one thing you''ve been avoiding because it won''t be "perfect." Do it anyway, imperfectly.',
    ARRAY['self-compassion', 'vulnerability', 'shame', 'perfectionism'],
    7
  ),
  (
    'The Body Keeps the Score',
    'Bessel van der Kolk',
    'Groundbreaking work on trauma and how it lives in the body. Explains how trauma affects the brain and nervous system, and paths to healing.',
    '["Trauma is stored in the body, not just the mind", "Traditional talk therapy isn''t always enough—body-based therapies help", "Safety and connection are essential for healing"]',
    'Trauma is not what happens to you. Trauma is what happens inside you as a result of what happens to you.',
    'Try a body-grounding exercise: Press your feet into the floor, notice 5 things you can see, 4 you can touch.',
    ARRAY['trauma', 'healing', 'therapy', 'neuroscience'],
    12
  ),
  (
    'Mindset',
    'Carol Dweck',
    'Introduces the concept of fixed vs. growth mindset. Shows how your beliefs about your abilities shape your success and resilience.',
    '["Fixed mindset: abilities are static. Growth mindset: abilities can be developed", "Praise effort, not talent", "Failures are learning opportunities, not identity statements"]',
    'Becoming is better than being.',
    'Catch yourself saying "I can''t do this." Add the word "yet" to the end.',
    ARRAY['growth', 'resilience', 'self-improvement'],
    6
  );


