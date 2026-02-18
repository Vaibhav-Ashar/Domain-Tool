import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, AreaChart, Area, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Download, RefreshCw, Search } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '') + '/api';

function SimpleDropdown({ value, options, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        className="w-full px-3 py-2.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all cursor-pointer text-slate-900 font-medium text-sm truncate flex items-center justify-between gap-1"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{value}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      </div>
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden py-1" style={{ zIndex: 9999 }}>
          {options.map((opt) => (
            <div
              key={opt}
              className={`px-4 py-2 text-sm cursor-pointer transition-colors ${
                opt === value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => { onChange(opt); setIsOpen(false); }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchableDropdown({ value, options, onChange, placeholder, formatOption }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter(opt => {
    if (!search) return true;
    return opt.toLowerCase().includes(search.toLowerCase());
  });

  const displayValue = formatOption ? formatOption(value) : value;

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className="px-3 py-2.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all cursor-pointer text-slate-900 font-medium text-sm truncate flex items-center justify-between gap-1"
        onClick={() => { setIsOpen(!isOpen); setTimeout(() => inputRef.current?.focus(), 50); }}
      >
        <span className="truncate">{displayValue}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      </div>
      {isOpen && (
        <div className="absolute left-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden min-w-[100%] w-max max-w-[min(420px,90vw)]" style={{ zIndex: 9999 }}>
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
              <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search by name or ID...`}
                className="bg-transparent text-sm text-slate-900 outline-none w-full placeholder-slate-400 min-w-0"
              />
            </div>
          </div>
          <div className="max-h-[200px] overflow-y-auto overflow-x-auto py-1">
            {filtered.length > 0 ? filtered.map(opt => (
              <div
                key={opt}
                title={formatOption ? formatOption(opt) : opt}
                className={`px-4 py-2 text-sm cursor-pointer transition-colors break-words whitespace-normal ${
                  opt === value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                }`}
                onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }}
              >
                {formatOption ? formatOption(opt) : opt}
              </div>
            )) : (
              <div className="px-4 py-3 text-sm text-slate-400 text-center">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardApp() {
  // State management
  const [filters, setFilters] = useState({
    topN: 10,
    advertiser: 'All Advertisers',
    campaign: 'All Campaigns',
    metric: 'Conversions',
    date: '' // Set from API (last available date) when filter options load
  });

  const [filterOptions, setFilterOptions] = useState({
    advertisers: ['All Advertisers'],
    campaigns: ['All Campaigns'],
    metrics: ['Conversions', 'Clicks', 'Impressions'],
    dateRange: { min: '', max: '' }
  });

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartPage, setChartPage] = useState(0); // 0 = first 5, 1 = next 5
  const [sortColumn, setSortColumn] = useState('week1Conv'); // Default sort by Week 1
  const [sortDirection, setSortDirection] = useState('desc'); // desc or asc
  const [showFilterDownloadMenu, setShowFilterDownloadMenu] = useState(false);
  const [previewDate, setPreviewDate] = useState(null); // Date selected in calendar but not yet applied
  const [calendarOpen, setCalendarOpen] = useState(false);
  const filterDownloadMenuRef = useRef(null);

  // Close Download menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterDownloadMenuRef.current && !filterDownloadMenuRef.current.contains(e.target)) {
        setShowFilterDownloadMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Export table data as CSV (domains with conv drop ≥10%)
  const handleExportCSV = () => {
    if (!dashboardData || !dashboardData.domainData) return;
    const CONV_DROP = 10;
    const rows = dashboardData.domainData.filter(d => d.change != null && d.change <= -CONV_DROP);
    const metricShort = filters.metric === 'Conversions' ? 'Conv.' : filters.metric === 'Clicks' ? 'Click' : 'Impr.';
    const headers = [entityLabel, 'Week 1 Value', 'Week 1 Rank', 'Week 2 Value', 'Week 2 Rank', `${metricShort} Change`, 'Change %'];
    const csvContent = [
      headers.join(','),
      ...rows.map(r => [
        `"${r.domain}"`,
        r.week1Conv,
        r.rank1 ?? '',
        r.week2Conv,
        r.rank2 ?? '',
        (r.week2Conv - r.week1Conv) !== 0 ? (r.week2Conv - r.week1Conv > 0 ? '+' : '') + (r.week2Conv - r.week1Conv) : '0',
        r.change !== null ? r.change.toFixed(2) : ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${entityLabel}_ConvDrop10_${filters.date}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    setShowFilterDownloadMenu(false);
  };

  // Fetch filter options on mount
  useEffect(() => {
    fetchFilterOptions();
    fetchCampaigns('All Advertisers', false); // Load all campaigns initially without resetting
  }, []);

  // Fetch campaigns when advertiser changes
  useEffect(() => {
    fetchCampaigns(filters.advertiser);
  }, [filters.advertiser]);

  // Two-week comparison needs 14 days of data. Returns short message if date is invalid, else null.
  const getTwoWeekMessage = (date) => {
    const dataMin = filterOptions.dateRange?.min;
    const dataMax = filterOptions.dateRange?.max;
    if (!dataMin || !dataMax || !date) return null;
    const earliest = new Date(dataMin);
    earliest.setDate(earliest.getDate() + 13);
    const selected = new Date(date);
    const latest = new Date(dataMax);
    if (selected < earliest || selected > latest) {
      const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `Use a date between ${fmt(earliest)} and ${fmt(latest)} for 2-week comparison.`;
    }
    return null;
  };

  // Generate dashboard data (only on explicit action)
  const handleGenerateDashboard = () => {
    const effectiveDateStr = previewDate ? previewDate.toISOString().split('T')[0] : filters.date;
    const effectiveFilters = previewDate ? { ...filters, date: effectiveDateStr } : filters;

    if (getTwoWeekMessage(effectiveDateStr)) return;

    if (previewDate) {
      setFilters(prev => ({ ...prev, date: effectiveDateStr }));
      setPreviewDate(null);
    }
    setChartPage(0);
    setSortColumn('week1Conv');
    setSortDirection('desc');
    fetchDashboardData(effectiveFilters);
  };

  // Only auto-fetch on initial load (when date is set from filter options)
  useEffect(() => {
    if (dashboardData === null && filters.date) {
      fetchDashboardData();
    }
  }, [filters.date]);

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/filters`);
      const data = await response.json();
      setFilterOptions(prev => ({
        ...prev,
        advertisers: ['All Advertisers', ...data.advertisers],
        metrics: data.metrics,
        dateRange: data.dateRange || { min: '', max: '' }
      }));
      
      // Set initial date to max date
      if (data.dateRange?.max) {
        setFilters(prev => ({ ...prev, date: data.dateRange.max }));
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchCampaigns = async (advertiser, resetCampaign = true) => {
    try {
      const response = await fetch(`${API_BASE_URL}/campaigns?advertiser=${encodeURIComponent(advertiser)}`);
      const data = await response.json();
      setFilterOptions(prev => ({
        ...prev,
        campaigns: ['All Campaigns', ...data.campaigns]
      }));
      // Reset campaign when advertiser changes (unless explicitly told not to)
      if (resetCampaign) {
        setFilters(prev => ({ ...prev, campaign: 'All Campaigns' }));
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  };

  const fetchDashboardData = async (filtersOverride) => {
    const payload = filtersOverride ?? filters;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = async (key, value) => {
    // If campaign is selected, auto-select the corresponding advertiser
    if (key === 'campaign' && value !== 'All Campaigns') {
      try {
        const response = await fetch(`${API_BASE_URL}/campaign-advertiser?campaign=${encodeURIComponent(value)}`);
        const data = await response.json();
        if (data.advertiser) {
          // Update both campaign and advertiser together
          setFilters(prev => ({ 
            ...prev, 
            campaign: value,
            advertiser: data.advertiser 
          }));
          // Fetch campaigns for this advertiser without resetting campaign
          await fetchCampaigns(data.advertiser, false);
          return; // Don't update filters again below
        }
      } catch (error) {
        console.error('Error fetching advertiser for campaign:', error);
      }
    }
    
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const formatNumber = (num) => {
    const absNum = Math.abs(num);
    if (absNum >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (absNum >= 100) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDateRange = (start, end) => {
    if (!start || !end) return '';
    const startDate = new Date(start);
    const endDate = new Date(end);
    const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  const getChangeIcon = (change) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  const getChangeColor = (change) => {
    if (change > 0) return 'text-emerald-600 bg-emerald-50';
    if (change < 0) return 'text-red-600 bg-red-50';
    return 'text-slate-600 bg-slate-50';
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if clicking same column
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      // Default to descending for new column
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortedDomains = (domains) => {
    if (!domains) return [];
    
    return [...domains].sort((a, b) => {
      let aVal = sortColumn === 'convChange' ? (a.week2Conv - a.week1Conv) : a[sortColumn];
      let bVal = sortColumn === 'convChange' ? (b.week2Conv - b.week1Conv) : b[sortColumn];
      
      // Handle null values
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      const multiplier = sortDirection === 'desc' ? -1 : 1;
      return (aVal - bVal) * multiplier;
    });
  };

  if (loading || !dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const { kpis, domainData, contributionData, pieDataWeek1, pieDataWeek2, weekRanges } = dashboardData;

  const entityLabel = 'Domain';
  const entityLabelLower = 'domain';
  // Column header for absolute change (e.g. Conv. Change, Click Change)
  const metricChangeShortLabel = filters.metric === 'Conversions' ? 'Conv.' : filters.metric === 'Clicks' ? 'Click' : 'Impr.';
  
  // Distinct colors for domains - each color is visually different
  const DOMAIN_COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Emerald Green
    '#F59E0B', // Amber
    '#EC4899', // Pink
    '#8B5CF6', // Purple
    '#EF4444', // Red
    '#14B8A6', // Teal
    '#F97316', // Orange
    '#84CC16', // Lime
    '#06B6D4', // Cyan
    '#F43F5E', // Rose
    '#22D3EE', // Bright Cyan
    '#FB923C', // Light Orange
    '#4ADE80', // Light Green
    '#FBBF24', // Yellow
    '#F472B6', // Light Pink
    '#2DD4BF', // Light Teal
    '#A78BFA', // Light Violet
    '#34D399', // Mint Green
    '#FDBA74', // Peach
  ];
  
  // Consistent gray color for "Others"
  const OTHERS_COLOR = '#94A3B8';

  // Tier-aware color palettes: first color matches the tier identity
  const TIER_COLORS = {
    maintained: ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6', '#F97316', '#84CC16', '#06B6D4', '#F43F5E'],  // Blue first
    new:        ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6', '#F97316', '#84CC16', '#06B6D4', '#F43F5E'],  // Green first
    dropped:    ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6', '#F97316', '#84CC16', '#06B6D4'],  // Red first
  };

  const getTierColor = (tier, index) => {
    const palette = TIER_COLORS[tier] || DOMAIN_COLORS;
    return palette[index % palette.length];
  };
  
  // Function to get color for pie chart segment
  const getPieColor = (entry, index) => {
    return entry.name === 'Others' ? OTHERS_COLOR : DOMAIN_COLORS[index % DOMAIN_COLORS.length];
  };

  // Custom tooltip for pie charts
  const CustomPieTooltip = ({ active, payload, pieData }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const total = pieData.reduce((sum, item) => sum + item.value, 0);
      const contribution = ((data.value / total) * 100).toFixed(1);
      
      return (
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-lg px-3 py-2.5 shadow-xl" style={{ zIndex: 10000 }}>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: data.payload?.fill || '#3B82F6' }} />
            <p className="font-bold text-slate-900 text-xs">{data.name}</p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[11px] text-slate-600">{filters.metric}</span>
            <span className="text-[11px] font-bold text-slate-900">{data.value.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4 mt-0.5">
            <span className="text-[11px] text-slate-600">Share</span>
            <span className="text-[11px] font-bold text-blue-600">{contribution}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const PieLegend = ({ pieData, total, hoverBgClass }) => {
    const safeTotal = total || 0;

    return (
      <div className="w-full">
        <div className="rounded-lg border border-slate-200/60 bg-white/80 overflow-hidden">
          <div className="py-1">
            {pieData.map((entry, index) => {
              const color = getPieColor(entry, index);
              const pct = safeTotal > 0 ? (entry.value / safeTotal) * 100 : 0;

              return (
                <div
                  key={`${entry.name}-${index}`}
                  className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md transition-all duration-150 cursor-default ${hoverBgClass} hover:shadow-sm hover:scale-[1.01]`}
                  title={`${entry.name}: ${entry.value.toLocaleString()} ${filters.metric.toLowerCase()} (${pct.toFixed(1)}%)`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0 transition-transform duration-150 group-hover:scale-125"
                      style={{ backgroundColor: color }}
                    />
                    <span className={`text-[11px] font-semibold truncate transition-colors duration-150 ${
                      entry.name === 'Others' ? 'text-slate-500 group-hover:text-slate-700' : 'text-slate-800 group-hover:text-slate-950'
                    }`}>
                      {entry.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-bold text-slate-900 tabular-nums">
                      {formatNumber(entry.value)}
                    </span>
                    <span className="px-1.5 py-px rounded bg-slate-100 text-slate-600 text-[10px] font-semibold tabular-nums group-hover:bg-slate-200 transition-colors duration-150">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Calculate contribution percentages for week 1 and week 2
  const week1TopNTotal = pieDataWeek1
    .filter(item => item.name !== 'Others')
    .reduce((sum, item) => sum + item.value, 0);
  const week1TopNContribution = kpis.week1Total > 0 
    ? ((week1TopNTotal / kpis.week1Total) * 100).toFixed(0) 
    : 0;

  const week2TopNTotal = pieDataWeek2
    .filter(item => item.name !== 'Others')
    .reduce((sum, item) => sum + item.value, 0);
  const week2TopNContribution = kpis.week2Total > 0 
    ? ((week2TopNTotal / kpis.week2Total) * 100).toFixed(0) 
    : 0;

  // Domains from Top 10 union with conversion drop ≥10% (WoW)
  const CONV_DROP_THRESHOLD_PCT = 10;
  const domainsWithConvDrop = domainData.filter(
    d => d.change != null && d.change <= -CONV_DROP_THRESHOLD_PCT
  );
  
  // For contribution chart: use conv-drop list, sorted by week1 value
  const tierFilteredDomains = [...domainsWithConvDrop].sort((a, b) => (b.week1Conv || 0) - (a.week1Conv || 0));
  const tierDomainKeys = tierFilteredDomains.map(d => d.domain.substring(0, 40));
  
  const allContribKeys = Object.keys(contributionData[0] || {}).filter(key => key !== 'date');
  const filteredTierKeys = tierDomainKeys.filter(key => allContribKeys.includes(key));
  
  const domainsPerPage = 5;
  const chartTotalPages = Math.ceil(filteredTierKeys.length / domainsPerPage);
  const needsPagination = filteredTierKeys.length > domainsPerPage;
  const startIndex = chartPage * domainsPerPage;
  const endIndex = startIndex + domainsPerPage;
  const displayedDomainKeys = filteredTierKeys.slice(startIndex, endIndex);
  
  const filteredContributionData = contributionData.map(dataPoint => {
    const filtered = { date: dataPoint.date };
    displayedDomainKeys.forEach(key => {
      filtered[key] = dataPoint[key];
    });
    return filtered;
  });
  
  const displayedDomains = tierFilteredDomains.slice(startIndex, endIndex);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-3 lg:p-6 font-sans overflow-x-hidden">
      <div className="max-w-[1920px] mx-auto space-y-3 lg:space-y-6">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
              Domain Performance
            </h1>
            <p className="text-xs lg:text-sm text-slate-600 mt-1">WoW comparison by advertiser and campaign — conversions, impressions, clicks.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-50 rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-lg border border-slate-200/50 relative" style={{ zIndex: 50 }}>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3 lg:gap-4">
            {/* Advertiser */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Advertiser</label>
              <SearchableDropdown
                value={filters.advertiser}
                options={filterOptions.advertisers}
                onChange={(val) => handleFilterChange('advertiser', val)}
                placeholder="Search advertiser..."
              />
            </div>

            {/* Campaign */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Campaign</label>
              <SearchableDropdown
                value={filters.campaign}
                options={filterOptions.campaigns}
                onChange={(val) => handleFilterChange('campaign', val)}
                placeholder="Search campaign..."
              />
            </div>

            {/* Metric */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Metric</label>
              <SimpleDropdown
                value={filters.metric}
                options={filterOptions.metrics}
                onChange={(val) => handleFilterChange('metric', val)}
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Date</label>
              <div className="custom-datepicker-wrapper">
                <DatePicker
                  open={calendarOpen}
                  onInputClick={() => setCalendarOpen(true)}
                  onCalendarClose={() => setCalendarOpen(false)}
                  selected={previewDate || (filters.date ? new Date(filters.date) : new Date())}
                  onChange={(date) => {
                    if (date) setPreviewDate(date);
                  }}
                  dateFormat="dd-MM-yyyy"
                  showPopperArrow={false}
                  popperPlacement="bottom-end"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  minDate={filterOptions.dateRange?.min ? (() => { const d = new Date(filterOptions.dateRange.min); d.setDate(d.getDate() + 13); return d; })() : null}
                  maxDate={filterOptions.dateRange?.max ? new Date(filterOptions.dateRange.max) : null}
                  customInput={
                    (() => {
                      const DatePickerInput = (props) => {
                        const displayValue = dashboardData && weekRanges
                          ? `${formatDateRange(weekRanges.week1?.start, weekRanges.week1?.end)} vs ${formatDateRange(weekRanges.week2?.start, weekRanges.week2?.end)}`
                          : props.value ?? '';
                        return (
                          <input
                            {...props}
                            value={displayValue}
                            readOnly
                            className="w-full px-3 py-2.5 bg-blue-50 rounded-lg text-sm text-slate-900 font-medium outline-none cursor-pointer hover:bg-blue-100 focus:ring-2 focus:ring-blue-200 transition-all"
                          />
                        );
                      };
                      return <DatePickerInput />;
                    })()
                  }
                  wrapperClassName="w-full"
                  calendarClassName="clean-calendar"
                  shouldCloseOnSelect={false}
                  calendarContainer={({ className, children }) => {
                    const effectiveSelected = previewDate || (filters.date ? new Date(filters.date) : null);
                    const invalidMessage = getTwoWeekMessage(effectiveSelected);
                    const isGenerateDisabled = !!invalidMessage;

                    return (
                    <div className={className} aria-label="Choose Date" role="dialog" aria-modal="true" translate="no">
                      {children}
                      <div className="calendar-footer-inside">
                        {invalidMessage && (
                          <div className="px-2 pb-2">
                            <p className="text-[11px] text-amber-700 font-medium leading-tight">
                              {invalidMessage}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setPreviewDate(null); setCalendarOpen(false); }}
                            className="w-[100px] py-2.5 px-3 bg-white border-2 border-blue-600 text-blue-600 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isGenerateDisabled}
                            onClick={(e) => { e.stopPropagation(); if (!isGenerateDisabled) { handleGenerateDashboard(); setCalendarOpen(false); } }}
                            className={`w-[100px] py-2.5 px-3 text-xs font-semibold rounded-lg flex items-center justify-center transition-colors ${isGenerateDisabled ? 'bg-slate-100 border-2 border-slate-300 text-slate-400 cursor-not-allowed' : 'bg-white border-2 border-blue-600 text-blue-600 hover:bg-slate-50'}`}
                          >
                            Generate
                          </button>
                        </div>
                      </div>
                    </div>
                    );
                  }}
                  renderCustomHeader={({ date, changeMonth, changeYear, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => {
                    const minCalDate = filterOptions.dateRange?.min ? (() => { const d = new Date(filterOptions.dateRange.min); d.setDate(d.getDate() + 13); return d; })() : null;
                    const maxCalDate = filterOptions.dateRange?.max ? new Date(filterOptions.dateRange.max) : null;
                    const minYear = minCalDate ? minCalDate.getFullYear() : date.getFullYear() - 2;
                    const maxYear = maxCalDate ? maxCalDate.getFullYear() : date.getFullYear() + 2;
                    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                    return (
                      <div className="flex items-center justify-between gap-2 px-2 py-2 border-b border-slate-200">
                        <button
                          type="button"
                          onClick={decreaseMonth}
                          disabled={prevMonthButtonDisabled}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors flex-shrink-0"
                          aria-label="Previous month"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-center">
                          <select
                            value={date.getMonth()}
                            onChange={(e) => changeMonth(parseInt(e.target.value, 10))}
                            className="px-2 py-1 text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:border-blue-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
                          >
                            {months.map((m, i) => (
                              <option key={m} value={i}>{m}</option>
                            ))}
                          </select>
                          <select
                            value={date.getFullYear()}
                            onChange={(e) => changeYear(parseInt(e.target.value, 10))}
                            className="px-2 py-1 text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:border-blue-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
                          >
                            {Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i).map((y) => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={increaseMonth}
                          disabled={nextMonthButtonDisabled}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors flex-shrink-0"
                          aria-label="Next month"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    );
                  }}
                  dayClassName={(date) => {
                    const activeDate = previewDate || (filters.date ? new Date(filters.date) : null);
                    if (!activeDate) return '';
                    
                    const currentDate = new Date(date);
                    currentDate.setHours(0, 0, 0, 0);
                    
                    const week2End = new Date(activeDate);
                    week2End.setHours(0, 0, 0, 0);
                    const week2Start = new Date(week2End);
                    week2Start.setDate(week2Start.getDate() - 6);
                    
                    const week1End = new Date(week2Start);
                    week1End.setDate(week1End.getDate() - 1);
                    const week1Start = new Date(week1End);
                    week1Start.setDate(week1Start.getDate() - 6);
                    
                    const fullRangeStart = week1Start;
                    const fullRangeEnd = week2End;
                    if (currentDate < fullRangeStart || currentDate > fullRangeEnd) return '';
                    
                    const isFirst = currentDate.getTime() === fullRangeStart.getTime();
                    const isLast = currentDate.getTime() === fullRangeEnd.getTime();
                    if (isFirst && isLast) return 'range-bar range-start range-end range-first range-last';
                    if (isFirst) return 'range-bar range-start range-first';
                    if (isLast) return 'range-bar range-end range-last';
                    return 'range-bar';
                  }}
                >
                </DatePicker>
              </div>
            </div>
          </div>

          {/* Generate and Download buttons */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-[11px] text-slate-400">
              {!dashboardData && <span>Select filters and click Generate to load dashboard</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateDashboard}
                disabled={!filters.date || !!getTwoWeekMessage(previewDate || filters.date)}
                className={`w-[100px] py-2.5 px-3 rounded-lg transition-all font-semibold text-xs flex items-center justify-center gap-1.5 ${!filters.date || getTwoWeekMessage(previewDate || filters.date) ? 'bg-slate-100 border-2 border-slate-300 text-slate-400 cursor-not-allowed' : 'bg-white border-2 border-blue-600 text-blue-600 hover:bg-slate-50'}`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Generate
              </button>
              <div className="relative" ref={filterDownloadMenuRef}>
                <button
                  onClick={() => setShowFilterDownloadMenu(!showFilterDownloadMenu)}
                  className="w-[100px] py-2.5 px-3 bg-white border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-slate-50 transition-all font-semibold text-xs flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showFilterDownloadMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5" style={{ zIndex: 9999 }}>
                    <button
                      onClick={handleExportCSV}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-3"
                    >
                      <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <Download className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <div className="font-semibold">Download CSV</div>
                        <div className="text-[10px] text-slate-400">Table data as spreadsheet</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Domains with conversion drop ≥10% */}
        <div className="bg-white rounded-xl lg:rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden">
            <div className="px-4 lg:px-6 py-3 lg:py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base lg:text-lg font-bold text-slate-900">Domains with conversion drop ≥10%</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Domains that appear in the Top {filters.topN} in either week and had at least 10% week-over-week conversion decline.</p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-blue-600 text-blue-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors">
                  <span>Based on</span>
                  <span>{filters.metric}</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto -mx-2 lg:mx-0">
              <table className="w-full min-w-[900px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {entityLabel}
                    </th>
                    <th 
                      className={`px-4 py-4 text-center text-xs font-bold cursor-pointer hover:bg-slate-100 transition-colors ${
                        sortColumn === 'week1Conv' ? 'bg-blue-100 text-blue-800' : 'text-slate-800'
                      }`}
                      onClick={() => handleSort('week1Conv')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <div>
                          <div className="uppercase tracking-wider">Week 1</div>
                          <div className={`text-xs font-semibold mt-0.5 normal-case ${sortColumn === 'week1Conv' ? 'text-blue-900' : 'text-slate-600'}`}>{formatDateRange(weekRanges.week1.start, weekRanges.week1.end)}</div>
                        </div>
                        {sortColumn === 'week1Conv' && (
                          sortDirection === 'desc' ? <ChevronDown className="w-4 h-4 text-blue-800" /> : <ChevronUp className="w-4 h-4 text-blue-800" />
                        )}
                      </div>
                    </th>
                    <th 
                      className={`px-4 py-4 text-center text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                        sortColumn === 'rank1' ? 'bg-blue-100 text-blue-800' : 'text-slate-800'
                      }`}
                      onClick={() => handleSort('rank1')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Week 1 Rank
                        {sortColumn === 'rank1' && (
                          sortDirection === 'desc' ? <ChevronDown className="w-4 h-4 text-blue-800" /> : <ChevronUp className="w-4 h-4 text-blue-800" />
                        )}
                      </div>
                    </th>
                    <th 
                      className={`px-4 py-4 text-center text-xs font-bold cursor-pointer hover:bg-slate-100 transition-colors ${
                        sortColumn === 'week2Conv' ? 'bg-blue-100 text-blue-800' : 'text-slate-800'
                      }`}
                      onClick={() => handleSort('week2Conv')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <div>
                          <div className="uppercase tracking-wider">Week 2</div>
                          <div className={`text-xs font-semibold mt-0.5 normal-case ${sortColumn === 'week2Conv' ? 'text-blue-900' : 'text-slate-600'}`}>{formatDateRange(weekRanges.week2.start, weekRanges.week2.end)}</div>
                        </div>
                        {sortColumn === 'week2Conv' && (
                          sortDirection === 'desc' ? <ChevronDown className="w-4 h-4 text-blue-800" /> : <ChevronUp className="w-4 h-4 text-blue-800" />
                        )}
                      </div>
                    </th>
                    <th 
                      className={`px-4 py-4 text-center text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                        sortColumn === 'rank2' ? 'bg-blue-100 text-blue-800' : 'text-slate-800'
                      }`}
                      onClick={() => handleSort('rank2')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Week 2 Rank
                        {sortColumn === 'rank2' && (
                          sortDirection === 'desc' ? <ChevronDown className="w-4 h-4 text-blue-800" /> : <ChevronUp className="w-4 h-4 text-blue-800" />
                        )}
                      </div>
                    </th>
                    <th 
                      className={`px-4 py-4 text-center text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                        sortColumn === 'convChange' ? 'bg-blue-100 text-blue-800' : 'text-slate-800'
                      }`}
                      onClick={() => handleSort('convChange')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        {metricChangeShortLabel} Change
                        {sortColumn === 'convChange' && (
                          sortDirection === 'desc' ? <ChevronDown className="w-4 h-4 text-blue-800" /> : <ChevronUp className="w-4 h-4 text-blue-800" />
                        )}
                      </div>
                    </th>
                    <th 
                      className={`px-4 py-4 text-center text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors ${
                        sortColumn === 'change' ? 'bg-blue-100 text-blue-800' : 'text-slate-800'
                      }`}
                      onClick={() => handleSort('change')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        WoW Growth %
                        {sortColumn === 'change' && (
                          sortDirection === 'desc' ? <ChevronDown className="w-4 h-4 text-blue-800" /> : <ChevronUp className="w-4 h-4 text-blue-800" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Trend
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {domainsWithConvDrop.length > 0 ? (
                    <>
                      <tr className="bg-red-50/50">
                        <td colSpan="8" className="px-6 py-3">
                          <div className="flex items-center gap-2 font-bold text-red-900">
                            <TrendingDown className="w-5 h-5" />
                            <span>Conversion drop ≥10% · {domainsWithConvDrop.length} {entityLabelLower}s</span>
                          </div>
                        </td>
                      </tr>
                      {getSortedDomains(domainsWithConvDrop).map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-semibold text-slate-900">{item.domain.substring(0, 40)}</div>
                              <div className="flex items-center gap-1 mt-1">
                                <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                                <span className="text-xs text-red-600 font-medium">Conv. drop ≥10%</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="font-semibold text-slate-700">{item.week1Conv.toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {item.rank1 != null ? (
                              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg font-semibold text-sm">#{item.rank1}</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="font-semibold text-slate-900">{item.week2Conv.toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {item.rank2 != null ? (
                              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg font-semibold text-sm">#{item.rank2}</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-center">
                            {(() => {
                              const convChange = item.week2Conv - item.week1Conv;
                              return (
                                <span className={`px-3 py-1.5 rounded-lg font-bold text-sm inline-flex items-center justify-center gap-1 ${getChangeColor(convChange)}`}>
                                  {convChange > 0 ? '+' : ''}{convChange.toLocaleString()}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`px-3 py-1.5 rounded-lg font-bold text-sm inline-flex items-center gap-1 ${getChangeColor(item.change)}`}>
                              {getChangeIcon(item.change)}
                              {item.change > 0 ? '+' : ''}{item.change.toFixed(0)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="w-24 h-8 mx-auto">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={item.trend.map((v, i) => ({ v }))}>
                                  <Line type="monotone" dataKey="v" stroke="#EF4444" strokeWidth={2} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center">
                        <div className="text-slate-500">
                          <TrendingDown className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                          <p className="font-semibold text-slate-600">No domains with conversion drop ≥10%</p>
                          <p className="text-sm mt-1">No {entityLabelLower}s had a week-over-week conversion decline of 10% or more.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        {/* Contribution Chart */}
        <div className="bg-white rounded-xl lg:rounded-2xl shadow-xl border border-slate-200/50">
          <div className="px-4 lg:px-6 py-3 lg:py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
              <div>
                <h2 className="text-base lg:text-lg font-bold text-slate-900">{entityLabel} Contribution Over Time</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {domainsWithConvDrop.length > 0
                    ? (needsPagination
                      ? `Conv. drop ≥10%: ${startIndex + 1}-${Math.min(endIndex, filteredTierKeys.length)} of ${filteredTierKeys.length}`
                      : `Daily ${filters.metric.toLowerCase()} for ${filteredTierKeys.length} ${entityLabelLower}(s) with conv. drop ≥10%`)
                    : `No ${entityLabelLower}s with conversion drop ≥10%`
                  }
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-blue-200 rounded"></div>
                    <span className="text-slate-600">{formatDateRange(weekRanges.week1.start, weekRanges.week1.end)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-indigo-200 rounded"></div>
                    <span className="text-slate-600">{formatDateRange(weekRanges.week2.start, weekRanges.week2.end)}</span>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-blue-600 text-blue-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors">
                  <span>Based on</span>
                  <span>{filters.metric}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 lg:p-6">

          {/* Pagination for conv-drop domains */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            {domainsWithConvDrop.length > 0 && (
              <p className="text-xs text-slate-600">
                Showing {domainsWithConvDrop.length} {entityLabelLower}(s) with conversion drop ≥10%
              </p>
            )}
            {needsPagination && (
              <div className="flex items-center gap-1.5">
                {Array.from({ length: chartTotalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setChartPage(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      chartPage === i
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {i * domainsPerPage + 1}-{Math.min((i + 1) * domainsPerPage, filteredTierKeys.length)}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {displayedDomainKeys.length > 0 ? (
            <>
              {displayedDomainKeys.length === 1 ? (
                /* Single domain — area chart with gradient fill */
                (() => {
                  const singleKey = displayedDomainKeys[0];
                  const color = getTierColor('dropped', startIndex);
                  return (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={filteredContributionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="singleDomainGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="50%" stopColor={color} stopOpacity={0.1} />
                            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: '12px' }} />
                        <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                          labelStyle={{ color: '#1e293b', fontWeight: 600 }}
                        />
                        <Area
                          type="monotone"
                          dataKey={singleKey}
                          stroke={color}
                          strokeWidth={3}
                          fill="url(#singleDomainGradient)"
                          dot={{ r: 5, strokeWidth: 2.5, stroke: '#fff', fill: color }}
                          activeDot={{ r: 8, strokeWidth: 3, stroke: '#fff', fill: color }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  );
                })()
              ) : (
                /* Multiple domains — line chart */
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={filteredContributionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      labelStyle={{ color: '#1e293b', fontWeight: 600 }}
                    />
                    {displayedDomainKeys.map((key, idx) => {
                      const globalIdx = startIndex + idx;
                      const color = getTierColor('dropped', globalIdx);
                      return (
                        <Line 
                          key={key}
                          type="monotone" 
                          dataKey={key} 
                          stroke={color} 
                          strokeWidth={3}
                          dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: color }}
                          activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              )}

              {/* Custom legend */}
              <div className="mt-3 flex justify-center">
                <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
                  {displayedDomainKeys.map((key, idx) => {
                    const globalIdx = startIndex + idx;
                    const color = getTierColor('dropped', globalIdx);
                    return (
                      <div key={key} className="flex items-center gap-1.5 max-w-[180px]" title={key}>
                        <div className="w-3 h-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs text-slate-600 truncate">{key}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 lg:mt-6 flex flex-wrap justify-center gap-2 lg:gap-4" style={{ '--card-w': 'calc((100% - 4 * 1rem) / 5)' }}>
                {displayedDomains.map((domain, idx) => {
                  const globalIdx = startIndex + idx;
                  const lineColor = getTierColor('dropped', globalIdx);
                  
                  return (
                    <div 
                      key={idx} 
                      className="rounded-xl p-4 border transition-shadow hover:shadow-md"
                      style={{ 
                        backgroundColor: `${lineColor}12`,
                        borderColor: `${lineColor}30`,
                        width: 'var(--card-w)'
                      }}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <div className="w-3 h-3 rounded-sm flex-shrink-0 mt-0.5" style={{ backgroundColor: lineColor }} />
                        <div className="text-xs font-semibold text-slate-800 leading-snug break-words">{domain.domain.substring(0, 40)}</div>
                      </div>
                      <div className="text-2xl font-bold text-slate-900">
                        {domain.change !== null ? `${domain.change > 0 ? '+' : ''}${domain.change.toFixed(0)}%` : 'NEW'}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">WoW Change</div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400">
              <div className="text-center">
                <div className="text-lg font-semibold mb-1">No {entityLabelLower}s with conversion drop ≥10%</div>
                <div className="text-sm">Contribution chart shows when there are domains with WoW conv. decline ≥10%</div>
              </div>
            </div>
          )}
          </div>
        </div>

      </div>
    </div>
  );
}
