import React from 'react';
import { 
  DollarCircleOutlined, 
  ShoppingCartOutlined, 
  AppstoreOutlined, 
  SendOutlined,
  RobotOutlined,
  ArrowUpOutlined 
} from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './DashboardPage.css';

// ===== Mock Data =====
const salesData = [
  { time: '10am', food: 800, drink: 350 },
  { time: '12pm', food: 1200, drink: 600 },
  { time: '2pm', food: 1800, drink: 1100 },
  { time: '4pm', food: 1100, drink: 900 },
  { time: '6pm', food: 1500, drink: 1100 },
  { time: '8pm', food: 600, drink: 400 },
];

const DashboardPage: React.FC = () => {
  return (
    <div className="dashboard-overview">
      {/* Page Header */}
      <div className="dashboard-header">
        <h2>Overview</h2>
        <p>Here's what's happening at your restaurant today.</p>
      </div>

      {/* Stat Cards Row */}
      <div className="stat-cards-row">
        {/* Revenue Card */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">TODAY'S REVENUE</span>
            <div className="stat-card-icon revenue">
              <DollarCircleOutlined />
            </div>
          </div>
          <div className="stat-card-value">$4,289.50</div>
          <div className="stat-card-sub">
            <ArrowUpOutlined style={{ color: '#38a169', fontSize: 12 }} />
            <span className="trend-up">+12.5% vs yesterday</span>
          </div>
        </div>

        {/* Active Orders Card */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">ACTIVE ORDERS</span>
            <div className="stat-card-icon orders">
              <ShoppingCartOutlined />
            </div>
          </div>
          <div className="stat-card-value">34</div>
          <div className="stat-card-sub">
            <span>⏱ Avg. wait: 18 mins</span>
          </div>
        </div>

        {/* Available Tables Card */}
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">AVAILABLE TABLES</span>
            <div className="stat-card-icon tables">
              <AppstoreOutlined />
            </div>
          </div>
          <div className="tables-fraction">
            <span className="big-num">12</span>
            <span className="divider">/</span>
            <span className="total-num">45</span>
          </div>
          <div className="tables-progress-row">
            <div className="tables-progress-bar">
              <div className="tables-progress-fill" style={{ width: '73%' }} />
            </div>
            <span className="tables-progress-label">73% Occupied</span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Chart + AI Chat */}
      <div className="dashboard-bottom-row">
        {/* Sales by Category Chart */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h3>Sales by Category</h3>
            <div className="chart-legend">
              <div className="chart-legend-item">
                <div className="chart-legend-dot food" />
                <span>Food</span>
              </div>
              <div className="chart-legend-item">
                <div className="chart-legend-dot drink" />
                <span>Drink</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={salesData} barGap={4} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis 
                dataKey="time" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#718096', fontSize: 12 }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#718096', fontSize: 12 }} 
                tickFormatter={(value) => `$${(value / 1000).toFixed(value >= 1000 ? 0 : 1)}k`}
                domain={[0, 2000]}
                ticks={[0, 500, 1000, 1500, 2000]}
              />
              <Tooltip 
                formatter={(value: any) => [`$${Number(value).toLocaleString()}`, '']}
                contentStyle={{ borderRadius: 8, border: '1px solid #e8ecf1', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              />
              <Bar dataKey="food" fill="#1890ff" radius={[4, 4, 0, 0]} barSize={24} />
              <Bar dataKey="drink" fill="#36cfc9" radius={[4, 4, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* AI Chat Widget */}
        <div className="ai-chat-card">
          <div className="ai-chat-header">
            <div className="ai-chat-avatar">
              <RobotOutlined />
            </div>
            <div className="ai-chat-info">
              <h4>SmartDine AI</h4>
              <p>Operational Assistant</p>
            </div>
          </div>

          <div className="ai-chat-messages">
            {/* User message */}
            <div className="ai-chat-bubble user">
              What was the busiest time today?
            </div>
            {/* Bot response */}
            <div className="ai-chat-bubble bot">
              Peak hours were <strong>12:30 PM - 1:45 PM</strong>. During this time, wait times averaged 22 minutes.
              <br /><br />
              <em>Consider scheduling an extra runner for lunch service tomorrow based on this trend.</em>
            </div>
          </div>

          <div className="ai-chat-input-row">
            <input 
              type="text" 
              placeholder="Ask about sales, staff, or inven..." 
              readOnly
            />
            <button className="ai-chat-send-btn" title="Send">
              <SendOutlined />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
