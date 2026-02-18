from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
from datetime import timedelta

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Load data with optimized dtypes for faster load and lower memory
# Uses "compressed_data (1).csv": Day, Advertiser, Campaign, Domain, Ad Impressions, Clicks, Weighted Conversion
def load_data():
    """Load and preprocess the data"""
    df = pd.read_csv(
        "compressed_data (1).csv",
        dtype={'Clicks': 'int64', 'Ad Impressions': 'int64'},
    )
    df['Date'] = pd.to_datetime(df['Day'])
    df['Impressions'] = df['Ad Impressions'].astype('int64')
    df['Conversions'] = df['Weighted Conversion'].fillna(0).astype('float64')  # sum as float, display as int
    df['Clean Domain'] = df['Domain'].str.replace(r'^www\.', '', regex=True, case=False)
    df['Clean Keyword'] = ''  # no keyword column in this file; analysis is domain-only
    return df

df = load_data()

@app.route('/')
@app.route('/api/health')
def health():
    """Health check for load balancers"""
    return jsonify({'status': 'ok', 'service': 'domain-performance-api'})

def get_week_range(date, week_offset=0):
    """Get start and end date for a week - 7 days ending on selected date"""
    week_end = date - timedelta(days=week_offset * 7)
    week_start = week_end - timedelta(days=6)
    return week_start, week_end

def calculate_metrics(advertiser, campaign, week_start, week_end, metric_type='Conversions', group_col='Clean Domain', data_df=None):
    """Calculate metrics for a specific week, grouped by group_col. Use data_df if provided (pre-filtered by date range) for speed."""
    base = data_df if data_df is not None else df
    week_data = base[
        (base['Date'] >= week_start) &
        (base['Date'] <= week_end)
    ]
    if advertiser and advertiser != "All Advertisers":
        week_data = week_data[week_data['Advertiser'] == advertiser]
    if campaign and campaign != "All Campaigns":
        week_data = week_data[week_data['Campaign'] == campaign]
    
    domain_metrics = week_data.groupby(group_col).agg({
        'Conversions': 'sum',
        'Clicks': 'sum',
        'Impressions': 'sum'
    }).reset_index()
    
    # Determine sort order based on metric_type with tie-breaking logic
    if metric_type == 'Conversions':
        sort_by = ['Conversions', 'Clicks', 'Impressions']
    elif metric_type == 'Clicks':
        sort_by = ['Clicks', 'Conversions', 'Impressions']
    elif metric_type == 'Impressions':
        sort_by = ['Impressions', 'Conversions', 'Clicks']
    else:
        sort_by = ['Conversions', 'Clicks', 'Impressions']
    
    domain_metrics = domain_metrics.sort_values(
        by=sort_by,
        ascending=False
    ).reset_index(drop=True)
    
    domain_metrics['Rank'] = range(1, len(domain_metrics) + 1)
    return domain_metrics

@app.route('/api/filters', methods=['GET'])
def get_filters():
    """Get available filter options"""
    advertisers = sorted(df['Advertiser'].unique().tolist())
    
    return jsonify({
        'advertisers': advertisers,
        'metrics': ['Conversions', 'Clicks', 'Impressions'],
        'dateRange': {
            'min': df['Date'].min().strftime('%Y-%m-%d'),
            'max': df['Date'].max().strftime('%Y-%m-%d')
        }
    })

@app.route('/api/campaigns', methods=['GET'])
def get_campaigns():
    """Get campaigns for selected advertiser"""
    advertiser = request.args.get('advertiser')
    
    if advertiser and advertiser != "All Advertisers":
        campaigns = sorted(df[df['Advertiser'] == advertiser]['Campaign'].unique().tolist())
    else:
        campaigns = sorted(df['Campaign'].unique().tolist())
    
    return jsonify({'campaigns': campaigns})

@app.route('/api/campaign-advertiser', methods=['GET'])
def get_campaign_advertiser():
    """Get advertiser for a specific campaign"""
    campaign = request.args.get('campaign')
    
    if campaign and campaign != "All Campaigns":
        campaign_data = df[df['Campaign'] == campaign]
        if not campaign_data.empty:
            advertiser = campaign_data.iloc[0]['Advertiser']
            return jsonify({'advertiser': advertiser})
    
    return jsonify({'advertiser': 'All Advertisers'})

def get_raw_totals(advertiser, campaign, week_start, week_end, data_df=None):
    """Get raw totals directly from data (not grouped). Use data_df if provided for speed."""
    base = data_df if data_df is not None else df
    week_data = base[
        (base['Date'] >= week_start) &
        (base['Date'] <= week_end)
    ]
    if advertiser and advertiser != "All Advertisers":
        week_data = week_data[week_data['Advertiser'] == advertiser]
    if campaign and campaign != "All Campaigns":
        week_data = week_data[week_data['Campaign'] == campaign]
    
    return {
        'impressions': int(week_data['Impressions'].sum()),
        'clicks': int(week_data['Clicks'].sum()),
        'conversions': int(week_data['Conversions'].sum())
    }

