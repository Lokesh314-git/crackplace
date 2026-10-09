import React from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import { FaChevronLeft, FaCompass } from 'react-icons/fa6';
import { Card, Button } from '../components/ui';

export const NotFound: React.FC = () => {
  useSEO({
    title: '404 Page Not Found',
    description: 'The requested page does not exist in the CrackPlace placement preparation platform.',
    noIndex: true
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center" data-theme="dark">
      <div className="w-full max-w-md">
        <Card className="p-10 space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-primary-400">
              <FaCompass className="w-8 h-8" />
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-4xl font-extrabold text-white tracking-tight">404</p>
            <h1 className="text-lg font-semibold text-white">Page Not Found</h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              The page you are looking for does not exist or has been moved.
            </p>
          </div>

          <div className="pt-2">
            <Link to="/">
              <Button variant="primary" className="w-full justify-center">
                <FaChevronLeft className="w-3 h-3 mr-1.5" />
                <span>Return to Dashboard</span>
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default NotFound;
