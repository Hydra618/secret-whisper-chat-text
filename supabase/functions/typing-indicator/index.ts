
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

    const { tokenId, roomName, userIdentifier, isTyping } = await req.json()

    if (!tokenId || !roomName || !userIdentifier) {
      return new Response(
        JSON.stringify({ error: 'Token ID, room name, and user identifier are required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Clean up old typing indicators
    await supabase.rpc('cleanup_old_typing_indicators')

    // Update or insert typing indicator
    const { error } = await supabase
      .from('typing_indicators')
      .upsert({
        token_id: tokenId,
        room_name: roomName,
        user_identifier: userIdentifier,
        is_typing: isTyping,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'token_id,room_name'
      })

    if (error) {
      throw error
    }

    // Get current typing users
    const { data: typingUsers, error: fetchError } = await supabase
      .from('typing_indicators')
      .select('user_identifier')
      .eq('room_name', roomName)
      .eq('is_typing', true)
      .neq('token_id', tokenId)

    if (fetchError) {
      throw fetchError
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        typingUsers: typingUsers?.map(u => u.user_identifier) || []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Typing indicator error:', error)
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
