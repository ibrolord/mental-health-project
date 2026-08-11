export class AccountabilityAuthError extends Error {
  constructor(message = 'Please sign in to use Together.') {
    super(message);
    this.name = 'AccountabilityAuthError';
  }
}

export class AccountabilityApiError extends Error {
  readonly status: number;
  readonly detail?: string;

  constructor(message: string, status = 0, detail?: string) {
    super(message);
    this.name = 'AccountabilityApiError';
    this.status = status;
    this.detail = detail;
  }
}
