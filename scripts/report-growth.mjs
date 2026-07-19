import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });

const LAUNCH_STARTED_AT = new Date('2026-07-19T13:00:00Z');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this report.'
  );
  process.exit(1);
}

const days = Number.parseInt(process.argv[2] ?? '90', 10);
if (!Number.isSafeInteger(days) || days < 1 || days > 365) {
  console.error('Usage: npm run growth:report -- <days>, where days is 1-365.');
  process.exit(1);
}

const since = new Date();
since.setUTCDate(since.getUTCDate() - days);
const reportSince =
  since > LAUNCH_STARTED_AT ? since : LAUNCH_STARTED_AT;

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data, error } = await supabase
  .from('growth_metrics_by_source')
  .select(
    'cohort_date,source,medium,campaign,content,platform,activated_users,eligible_for_week_one,engaged_users_3_of_7,eligible_for_repeat_use,returned_users_days_8_to_14'
  )
  .gte('cohort_date', reportSince.toISOString().slice(0, 10))
  .order('cohort_date', { ascending: false });

if (error) {
  console.error(`Growth report failed: ${error.message}`);
  process.exit(1);
}

const rows = data ?? [];
const unattributedActivations = rows
  .filter((row) => row.source === 'unattributed')
  .reduce((total, row) => total + Number(row.activated_users), 0);
const totals = rows.reduce(
  (sum, row) => ({
    activated: sum.activated + Number(row.activated_users),
    weekOneEligible:
      sum.weekOneEligible + Number(row.eligible_for_week_one),
    engaged: sum.engaged + Number(row.engaged_users_3_of_7),
    repeatEligible:
      sum.repeatEligible + Number(row.eligible_for_repeat_use),
    returned:
      sum.returned + Number(row.returned_users_days_8_to_14),
  }),
  {
    activated: 0,
    weekOneEligible: 0,
    engaged: 0,
    repeatEligible: 0,
    returned: 0,
  }
);

const percentage = (part, whole) =>
  whole === 0 ? 'n/a' : `${((part / whole) * 100).toFixed(1)}%`;

console.log(
  `MHtoolkit growth report: ${reportSince.toISOString().slice(0, 10)} to present`
);
console.log(`Activated users: ${totals.activated}`);
console.log(`Unattributed activations: ${unattributedActivations}`);
console.log(
  `3-of-7 engagement: ${totals.engaged}/${totals.weekOneEligible} (${percentage(
    totals.engaged,
    totals.weekOneEligible
  )})`
);
console.log(
  `Days 8-14 return: ${totals.returned}/${totals.repeatEligible} (${percentage(
    totals.returned,
    totals.repeatEligible
  )})`
);

if (rows.length > 0) {
  console.table(rows);
}

if (unattributedActivations > 0) {
  console.error(
    'MEASUREMENT WARNING: unattributed activations are excluded from channel claims. Investigate attribution delivery before reporting launch totals.'
  );
  process.exitCode = 2;
}
