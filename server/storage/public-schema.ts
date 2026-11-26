// These views are owned by the migration identity. Public queries never select
// the profile or story document itself, even when a caller omits a filter.
export const publicViews = [
  `CREATE OR REPLACE VIEW public.rn_signatories WITH (security_barrier=true) AS
   SELECT data->>'name' AS name, signed_at
     FROM public.profiles WHERE data->>'signed'='true' AND data->>'publicConsent'='true'
       AND data->'listSignature'='true'::jsonb`,
  `CREATE OR REPLACE VIEW public.rn_signature_groups WITH (security_barrier=true) AS
   SELECT data->>'country' AS country, coalesce(data->>'state','') AS state,
          coalesce(data->>'district','') AS district, data->>'legalStatus' AS status,
          CASE WHEN data->>'personallyInvolved'='true' THEN 'Yes' ELSE 'No' END AS connection,
          CASE WHEN data->>'legalStatus'='US citizen' AND data->>'affiliationConsent'='true'
               THEN coalesce(data->>'politicalAffiliation','') ELSE '' END AS party,
          count(*)::int AS count
     FROM public.profiles WHERE data->>'signed'='true' AND data->>'publicConsent'='true'
     GROUP BY 1,2,3,4,5,6`,
  `CREATE OR REPLACE VIEW public.rn_visa_samples WITH (security_barrier=true) AS
   SELECT updated_at, (SELECT jsonb_agg(jsonb_build_object(
            'post', c->'post', 'category', c->'category', 'nationality', c->'nationality', 'shareTimelineRow', c->'shareTimelineRow',
            'shareTimelineHistory', c->'shareTimelineHistory', 'updatedAt', c->'updatedAt',
            'events', (SELECT jsonb_agg(jsonb_build_object('date', e->'date', 'type', e->'type') ORDER BY position)
                      FROM jsonb_array_elements(c->'events') WITH ORDINALITY AS events(e, position))
          )) FROM jsonb_array_elements(data->'cases') AS c) AS cases
     FROM public.profiles WHERE data->>'signed'='true' AND data->>'publicConsent'='true'
       AND jsonb_array_length(data->'cases') > 0`,
  `CREATE OR REPLACE VIEW public.rn_published_stories WITH (security_barrier=true) AS
   SELECT s.user_id AS id, s.updated_at, p.data->>'country' AS country, p.data->>'name' AS name,
          s.data->>'title' AS title, s.data->>'body' AS body, s.data->>'support' AS support, s.data->'impacts' AS impacts,
          CASE WHEN s.data->>'photosCleaned'='true' THEN s.data->>'cover' END AS cover,
          CASE WHEN s.data->>'photosCleaned'='true' THEN s.data->'photos' END AS photos
     FROM public.stories s JOIN public.profiles p ON p.user_id=s.user_id
    WHERE s.data->>'publish'='true' AND p.data->>'signed'='true' AND p.data->>'publicConsent'='true'`,
];
