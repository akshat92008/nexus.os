'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useNexusStore } from '../../store/nexusStore';
import { DashboardView } from './DashboardView';
import { WorkspaceCanvas } from './WorkspaceCanvas';
import { OmniChatView } from './OmniChatView';
import { ArtifactViewer } from './ArtifactViewer';
import { SearchView } from './SearchView';
import { AgentMarketplace } from '../market/AgentMarketplace';
import { TerminalView } from './TerminalView';

export function SandboxRouter() {
  const { 
    ui, 
    activeWorkspaceId, 
    workspaces,
    artifacts,
    execution
  } = useNexusStore();

  const activeArtifactId = ui.activeArtifactId;
  const activeArtifact = activeArtifactId ? (artifacts.get(activeArtifactId) || null) : null;

  return (
    <div className="w-full h-full relative overflow-hidden flex flex-col">
      <AnimatePresence mode="wait">
        {execution.isExecuting ? (
          <motion.div 
            key="terminal"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="w-full h-full"
          >
            <TerminalView />
          </motion.div>
        ) : activeArtifact ? (
          <motion.div 
            key="artifact"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full h-full"
          >
            <ArtifactViewer />
          </motion.div>
        ) : ui.dashboardOpen ? (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="w-full h-full"
          >
            <DashboardView />
          </motion.div>
        ) : ui.agentsViewOpen ? (
          <motion.div 
            key="market"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full"
          >
            <AgentMarketplace />
          </motion.div>
        ) : ui.searchViewOpen ? (
          <motion.div 
            key="search"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full"
          >
            <SearchView />
          </motion.div>
        ) : activeWorkspaceId && workspaces[activeWorkspaceId] ? (
          <motion.div 
            key={`workspace-${activeWorkspaceId}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full"
          >
            <WorkspaceCanvas />
          </motion.div>
        ) : (
          <motion.div 
            key="omni"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full"
          >
            <OmniChatView />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
