import { useState, useMemo } from 'react';

// --- Types ---

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  downloads: number;
  iconColor: string;
}

// --- Mock Data ---

const categories = [
  'All',
  'AI Intelligence',
  'Developer Tools',
  'Efficiency',
  'Data Analysis',
  'Content Creation',
];

const skills: Skill[] = [
  {
    id: '1',
    name: 'Smart Code Reviewer',
    description: 'Automatically reviews your code for best practices, security vulnerabilities, and performance issues.',
    category: 'Developer Tools',
    author: 'Alex Chen',
    downloads: 12840,
    iconColor: '#e8f0fe',
  },
  {
    id: '2',
    name: 'Data Visualization Expert',
    description: 'Transforms raw data into beautiful, interactive charts and dashboards with actionable insights.',
    category: 'Data Analysis',
    author: 'Sarah Kim',
    downloads: 9320,
    iconColor: '#e6f4ea',
  },
  {
    id: '3',
    name: 'Content Writer Pro',
    description: 'Generates high-quality blog posts, marketing copy, and social media content tailored to your brand voice.',
    category: 'Content Creation',
    author: 'Mike Johnson',
    downloads: 15670,
    iconColor: '#f2e0c8',
  },
  {
    id: '4',
    name: 'Neural Search Engine',
    description: 'Semantic search across your documents, codebase, and knowledge base with natural language queries.',
    category: 'AI Intelligence',
    author: 'Lisa Wang',
    downloads: 21400,
    iconColor: '#fce8e6',
  },
  {
    id: '5',
    name: 'Task Automator',
    description: 'Automates repetitive workflows by learning your patterns and suggesting intelligent shortcuts.',
    category: 'Efficiency',
    author: 'David Park',
    downloads: 7650,
    iconColor: '#e8f0fe',
  },
  {
    id: '6',
    name: 'API Documentation Gen',
    description: 'Generates comprehensive API documentation from your codebase with examples and usage guides.',
    category: 'Developer Tools',
    author: 'Emma Davis',
    downloads: 11230,
    iconColor: '#e6f4ea',
  },
  {
    id: '7',
    name: 'Sentiment Analyzer',
    description: 'Analyzes customer feedback, reviews, and social media mentions to extract sentiment and trends.',
    category: 'AI Intelligence',
    author: 'James Liu',
    downloads: 8910,
    iconColor: '#f2e0c8',
  },
  {
    id: '8',
    name: 'Report Builder',
    description: 'Creates professional reports from your data with customizable templates and automatic formatting.',
    category: 'Content Creation',
    author: 'Olivia Brown',
    downloads: 6480,
    iconColor: '#fce8e6',
  },
];

// --- Helper ---

function formatDownloads(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return String(num);
}

function getSkillIcon(iconColor: string) {
  return (
    <div
      className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: iconColor }}
    >
      <svg className="w-[18px] h-[18px] text-np-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 17l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function getAuthorInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

// --- Component ---

