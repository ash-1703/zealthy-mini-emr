import { RRule } from 'rrule';
import { addMonths } from 'date-fns';

export function expandOccurrences(rrule: string | null | undefined, start: Date, horizonMonths = 3) {
  if (!rrule) return [start];
  const to = addMonths(new Date(), horizonMonths);
  const rule = RRule.fromString(rrule);
  const between = rule.between(start, to, true);
  return [start, ...between].sort((a,b)=>a.getTime()-b.getTime());
}
