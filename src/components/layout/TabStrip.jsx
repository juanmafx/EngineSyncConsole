import React from 'react';

export function TabStrip({ tabs, tabLabel, activeTab, onTabChange }) {
  return (
    <div className="tab-strip">
      {tabs.map((tab) => (
        <button key={tab} className={`tab-button ${activeTab === tab ? 'active' : ''}`} onClick={() => onTabChange(tab)}>
          {tabLabel[tab]}
        </button>
      ))}
    </div>
  );
}
