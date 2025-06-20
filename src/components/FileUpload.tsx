
import React, { useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FileUploadProps {
  onTokenExtracted: (token: string, roomName: string) => void;
  isLoading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onTokenExtracted, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('general');

  const validateAndExtractToken = (fileContent: string): string | null => {
    const lines = fileContent.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Look for patterns like "token: VALUE" or "TOKEN: VALUE"
      const tokenMatch = trimmedLine.match(/^token\s*:\s*(.+)$/i);
      if (tokenMatch) {
        const token = tokenMatch[1].trim();
        // Validate token format (alphanumeric, at least 8 characters)
        if (/^[a-zA-Z0-9]{8,}$/.test(token)) {
          return token;
        }
      }
      
      // Also accept simple format where the entire line is the token
      if (/^[a-zA-Z0-9]{8,}$/.test(trimmedLine)) {
        return trimmedLine;
      }
    }
    
    return null;
  };

  const handleFile = async (file: File) => {
    setError(null);
    
    if (!file.name.endsWith('.txt')) {
      setError('Please upload a .txt file');
      return;
    }
    
    if (file.size > 1024) { // 1KB limit
      setError('File too large. Maximum size is 1KB');
      return;
    }
    
    try {
      const content = await file.text();
      const token = validateAndExtractToken(content);
      
      if (!token) {
        setError('Invalid token format. Expected format: "token: YOUR_TOKEN" or just the token value (8+ alphanumeric characters)');
        return;
      }
      
      onTokenExtracted(token, roomName);
    } catch (err) {
      setError('Error reading file');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <FileText className="w-16 h-16 mx-auto text-blue-500" />
        <h2 className="text-2xl font-bold">Upload Authentication Token</h2>
        <p className="text-muted-foreground">
          Upload a .txt file containing your access token to join the chat
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="roomName" className="block text-sm font-medium mb-2">
            Chat Room
          </label>
          <Input
            id="roomName"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Enter room name"
            disabled={isLoading}
          />
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
              : 'border-gray-300 dark:border-gray-600'
          }`}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg mb-2">Drop your .txt file here</p>
          <p className="text-sm text-muted-foreground mb-4">or</p>
          <Button variant="outline" disabled={isLoading} asChild>
            <label htmlFor="file-upload" className="cursor-pointer">
              Choose File
            </label>
          </Button>
          <input
            id="file-upload"
            type="file"
            accept=".txt"
            onChange={handleFileInput}
            className="hidden"
            disabled={isLoading}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Token format examples:</strong></p>
          <p>• <code>token: abc123def456</code></p>
          <p>• <code>abc123def456</code></p>
          <p>• Minimum 8 alphanumeric characters</p>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
