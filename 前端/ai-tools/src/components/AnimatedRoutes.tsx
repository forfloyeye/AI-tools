import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Dashboard } from '../pages/Dashboard';
import { RemoveBg } from '../pages/RemoveBg';
import { AiScene } from '../pages/AiScene';

const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.98 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.98 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
    className="flex-1 flex flex-col w-full h-full"
  >
    {children}
  </motion.div>
);

export const AnimatedRoutes: React.FC = () => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><Dashboard /></PageWrapper>} />
        <Route path="/tools/remove-bg" element={<PageWrapper><RemoveBg /></PageWrapper>} />
        <Route path="/tools/ai-scene" element={<PageWrapper><AiScene /></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
};
