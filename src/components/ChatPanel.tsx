import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { llmService, LLMMessage } from '../services/llmService';
import { MCPClient } from '../services/mcpClient';

interface ChatPanelProps {
  mcpClient: MCPClient | null;
  isConnected: boolean;
}

interface ChatMessage extends LLMMessage {
  id: string;
  timestamp: Date;
}

export function ChatPanel({ mcpClient, isConnected }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your Operations Center assistant. I can help you manage tenants, tasks, compute SLA health, and more. What would you like to do?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Process the message and potentially execute MCP operations
      const response = await processUserMessage(inputValue);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const processUserMessage = async (message: string): Promise<string> => {
    const lowerMessage = message.toLowerCase();

    // Check for specific MCP operations
    if (lowerMessage.includes('list') && lowerMessage.includes('tenant')) {
      if (mcpClient && isConnected) {
        try {
          const tenants = await mcpClient.readResource('ops://tenant/list');
          const summary = await llmService.summarizeData(tenants, 'tenants');
          return `Here are your tenants:\n\n${summary}\n\nFull data: ${JSON.stringify(tenants, null, 2)}`;
        } catch (error) {
          return `I couldn't retrieve the tenant list: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      } else {
        return "I need to be connected to your MCP server to list tenants. Please check your connection.";
      }
    }

    if (lowerMessage.includes('compute') && lowerMessage.includes('health')) {
      if (mcpClient && isConnected) {
        // Extract parameters from the message (simplified)
        const createdAtMatch = message.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
        const thresholdMatch = message.match(/(\d+)\s*seconds?/);
        
        if (createdAtMatch && thresholdMatch) {
          try {
            const result = await mcpClient.callTool('compute_health', {
              createdAt: createdAtMatch[1],
              threshold_seconds: parseFloat(thresholdMatch[1])
            });
            return `SLA Health Result:\n- SLA Met: ${result.slaMet ? 'Yes' : 'No'}\n- Elapsed: ${result.elapsed} seconds\n- Threshold: ${result.threshold} seconds`;
          } catch (error) {
            return `I couldn't compute the health status: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        } else {
          return "To compute SLA health, please provide the creation timestamp (YYYY-MM-DDTHH:mm:ss) and threshold in seconds. For example: 'Compute health for 2024-01-15T10:30:00 with 3600 seconds threshold'";
        }
      } else {
        return "I need to be connected to your MCP server to compute health metrics. Please check your connection.";
      }
    }

    // Generate a general LLM response
    const llmMessages: LLMMessage[] = messages.slice(-5).map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    llmMessages.push({ role: 'user', content: message });

    return await llmService.generateResponse(llmMessages);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`flex max-w-[80%] ${
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === 'user' 
                    ? 'bg-primary-600 text-white ml-2' 
                    : 'bg-gray-200 text-gray-600 mr-2'
                }`}
              >
                {message.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div
                className={`rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                <div className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-600 mr-2">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-gray-100 text-gray-800 rounded-lg px-4 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="flex space-x-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me about tenants, tasks, SLA health, or anything else..."
            className="flex-1 input-field resize-none"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="btn-primary flex items-center px-3"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        
        <div className="mt-2 text-xs text-gray-500">
          Try: "List all tenants", "Compute health for 2024-01-15T10:30:00 with 3600 seconds", "Show me pending tasks"
        </div>
      </div>
    </div>
  );
}