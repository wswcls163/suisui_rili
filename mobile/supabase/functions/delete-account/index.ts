import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST')
    return Response.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405, headers: cors });

  const authorization = request.headers.get('Authorization');
  if (!authorization)
    return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401, headers: cors });

  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publishableKey || !serviceRole)
    return Response.json({ error: 'SERVER_NOT_CONFIGURED' }, { status: 500, headers: cors });

  const userClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user)
    return Response.json({ error: 'INVALID_SESSION' }, { status: 401, headers: cors });

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const avatar = await admin.storage.from('account-avatars').remove([`${data.user.id}/avatar.jpg`]);
  if (avatar.error)
    return Response.json({ error: 'DELETE_AVATAR_FAILED' }, { status: 500, headers: cors });
  const result = await admin.auth.admin.deleteUser(data.user.id);
  if (result.error)
    return Response.json({ error: 'DELETE_FAILED' }, { status: 500, headers: cors });
  return Response.json({ deleted: true }, { headers: cors });
});
