import z from '@deepseek-ai/schemastery';
import { FIELDS } from './src/model.js';

const fields = Object.fromEntries(Object.entries(FIELDS).map(([key, field]) => {
  let schema;
  if (field.kind === 'boolean') schema = z.boolean();
  else if (field.kind === 'enum') schema = z.union(field.values.map(value => z.const(value)));
  else if (field.kind === 'string') schema = z.string().max(field.max);
  else {
    schema = z.number().min(field.min).max(field.max);
    if (field.step === 1) schema = schema.step(1);
  }
  return [key, schema.default(field.default).volatile()];
}));

export const Config = z.object({ ...fields, legendSeen: z.boolean().default(false).hidden().volatile() });

export function apply(ctx) {
  ctx.inject(['settings'], child => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });
}
