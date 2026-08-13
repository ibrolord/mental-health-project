import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const mobileGoals = readFileSync(resolve('mobile/app/goals.tsx'), 'utf8');
const mobileDetails = readFileSync(resolve('mobile/components/GoalDetailModal.tsx'), 'utf8');
const webGoals = readFileSync(resolve('app/goals/page.tsx'), 'utf8');
const webDetails = readFileSync(resolve('components/goals/goal-detail-panel.tsx'), 'utf8');
const exportRoute = readFileSync(resolve('app/api/data/export/route.ts'), 'utf8');
const attachmentCleanup = readFileSync(resolve('lib/goals/attachment-cleanup.ts'), 'utf8');
const mobileAttachmentCleanup = readFileSync(
  resolve('mobile/lib/goals/attachment-cleanup.ts'),
  'utf8'
);

describe('goal details UI wiring', () => {
  it.each([
    ['mobile', mobileDetails],
    ['web', webDetails],
  ])('supports timing, notes, milestones, and private files on %s', (_platform, source) => {
    expect(source).toContain('reminder_at');
    expect(source).toContain('notes');
    expect(source).toContain("from('goal_milestones')");
    expect(source).toContain(".select('id, content, position, due_at, completed_at')");
    expect(source).toContain('due_at: milestoneDueAt');
    expect(source).toContain(".update({ due_at:");
    expect(source).toContain("from('goal_attachments')");
    expect(source).toContain("from(GOAL_ATTACHMENT_BUCKET)");
    expect(source).toContain('createSignedUrl');
  });

  it.each([
    ['mobile', mobileGoals],
    ['web', webGoals],
  ])('keeps unfinished goals visible and removes stored files before deletion on %s', (_platform, source) => {
    expect(source).toContain('status.eq.pending,and(status.eq.completed,date.eq.');
    expect(source).not.toContain('status.eq.pending,date.eq.');
    expect(source).toContain("from('goal_attachments')");
    expect(source).toContain('.remove(paths)');
    expect(source).toContain('!ids.includes(goal.id)');
  });

  it('allows authenticated anonymous profiles to load scheduled goal reminders', () => {
    const notificationLoader = readFileSync(resolve('mobile/lib/notification-content.ts'), 'utf8');
    expect(notificationLoader).not.toContain('is_anonymous');
    expect(notificationLoader).toContain(".not('reminder_at', 'is', null)");
  });

  it('falls back to the copied file size when iOS picker metadata omits it', () => {
    expect(mobileDetails).toContain('const size = asset.size ?? selectedFile.size');
    expect(mobileDetails).toContain('size_bytes: size || bytes.byteLength');
  });

  it('reports when a saved native goal reminder is inactive', () => {
    expect(mobileDetails).toContain('areRemindersEnabled()');
    expect(mobileDetails).toContain('getNotificationPreferences()');
    expect(mobileDetails).toContain('scheduleDueDateReminders()');
    expect(mobileDetails).not.toContain('setRemindersEnabled(true)');
    expect(mobileDetails).toContain('Turn on Notifications in Settings');
    expect(mobileDetails).toContain('Turn on Goal reminders in Settings');
  });

  it('guards native detail state when switching between goals', () => {
    expect(mobileGoals).toContain("key={`${ownerKey}:${selectedGoal?.id ?? 'closed-goal-details'}`}");
    expect(mobileGoals).toContain('ownerGenerationRef.current');
    expect(mobileDetails).toContain('activeGoalKeyRef.current !== requestKey');
    expect(mobileDetails).toContain('`${userId}:${goal.id}`');
  });

  it('warns before closing native goal details with unsaved edits', () => {
    expect(mobileDetails).toContain('Discard unsaved changes?');
    expect(mobileDetails).toContain('onRequestClose={requestClose}');
    expect(mobileDetails).toContain('notes.trim() !== savedDraftRef.current.notes.trim()');
    expect(mobileDetails).toContain('milestoneInput.trim().length > 0');
    expect(mobileDetails).toContain('milestoneDueAt !== null');
    expect(mobileDetails).toContain('editingMilestoneDueId !== null');
    expect(mobileDetails).toContain('if (mutationInProgress) return;');
    expect(mobileDetails).toContain('Discard changes and start focus?');
  });

  it('supports adding, editing, clearing, and reloading milestone due dates', () => {
    expect(webDetails).toContain('setMilestoneDueValue');
    expect(webDetails).toContain('updateMilestoneDueDate');
    expect(webDetails).toContain('toDateTimeLocalValue(milestone.due_at)');
    expect(mobileDetails).toContain('setMilestoneDueAt(null)');
    expect(mobileDetails).toContain('saveMilestoneDueDate(milestone, null)');
    expect(mobileDetails).toContain('editingMilestoneDueId === milestone.id');
    expect(mobileDetails).toContain('if (editingMilestoneDueId === milestone.id)');
    expect(mobileDetails).toContain('disabled={Boolean(updatingMilestoneDueId)}');
    expect(mobileDetails).toContain('minimumDate={new Date()}');
    expect(webDetails).toContain('min={minimumDueValue}');
    expect(webDetails).toContain('activeGoalKeyRef.current !== requestKey');
    expect(webDetails).toContain('Discard unsaved goal changes?');
    expect(webDetails).toContain('closeRef.current?.focus();');
    expect(webDetails).toContain('}, [goal.id]);');
    expect(mobileDetails).toContain('scrollRef.current?.scrollToEnd');
    expect(mobileDetails).toContain('setMilestoneDueAt(new Date(Date.now() + 60 * 60 * 1000))');
  });

  it('prevents save, close, and delete races in native goal details', () => {
    expect(mobileDetails).toContain('if (!userId || mutationInProgress) return;');
    expect(mobileDetails).toContain('disabled={mutationInProgress}');
    expect(mobileDetails).toContain('current === notes ? savedNotes : current');
    expect(mobileDetails).toContain('milestoneMutationCount > 0');
    expect(mobileDetails).toContain('attachmentMutationCount > 0');
    expect(mobileDetails).toContain("if (!deleted) setError('Could not delete that goal. Please try again.')");
    expect(mobileDetails).toContain('width: 44, height: 44');
  });

  it('includes file bytes in exports and paginates attachment cleanup', () => {
    expect(exportRoute).toContain(".download(row.storage_path)");
    expect(exportRoute).toContain("content_encoding: 'base64'");
    expect(exportRoute).toContain('content_base64:');
    expect(exportRoute).toContain('.range(from, from + ATTACHMENT_PAGE_SIZE - 1)');
    expect(exportRoute).toContain('new ReadableStream<Uint8Array>');
    expect(attachmentCleanup).toContain('.range(from, from + STORAGE_PAGE_SIZE - 1)');
    expect(attachmentCleanup).toContain('.list(prefix, {');
    expect(attachmentCleanup).toContain('else prefixes.push(path)');
    expect(attachmentCleanup).toContain('allPaths.slice(index, index + STORAGE_PAGE_SIZE)');
  });

  it('queues failed native file cleanup for a later retry', () => {
    expect(mobileDetails).toContain('enqueueGoalAttachmentCleanup');
    expect(mobileGoals).toContain('enqueueGoalAttachmentCleanup');
    expect(mobileAttachmentCleanup).toContain('flushGoalAttachmentCleanup');
    expect(mobileAttachmentCleanup).toContain("value.startsWith(`${userId}/`)");
  });
});
