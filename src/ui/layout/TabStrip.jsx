import React from 'react';

export function TabStrip({ tabs, tabLabel, activeTab, onTabChange }) {
  return (
    <div className="tab-strip" role="tablist" aria-label="Console sections">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={activeTab === tab}
          className={`tab-button ${activeTab === tab ? 'active' : ''}`}
          onClick={() => onTabChange(tab)}
        >
          {tabLabel[tab]}
        </button>
      ))}
    </div>
  );
}
