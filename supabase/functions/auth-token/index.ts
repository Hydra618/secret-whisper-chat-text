
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { token, roomName } = await req.json()

    if (!token || !roomName) {
      return new Response(
        JSON.stringify({ error: 'Token and room name are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate token format (should be alphanumeric and at least 8 characters)
    if (!/^[a-zA-Z0-9]{8,}$/.test(token)) {
      return new Response(
        JSON.stringify({ error: 'Invalid token format' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if token exists
    const { data: existingToken, error: tokenError } = await supabase
      .from('tokens')
      .select('*')
      .eq('token_value', token)
      .eq('room_name', roomName)
      .eq('is_active', true)
      .single()

    if (tokenError && tokenError.code !== 'PGRST116') {
      throw tokenError
    }

    if (existingToken) {
      // Update last_used timestamp
      await supabase
        .from('tokens')
        .update({ last_used: new Date().toISOString() })
        .eq('id', existingToken.id)

      return new Response(
        JSON.stringify({ 
          success: true, 
          tokenId: existingToken.id,
          roomName: existingToken.room_name
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    } else {
      // Create new token
      const { data: newToken, error: createError } = await supabase
        .from('tokens')
        .insert({
          token_value: token,
          room_name: roomName
        })
        .select()
        .single()

      if (createError) {
        throw createError
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          tokenId: newToken.id,
          roomName: newToken.room_name
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
  } catch (error) {
    console.error('Auth error:', error)
    return new Response(
      JSON.stringify({ error: 'Authentication failed' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
