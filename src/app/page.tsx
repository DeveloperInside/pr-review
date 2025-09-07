"use client";

import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, orderBy, query, doc, getDoc } from "firebase/firestore";
import { db } from "./api/firebase";

interface PR {
  id: string;
  title?: string;
  repo?: string;
  author?: string;
  url?: string;
  approvals?: number;
  updated_at?: string;
}

export default function Home() {
  const [prs, setPrs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'approvals' | 'updated' | 'title'>('approvals');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);


  const getApprovalBadgeColor = (approvals: number = 0) => {
    if (approvals === 0) return 'bg-red-100 text-red-800';
    if (approvals === 1) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getPriorityIcon = (approvals: number = 0) => {
    if (approvals === 0) return '🔴';
    if (approvals <= 2) return '🟡';
    return '🟢';
  };

  const sortedPrs = [...prs].sort((a, b) => {
    switch (sortBy) {
      case 'approvals':
        return (a.approvals || 0) - (b.approvals || 0);
      case 'updated':
        return new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime();
      case 'title':
        return (a.title || '').localeCompare(b.title || '');
      default:
        return 0;
    }
  });

  const fetchLastRefreshFromFirestore = useCallback(async () => {
    try {
      const metadataDoc = await getDoc(doc(db, "metadata", "system"));
      if (metadataDoc.exists()) {
        const data = metadataDoc.data();
        if (data.lastRefresh) {
          setLastRefresh(new Date(data.lastRefresh));
        }
      }
    } catch (error) {
      console.error("Error fetching last refresh:", error);
    }
  }, []);

  const fetchPrsFromFirestore = useCallback(async () => {
    const q = query(collection(db, "prs"), orderBy("approvals", "asc"));
    const snapshot = await getDocs(q);
    setPrs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as PR)));
    // Don't set lastRefresh here anymore - fetch from Firestore instead
    await fetchLastRefreshFromFirestore();
  }, [fetchLastRefreshFromFirestore]);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      await fetch("/api/refresh"); // call API route
      await fetchPrsFromFirestore(); // reload from Firestore (includes fetching last refresh)
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatLastRefresh = (date: Date | null) => {
    if (!date) return null;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    fetchPrsFromFirestore();
  }, [fetchPrsFromFirestore]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Modern Header */}
        <header className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">PR</span>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                  GitHub PR Dashboard
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-sm text-gray-500">{prs.length} pull requests found</p>
                  {lastRefresh && (
                    <>
                      <span className="text-gray-300">•</span>
                      <p className="text-sm text-gray-400 flex items-center gap-1">
                        <span className="text-xs">🕒</span>
                        Last updated {formatLastRefresh(lastRefresh)}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'approvals' | 'updated' | 'title')}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="approvals">Sort by Approvals</option>
                <option value="updated">Sort by Updated</option>
                <option value="title">Sort by Title</option>
              </select>
              
              {/* View Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="hidden sm:inline">Grid</span>
                  <span className="sm:hidden">⊞</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === 'list'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="hidden sm:inline">List</span>
                  <span className="sm:hidden">☰</span>
                </button>
              </div>
              
              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 font-medium text-sm flex items-center gap-2"
              >
                <span className={`transition-transform duration-500 ${loading ? 'animate-spin' : ''}`}>
                  🔄
                </span>
                <span className="hidden sm:inline">{loading ? "Refreshing..." : "Refresh"}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        {loading && prs.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <span className="text-white text-2xl animate-spin">🔄</span>
              </div>
              <p className="text-gray-600 font-medium">Loading pull requests...</p>
            </div>
          </div>
        ) : prs.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📋</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Pull Requests Found</h3>
            <p className="text-gray-500 mb-6">Click refresh to fetch the latest PRs from GitHub</p>
            <button
              onClick={handleRefresh}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              🔄 Refresh Now
            </button>
          </div>
        ) : (
          <div className={`transition-all duration-300 ${
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'space-y-4'
          }`}>
            {sortedPrs.map((pr, index) => (
              <div
                key={pr.id}
                className={`group bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-gray-200 transform hover:-translate-y-1 ${
                  viewMode === 'list' ? 'flex items-center p-4' : 'p-6'
                }`}
                style={{
                  animationDelay: `${index * 50}ms`,
                  animation: 'fadeInUp 0.6s ease-out forwards'
                }}
              >
                {viewMode === 'grid' ? (
                  // Grid View
                  <>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${getApprovalBadgeColor(pr.approvals)}`}>
                        {getPriorityIcon(pr.approvals)} {pr.approvals || 0} approval{(pr.approvals || 0) !== 1 ? 's' : ''}
                      </div>
                      <div className="text-xs text-gray-400">
                        {pr.updated_at ? new Date(pr.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                      </div>
                    </div>
                    
                    <h3 className="font-semibold text-gray-900 mb-3 line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {pr.title}
                    </h3>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="w-4 h-4 mr-2">📁</span>
                        <span className="truncate font-mono text-xs bg-gray-50 px-2 py-1 rounded">{pr.repo}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="w-4 h-4 mr-2">👤</span>
                        <span className="truncate">{pr.author}</span>
                      </div>
                    </div>
                    
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform group-hover:scale-105"
                    >
                      <span className="mr-2">🔗</span>
                      View Pull Request
                    </a>
                  </>
                ) : (
                  // List View
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getApprovalBadgeColor(pr.approvals)}`}>
                          {getPriorityIcon(pr.approvals)} {pr.approvals || 0}
                        </div>
                        <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                          {pr.title}
                        </h3>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <span>📁</span>
                          <span className="font-mono text-xs bg-gray-50 px-2 py-1 rounded">{pr.repo}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span>👤</span>
                          <span>{pr.author}</span>
                        </span>
                        <span className="text-gray-400">
                          {pr.updated_at ? new Date(pr.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                        </span>
                      </div>
                    </div>
                    
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 whitespace-nowrap"
                    >
                      <span className="mr-2">🔗</span>
                      View PR
                    </a>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}