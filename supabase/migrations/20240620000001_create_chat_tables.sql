
-- Create tokens table for file-based authentication
CREATE TABLE tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_value TEXT UNIQUE NOT NULL,
  room_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Create messages table for chat functionality
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_name TEXT NOT NULL,
  token_id UUID REFERENCES tokens(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '10 minutes'),
  is_deleted BOOLEAN DEFAULT false
);

-- Create typing_indicators table for real-time typing status
CREATE TABLE typing_indicators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_name TEXT NOT NULL,
  token_id UUID REFERENCES tokens(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL,
  is_typing BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_tokens_token_value ON tokens(token_value);
CREATE INDEX idx_messages_room_name ON messages(room_name);
CREATE INDEX idx_messages_expires_at ON messages(expires_at);
CREATE INDEX idx_typing_indicators_room_name ON typing_indicators(room_name);

-- Enable Row Level Security
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;

-- Create policies for tokens
CREATE POLICY "Anyone can validate tokens" ON tokens FOR SELECT USING (true);
CREATE POLICY "Anyone can update token last_used" ON tokens FOR UPDATE USING (true);

-- Create policies for messages
CREATE POLICY "Users can view messages in their room" ON messages FOR SELECT USING (true);
CREATE POLICY "Users can insert messages" ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their messages" ON messages FOR UPDATE USING (true);

-- Create policies for typing indicators
CREATE POLICY "Users can view typing indicators in their room" ON typing_indicators FOR SELECT USING (true);
CREATE POLICY "Users can manage typing indicators" ON typing_indicators FOR ALL USING (true);

-- Function to clean up expired messages
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS void AS $$
BEGIN
  UPDATE messages 
  SET is_deleted = true 
  WHERE expires_at < NOW() AND is_deleted = false;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old typing indicators
CREATE OR REPLACE FUNCTION cleanup_old_typing_indicators()
RETURNS void AS $$
BEGIN
  DELETE FROM typing_indicators 
  WHERE updated_at < NOW() - INTERVAL '30 seconds';
END;
$$ LANGUAGE plpgsql;
