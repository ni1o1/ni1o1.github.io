import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import NavBar from './NavBar';
import Footer from './Footer';
import SEOHead from '../component/SEOHead';

const Home = React.lazy(() => import('../pages/Home'));
const News = React.lazy(() => import('../pages/News'));
const NewsDetail = React.lazy(() => import('../pages/News/NewsDetail'));
const Research = React.lazy(() => import('../pages/Research'));
const Publication = React.lazy(() => import('../pages/Publication'));
const Projects = React.lazy(() => import('../pages/Projects'));

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEOHead />
      <NavBar />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/intro" element={<Home />} />
            <Route path="/news" element={<News />} />
            <Route path="/news/:filename" element={<NewsDetail />} />
            <Route path="/research" element={<Research />} />
            <Route path="/publication" element={<Publication />} />
            <Route path="/projects" element={<Projects />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
