import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export const Toast: React.FC = () => {
  const { toast } = useAppContext();

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -50, x: '-50%' }}
          animate={{ opacity: 1, y: 20, x: '-50%' }}
          exit={{ opacity: 0, y: -50, x: '-50%' }}
          className="fixed top-0 left-1/2 z-50 flex items-center gap-2 rounded-lg bg-white px-4 py-3 shadow-lg ring-1 ring-black/5"
        >
          {toast.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-500" />
          )}
          <span className="text-sm font-medium text-slate-800">{toast.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
