import { AppButton } from './AppUI';

export function ToolCompletionRetry({ completion }: {
  completion: { canRetry: boolean; retrying: boolean; retry(): Promise<boolean> };
}) {
  if (!completion.canRetry) return null;
  return (
    <AppButton
      label={completion.retrying ? 'Adding to Today...' : 'Retry adding to Today'}
      variant="secondary"
      disabled={completion.retrying}
      onPress={() => void completion.retry()}
      style={{ marginTop: 12 }}
    />
  );
}
