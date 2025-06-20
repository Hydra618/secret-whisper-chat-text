
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import ChatInterface from '@/components/ChatInterface';
import ThemeToggle from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Index: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTokenExtracted = async (token: string, room: string) => {
    setIsLoading(true);
    
    try {
      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/auth-token`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabase.supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            roomName: room,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Authentication failed');
      }

      const data = await response.json();
      
      if (data.success) {
        setTokenId(data.tokenId);
        setRoomName(data.roomName);
        setIsAuthenticated(true);
        toast.success('Successfully authenticated!');
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      toast.error(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setTokenId(null);
    setRoomName(null);
    toast.success('Logged out successfully');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ThemeToggle />
      
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Authenticating...</span>
          </div>
        </div>
      )}

      {!isAuthenticated ? (
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
              SecureChat
            </h1>
            <p className="text-xl text-muted-foreground">
              Privacy-focused real-time messaging with file-based authentication
            </p>
          </div>
          
          <FileUpload
            onTokenExtracted={handleTokenExtracted}
            isLoading={isLoading}
          />
          
          <div className="mt-12 max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold mb-4 text-center">Features</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p>🔐 <strong>File-based Authentication</strong> - No passwords, just upload your token file</p>
                <p>💬 <strong>Real-time Messaging</strong> - Instant communication with typing indicators</p>
                <p>⏰ <strong>Auto-delete Messages</strong> - Messages expire after 10 minutes</p>
              </div>
              <div className="space-y-2">
                <p>🏠 <strong>Multiple Rooms</strong> - Join different chat rooms</p>
                <p>🌙 <strong>Dark Mode</strong> - Eye-friendly interface</p>
                <p>📱 <strong>Mobile Responsive</strong> - Works on all devices</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        tokenId && roomName && (
          <ChatInterface
            tokenId={tokenId}
            roomName={roomName}
            onLogout={handleLogout}
          />
        )
      )}
    </div>
  );
};

export default Index;
