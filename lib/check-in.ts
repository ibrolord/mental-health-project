export interface LocalCheckInFields {
  local_date: string;
  utc_offset_minutes: number;
}

export function getLocalCheckInFields(date = new Date()): LocalCheckInFields {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return {
    local_date: `${year}-${month}-${day}`,
    utc_offset_minutes: -date.getTimezoneOffset(),
  };
}
