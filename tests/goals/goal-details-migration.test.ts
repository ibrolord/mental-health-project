import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve('supabase/migrations/20260811081540_expand_goal_details.sql'),
  'utf8'
);

describe('goal details migration', () => {
  it('adds bounded notes and reminder ordering constraints', () => {
    expect(sql).toMatch(/add column if not exists notes text/i);
    expect(sql).toMatch(/char_length\(notes\) <= 5000/i);
    expect(sql).toMatch(/reminder_at is null or due_at is not null/i);
    expect(sql).toMatch(/reminder_at is null or reminder_at <= due_at/i);
  });

  it('keeps milestone and attachment rows owner-only', () => {
    expect(sql).toMatch(/create table public\.goal_milestones/i);
    expect(sql).toMatch(/create table public\.goal_attachments/i);
    expect(sql).toMatch(/alter table public\.goal_milestones enable row level security/i);
    expect(sql).toMatch(/alter table public\.goal_attachments enable row level security/i);
    expect(sql).toMatch(/user_id = \(select auth\.uid\(\)\)/i);
    expect(sql).toMatch(/unique index goal_milestones_goal_content_unique_idx[\s\S]*lower\(btrim\(content\)\)/i);
    const milestonesDefinition = sql.match(/create table public\.goal_milestones\s*\([\s\S]*?\n\);/i)?.[0] ?? '';
    const attachmentsDefinition = sql.match(/create table public\.goal_attachments\s*\([\s\S]*?\n\);/i)?.[0] ?? '';
    expect(milestonesDefinition).not.toMatch(/\bpartner_id\b/i);
    expect(milestonesDefinition).toMatch(/\bdue_at timestamptz\b/i);
    expect(attachmentsDefinition).not.toMatch(/\bpartner_id\b/i);
  });

  it('uses a private, owner-scoped, size-limited storage bucket', () => {
    expect(sql).toMatch(/'goal-attachments'[\s\S]*false[\s\S]*6291456/i);
    expect(sql).toMatch(/storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/i);
    expect(sql).not.toMatch(/create policy[\s\S]*storage\.objects for update/i);
  });
});
