
import React, { useState, useEffect, useRef } from 'react';
import { Send, LogOut, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  content: string;
  created_at: string;
  expires_at: string;
  token_id: string;
}

interface ChatInterfaceProps {
  tokenId: string;
  roomName: string;
  onLogout: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ tokenId, roomName, onLogout }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const userIdentifier = `user_${tokenId.slice(-8)}`;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/chat-messages?roomName=${encodeURIComponent(roomName)}`,
        {
          headers: {
            'Authorization': `Bearer ${supabase.supabaseKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load messages');
      }

      const data = await response.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/chat-messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabase.supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tokenId,
            roomName,
            content: newMessage,
            userIdentifier,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      setNewMessage('');
      loadMessages();
      stopTyping();
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const updateTypingIndicator = async (typing: boolean) => {
    try {
      await fetch(
        `${supabase.supabaseUrl}/functions/v1/typing-indicator`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabase.supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tokenId,
            roomName,
            userIdentifier,
            isTyping: typing,
          }),
        }
      );
    } catch (err) {
      console.error('Error updating typing indicator:', err);
    }
  };

  const startTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      updateTypingIndicator(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  };

  const stopTyping = () => {
    if (isTyping) {
      setIsTyping(false);
      updateTypingIndicator(false);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    } else if (e.key !== 'Enter') {
      startTyping();
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (diff <= 0) return 'Expired';
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  // Set up real-time subscriptions
  useEffect(() => {
    const messagesChannel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_name=eq.${roomName}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    const typingChannel = supabase
      .channel('typing')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `room_name=eq.${roomName}`,
        },
        () => {
          // In a real implementation, you'd fetch typing indicators here
          // For simplicity, we'll just refresh periodically
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(typingChannel);
    };
  }, [roomName]);

  // Load initial messages
  useEffect(() => {
    loadMessages();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-refresh messages every 10 seconds
  useEffect(() => {
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup typing on unmount
  useEffect(() => {
    return () => {
      stopTyping();
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="w-5 h-5 text-blue-500" />
          <div>
            <h1 className="text-lg font-semibold">#{roomName}</h1>
            <p className="text-sm text-muted-foreground">
              User: {userIdentifier}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={onLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => {
            const isOwnMessage = message.token_id === tokenId;
            const timeUntilExpiry = getTimeUntilExpiry(message.expires_at);
            
            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    isOwnMessage
                      ? 'bg-blue-500 text-white'
                      : 'bg-muted'
                  }`}
                >
                  <p className="break-words">{message.content}</p>
                  <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                    <span>{formatTime(message.created_at)}</span>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{timeUntilExpiry}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {typingUsers.length > 0 && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Error Alert */}
      {error && (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Message Input */}
      <div className="border-t p-4">
        <div className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading}
            maxLength={1000}
          />
          <Button onClick={sendMessage} disabled={isLoading || !newMessage.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Messages auto-delete after 10 minutes • Max 1000 characters
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
