-- Run once in the Supabase SQL Editor after deploying rpi-api.
-- Reuses the existing URL and credentials without displaying them.
-- Rerunning updates the named jobs instead of creating duplicates.
do $$
declare
  original record;
  template text;
  capture_command text;
  sport text;
  class_number integer;
  job_number integer := 0;
begin
  select * into strict original from cron.job
  where jobname = 'rpi-snapshot-hourly';

  template := replace(original.command, '/capture-all', '/capture');
  if template = original.command then
    raise exception 'Expected the existing capture-all job; no jobs were changed.';
  end if;
  template := regexp_replace(template,
    'body\s*(:=|=>)\s*''\{\}''\s*::jsonb',
    'body := __CAPTURE_BODY__', 'i');
  if position('__CAPTURE_BODY__' in template) = 0 then
    raise exception 'Existing job body format differs; no jobs were changed.';
  end if;
  if template ilike '%timeout_milliseconds%' then
    template := regexp_replace(template,
      'timeout_milliseconds\s*(:=|=>)\s*[0-9]+',
      'timeout_milliseconds := 120000', 'i');
  else
    template := regexp_replace(template, 'net\.http_post\s*\(',
      'net.http_post(timeout_milliseconds := 120000, ', 'i');
  end if;

  foreach sport in array array['Volleyball', 'Boys Soccer', 'Football',
    'Boys Basketball', 'Girls Basketball', 'Baseball', 'Softball', 'Girls Soccer']
  loop
    for class_number in 1..8 loop
      capture_command := replace(template, '__CAPTURE_BODY__',
        quote_literal(jsonb_build_object('sport', sport,
          'classification', format('Class %sA', class_number))::text) || '::jsonb');
      perform cron.schedule(
        'rpi-capture-' || lower(replace(sport, ' ', '-')) || '-' || class_number || 'a',
        format('%s * * * *', job_number % 60), capture_command);
      job_number := job_number + 1;
      -- A single immediate test; remaining captures are staggered over the hour.
      if sport = 'Volleyball' and class_number = 1 then execute capture_command; end if;
    end loop;
  end loop;
  perform cron.alter_job(original.jobid, active := false);
end $$;