@app.route('/api/dashboard-data', methods=['POST'])
def get_dashboard_data():
    """Get all dashboard data based on filters"""
    data = request.json
    
    top_n = data.get('topN', 5)
    advertiser = data.get('advertiser', 'All Advertisers')
    campaign = data.get('campaign', 'All Campaigns')
    selected_date = pd.to_datetime(data.get('date', df['Date'].max()))
    metric_type = data.get('metric', 'Conversions')
    analysis_type = data.get('analysisType', 'Domain')
    
    # Determine grouping column based on analysis type
    group_col = 'Clean Keyword' if analysis_type == 'Keyword' else 'Clean Domain'
    
    # Calculate weeks
    week0_start, week0_end = get_week_range(selected_date, 2)
    week1_start, week1_end = get_week_range(selected_date, 1)
    week2_start, week2_end = get_week_range(selected_date, 0)
    week3_start, _ = get_week_range(selected_date, 3)
    # Pre-filter to 4-week range so all later ops work on a small subset (big speedup)
    df_range = df[(df['Date'] >= week3_start) & (df['Date'] <= week2_end)].copy()

    # Get raw totals and grouped metrics using pre-filtered data
    week1_raw = get_raw_totals(advertiser, campaign, week1_start, week1_end, data_df=df_range)
    week2_raw = get_raw_totals(advertiser, campaign, week2_start, week2_end, data_df=df_range)
    week0_metrics = calculate_metrics(advertiser, campaign, week0_start, week0_end, metric_type, group_col, data_df=df_range)
    week1_metrics = calculate_metrics(advertiser, campaign, week1_start, week1_end, metric_type, group_col, data_df=df_range)
    week2_metrics = calculate_metrics(advertiser, campaign, week2_start, week2_end, metric_type, group_col, data_df=df_range)
    
    # Calculate totals from raw data (guaranteed consistent)
    week1_total = week1_raw[metric_type.lower()]
    week2_total = week2_raw[metric_type.lower()]

    # Get top N from both weeks
    week1_top = set(week1_metrics.head(top_n)[group_col].tolist())
    week2_top = set(week2_metrics.head(top_n)[group_col].tolist())
    
    # Categorize
    maintained_domains = week1_top.intersection(week2_top)
    new_domains = week2_top - week1_top
    dropped_domains = week1_top - week2_top
    
    # Build domain/keyword comparison data with tiers
    domain_data = []
    
    # Tier 1: Maintained
    for item in sorted(maintained_domains):
        week1_row = week1_metrics[week1_metrics[group_col] == item].iloc[0]
        week2_row = week2_metrics[week2_metrics[group_col] == item].iloc[0]
        
        week1_value = week1_row[metric_type]
        week1_rank = week1_row['Rank']
        week2_value = week2_row[metric_type]
        week2_rank = week2_row['Rank']
        
        change_pct_val = ((week2_value - week1_value) / week1_value * 100) if week1_value > 0 else None
        rank_change = week1_rank - week2_rank
        
        # Get 14-day trend (df_range already limited to week0_start..week2_end)
        trend_data = df_range[df_range[group_col] == item]
        if advertiser and advertiser != "All Advertisers":
            trend_data = trend_data[trend_data['Advertiser'] == advertiser]
        if campaign and campaign != "All Campaigns":
            trend_data = trend_data[trend_data['Campaign'] == campaign]
        daily = trend_data.groupby('Date')[metric_type].sum().reset_index()
        all_dates = pd.date_range(week1_start, week2_end, freq='D')
        daily = daily.set_index('Date').reindex(all_dates, fill_value=0).reset_index()
        trend = daily[metric_type].tolist()
        domain_data.append({
            'domain': item,
            'tier': 'maintained',
            'week1Conv': int(week1_value),
            'rank1': int(week1_rank),
            'week2Conv': int(week2_value),
            'rank2': int(week2_rank),
            'change': float(change_pct_val) if change_pct_val is not None else None,
            'rankChange': int(rank_change),
            'trend': trend
        })
    
    # Tier 2: New Entry
    for item in sorted(new_domains):
        week2_row = week2_metrics[week2_metrics[group_col] == item].iloc[0]
        week2_value = week2_row[metric_type]
        week2_rank = week2_row['Rank']
        
        week1_row = week1_metrics[week1_metrics[group_col] == item]
        if not week1_row.empty:
            week1_value = week1_row.iloc[0][metric_type]
            week1_rank = week1_row.iloc[0]['Rank']
        else:
            week1_value = 0
            week1_rank = None
        
        change_pct_val = ((week2_value - week1_value) / week1_value * 100) if week1_value > 0 else None
        rank_change = week1_rank - week2_rank if week1_rank else None
        trend_data = df_range[df_range[group_col] == item]
        if advertiser and advertiser != "All Advertisers":
            trend_data = trend_data[trend_data['Advertiser'] == advertiser]
        if campaign and campaign != "All Campaigns":
            trend_data = trend_data[trend_data['Campaign'] == campaign]
        daily = trend_data.groupby('Date')[metric_type].sum().reset_index()
        all_dates = pd.date_range(week1_start, week2_end, freq='D')
        daily = daily.set_index('Date').reindex(all_dates, fill_value=0).reset_index()
        trend = daily[metric_type].tolist()
        domain_data.append({
            'domain': item,
            'tier': 'new',
            'week1Conv': int(week1_value),
            'rank1': int(week1_rank) if week1_rank else None,
            'week2Conv': int(week2_value),
            'rank2': int(week2_rank),
            'change': float(change_pct_val) if change_pct_val is not None else None,
            'rankChange': int(rank_change) if rank_change else None,
            'trend': trend
        })
    
    # Tier 3: Dropped
    for item in sorted(dropped_domains):
        week1_row = week1_metrics[week1_metrics[group_col] == item].iloc[0]
        week1_value = week1_row[metric_type]
        week1_rank = week1_row['Rank']
        
        week2_row = week2_metrics[week2_metrics[group_col] == item]
        if not week2_row.empty:
            week2_value = week2_row.iloc[0][metric_type]
            week2_rank = week2_row.iloc[0]['Rank']
        else:
            week2_value = 0
            week2_rank = None
        
        change_pct_val = ((week2_value - week1_value) / week1_value * 100) if week1_value > 0 else None
        rank_change = week1_rank - week2_rank if week2_rank else None
        trend_data = df_range[df_range[group_col] == item]
        if advertiser and advertiser != "All Advertisers":
            trend_data = trend_data[trend_data['Advertiser'] == advertiser]
        if campaign and campaign != "All Campaigns":
            trend_data = trend_data[trend_data['Campaign'] == campaign]
        daily = trend_data.groupby('Date')[metric_type].sum().reset_index()
        all_dates = pd.date_range(week1_start, week2_end, freq='D')
        daily = daily.set_index('Date').reindex(all_dates, fill_value=0).reset_index()
        trend = daily[metric_type].tolist()
        domain_data.append({
            'domain': item,
            'tier': 'dropped',
            'week1Conv': int(week1_value),
            'rank1': int(week1_rank),
            'week2Conv': int(week2_value),
            'rank2': int(week2_rank) if week2_rank else None,
            'change': float(change_pct_val) if change_pct_val is not None else None,
            'rankChange': int(rank_change) if rank_change else None,
            'trend': trend
        })
    
    # Get ALL union items for contribution chart
    all_union_items = sorted(maintained_domains | new_domains | dropped_domains)
    # Build contribution data in one groupby (much faster than per-date per-item filters)
    contrib_df = df_range.copy()
    if advertiser and advertiser != "All Advertisers":
        contrib_df = contrib_df[contrib_df['Advertiser'] == advertiser]
    if campaign and campaign != "All Campaigns":
        contrib_df = contrib_df[contrib_df['Campaign'] == campaign]
    daily_sums = contrib_df.groupby(['Date', group_col])[metric_type].sum().unstack(fill_value=0)
    all_dates = pd.date_range(week1_start, week2_end, freq='D')
    daily_sums = daily_sums.reindex(index=all_dates, fill_value=0).reindex(columns=all_union_items, fill_value=0)
    contribution_data = []
    for date in all_dates:
        data_point = {'date': date.strftime('%b %d')}
        for item in all_union_items:
            data_point[item[:40]] = int(daily_sums.loc[date, item])
        contribution_data.append(data_point)
    
    # Pie chart data - each week shows its own top N
    pie_data_week1 = []
    pie_data_week2 = []
    
    for idx, row in week1_metrics.head(top_n).iterrows():
        item_name = row[group_col]
        pie_data_week1.append({
            'name': item_name[:40],
            'value': int(row[metric_type])
        })
    
    for idx, row in week2_metrics.head(top_n).iterrows():
        item_name = row[group_col]
        pie_data_week2.append({
            'name': item_name[:40],
            'value': int(row[metric_type])
        })
    
    # Add "Others"
    if len(week1_metrics) > top_n:
        others_week1 = week1_metrics.iloc[top_n:][metric_type].sum()
        if others_week1 > 0:
            pie_data_week1.append({'name': 'Others', 'value': int(others_week1)})
    
    if len(week2_metrics) > top_n:
        others_week2 = week2_metrics.iloc[top_n:][metric_type].sum()
        if others_week2 > 0:
            pie_data_week2.append({'name': 'Others', 'value': int(others_week2)})
    
    return jsonify({
        'kpis': {
            'week1Total': int(week1_total),
            'week2Total': int(week2_total)
        },
        'domainData': domain_data,
        'contributionData': contribution_data,
        'pieDataWeek1': pie_data_week1,
        'pieDataWeek2': pie_data_week2,
        'weekRanges': {
            'week1': {
                'start': week1_start.strftime('%Y-%m-%d'),
                'end': week1_end.strftime('%Y-%m-%d')
            },
            'week2': {
                'start': week2_start.strftime('%Y-%m-%d'),
                'end': week2_end.strftime('%Y-%m-%d')
            }
        }
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
