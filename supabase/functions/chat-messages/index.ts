
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

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const roomName = url.searchParams.get('roomName')
      
      if (!roomName) {
        return new Response(
          JSON.stringify({ error: 'Room name is required' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Clean up expired messages first
      await supabase.rpc('cleanup_expired_messages')

      // Get messages for the room
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_name', roomName)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) {
        throw error
      }

      return new Response(
        JSON.stringify({ messages }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (req.method === 'POST') {
      const { tokenId, roomName, content, userIdentifier } = await req.json()

      if (!tokenId || !roomName || !content) {
        return new Response(
          JSON.stringify({ error: 'Token ID, room name, and content are required' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Validate token
      const { data: token, error: tokenError } = await supabase
        .from('tokens')
        .select('*')
        .eq('id', tokenId)
        .eq('room_name', roomName)
        .eq('is_active', true)
        .single()

      if (tokenError || !token) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { 
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Rate limiting - check if user sent a message in the last 2 seconds
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('created_at')
        .eq('token_id', tokenId)
        .gte('created_at', new Date(Date.now() - 2000).toISOString())
        .limit(1)

      if (recentMessages && recentMessages.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Please wait before sending another message' }),
          { 
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Create message
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert({
          room_name: roomName,
          token_id: tokenId,
          content: content.trim().substring(0, 1000) // Limit message length
        })
        .select()
        .single()

      if (messageError) {
        throw messageError
      }

      return new Response(
        JSON.stringify({ message }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Chat error:', error)
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
