import React from 'react';
import { 
  Users, 
  Briefcase, 
  FileText, 
  CheckSquare, 
  Queue, 
  Shield, 
  Bot,
  Activity,
  MessageSquare
} from 'lucide-react';
import { clsx } from 'clsx';

export type ResourceType = 
  | 'tenants' 
  | 'workbenches' 
  | 'requests' 
  | 'tasks' 
  | 'queues' 
  | 'roles' 
  | 'agents'
  | 'tools'
  | 'chat';

interface SidebarProps {
  selectedResource: ResourceType;
  onResourceSelect: (resource: ResourceType) => void;
  isConnected: boolean;
}

const resourceItems = [
  { id: 'tenants' as ResourceType, label: 'Tenants', icon: Users },
  { id: 'workbenches' as ResourceType, label: 'Workbenches', icon: Briefcase },
  { id: 'requests' as ResourceType, label: 'Requests', icon: FileText },
  { id: 'tasks' as ResourceType, label: 'Tasks', icon: CheckSquare },
  { id: 'queues' as ResourceType, label: 'Queues', icon: Queue },
  { id: 'roles' as ResourceType, label: 'Roles', icon: Shield },
  { id: 'agents' as ResourceType, label: 'Agents', icon: Bot },
  { id: 'tools' as ResourceType, label: 'Tools', icon: Activity },
  { id: 'chat' as ResourceType, label: 'AI Chat', icon: MessageSquare },
];

export function Sidebar({ selectedResource, onResourceSelect, isConnected }: SidebarProps) {
  return (
    <div className="w-64 bg-gray-900 text-white h-screen flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold">Ops Center MCP</h1>
        <div className="flex items-center mt-2 text-sm">
          <div className={clsx(
            "w-2 h-2 rounded-full mr-2",
            isConnected ? "bg-green-400" : "bg-red-400"
          )} />
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>
      
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {resourceItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onResourceSelect(item.id)}
                className={clsx(
                  "w-full flex items-center px-3 py-2 rounded-lg text-left transition-colors",
                  selectedResource === item.id
                    ? "bg-primary-600 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                )}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}