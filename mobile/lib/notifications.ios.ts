const DEFAULT_REMINDERS = [9, 14, 20];

export async function requestPermissions(): Promise<boolean> {
  return false;
}

export async function scheduleMoodReminders(): Promise<void> {}

export async function setRemindersEnabled(_enabled: boolean): Promise<void> {}

export async function areRemindersEnabled(): Promise<boolean> {
  return false;
}

export async function setReminderTimes(_times: number[]): Promise<void> {}

export async function getReminderTimes(): Promise<number[]> {
  return DEFAULT_REMINDERS;
}