export function SkillsHub() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTab, setActiveTab] = useState<'my' | 'hub'>('hub');

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      const matchesCategory =
        selectedCategory === 'All' || skill.category === selectedCategory;

      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        query === '' ||
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex">
        {/* Secondary Drawer — 240px per Figma */}
        <div className="w-[240px] bg-np-surface border-r border-np-border-lighter p-6 flex flex-col gap-8 shrink-0">
          <div>
            <h2 className="text-[18px] font-bold text-np-primary tracking-[-0.45px]">Nexus AI</h2>
            <p className="text-[16px] text-np-text-secondary">Intelligence Suite</p>
          </div>
          <div>
            <p className="text-[12px] font-bold text-np-text-secondary tracking-[0.6px] uppercase mb-3 px-2">SKILL CATEGORIES</p>
            <div className="flex flex-col gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedCategory === cat
                      ? 'bg-white text-np-primary font-medium shadow-[0px_1px_1px_rgba(0,0,0,0.05)]'
                      : 'text-np-text-tertiary hover:bg-white/50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex flex-col">
          {/* TopAppBar — per Figma: left-aligned tab links + right icons */}
          <div className="h-16 shrink-0 backdrop-blur-[6px] bg-[rgba(245,244,237,0.8)] border-b border-np-border-lighter flex items-center justify-between px-8">
            {/* Left: Tab Links */}
            <div className="flex items-end gap-[40px]">
              <button
                onClick={() => setActiveTab('my')}
                className={`pb-[11px] px-[4px] text-[14px] transition-colors ${
                  activeTab === 'my'
                    ? 'font-semibold text-np-primary border-b-3 border-np-primary'
                    : 'font-medium text-np-text-tab hover:text-np-primary'
                }`}
              >
                My Skills
              </button>
              <button
                onClick={() => setActiveTab('hub')}
                className={`pb-[11px] px-[4px] text-[14px] transition-colors ${
                  activeTab === 'hub'
                    ? 'font-semibold text-np-primary border-b-3 border-np-primary'
                    : 'font-medium text-np-text-tab hover:text-np-primary'
                }`}
              >
                Skill Hub
              </button>
            </div>

            {/* Right: Notification + Settings Icons */}
            <div className="flex items-center gap-[12px]">
              <button className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-[rgba(230,225,224,0.3)] transition-colors">
                <svg className="w-4 h-5 text-np-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-[rgba(230,225,224,0.3)] transition-colors">
                <svg className="w-[18px] h-[18px] text-np-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-[1200px] mx-auto px-8 py-10">
              {/* Search Bar */}
              <div className="flex flex-col items-center gap-6 mb-8">
                <div className="flex items-center w-full max-w-[768px] bg-np-ivory border border-np-border rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]">
                  <svg className="w-[18px] h-[18px] text-[rgba(77,69,64,0.5)] ml-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for skills, authors, or categories..."
                    className="flex-1 h-[60px] px-4 bg-transparent text-base text-np-text placeholder:text-[rgba(77,69,64,0.5)] focus:outline-none"
                  />
                  <button className="bg-np-primary rounded-lg px-4 h-10 mr-3 text-white text-base hover:opacity-90 transition-opacity">
                    Search
                  </button>
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`shrink-0 px-[17px] py-[7px] rounded-full text-base font-normal transition-colors ${
                        selectedCategory === cat
                          ? 'bg-np-primary text-white shadow-[0px_1px_1px_rgba(0,0,0,0.05)]'
                          : 'bg-np-ivory border border-np-border text-np-text hover:bg-np-surface'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skills Grid */}
              {filteredSkills.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-np-text-muted mb-2">No skills found</p>
                  <p className="text-sm text-np-text-placeholder">Try adjusting your search or category filter</p>
                </div>
              ) : activeTab === 'my' ? (
                <div className="text-center py-16">
                  <div className="bg-np-sidebar w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-np-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-np-text mb-2">No installed skills</h3>
                  <p className="text-sm text-np-text-secondary mb-6">Browse the Skill Hub to discover and install skills</p>
                  <button
                    onClick={() => setActiveTab('hub')}
                    className="inline-flex items-center gap-2 bg-np-primary text-white px-6 py-3 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Browse Skill Hub
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {filteredSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className="bg-np-ivory border border-np-border-lighter rounded-[8px] p-[21px] flex flex-col gap-4 hover:shadow-[0px_4px_10px_rgba(45,41,38,0.08)] transition-shadow cursor-pointer drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)]"
                    >
                      {/* Icon + More button */}
                      <div className="flex items-start justify-between">
                        {getSkillIcon(skill.iconColor)}
                        <button className="p-1 rounded-md hover:bg-np-border-lighter transition-colors">
                          <svg className="w-5 h-5 text-np-text-muted" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="6" r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="12" cy="18" r="1.5" />
                          </svg>
                        </button>
                      </div>

                      {/* Title */}
                      <div>
                        <h3 className="text-[18px] font-normal text-np-text leading-[28px] line-clamp-2">
                          {skill.name}
                        </h3>
                        <p className="text-[16px] font-normal text-np-text-secondary leading-[24px] line-clamp-2 mt-1">
                          {skill.description}
                        </p>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-np-border-light" />

                      {/* Author + Downloads */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-np-border-light flex items-center justify-center text-[10px] font-bold text-np-text-tertiary">
                            {getAuthorInitials(skill.author)}
                          </div>
                          <span className="text-[12px] text-np-text-tertiary">{skill.author}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <svg className="w-[11px] h-[11px] text-np-text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                            <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                            <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="text-[12px] text-np-text-tertiary">{formatDownloads(skill.downloads)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
