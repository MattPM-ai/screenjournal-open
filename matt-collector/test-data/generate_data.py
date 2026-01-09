#!/usr/bin/env python3
"""
============================================================================
TURBO ORGANIZATION TEST DATA GENERATOR
============================================================================

PURPOSE: Generate realistic employee monitoring test data for 8 users
         across 9 days (Nov 15-23, 2025) in InfluxDB line protocol format.

OUTPUTS:
  - influxdb/*.lp (InfluxDB line protocol files)
  - metadata/data_manifest.json (generation statistics)

============================================================================
"""

import json
import random
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
import os

# Seed for reproducibility
random.seed(42)

# ============================================================================
# DATA STRUCTURES
# ============================================================================

class WindowActivity:
    def __init__(self, user, hostname, app, title, duration, timestamp):
        self.user = user
        self.hostname = hostname
        self.app = app
        self.title = title
        self.duration = duration  # seconds
        self.timestamp = timestamp

class AfkStatus:
    def __init__(self, user, hostname, status, duration, timestamp):
        self.user = user
        self.hostname = hostname
        self.status = status  # 'active', 'idle', 'afk'
        self.duration = duration  # seconds
        self.timestamp = timestamp

class AppUsage:
    def __init__(self, user, hostname, app_name, duration_seconds, event_count, timestamp):
        self.user = user
        self.hostname = hostname
        self.app_name = app_name
        self.duration_seconds = duration_seconds
        self.event_count = event_count
        self.timestamp = timestamp

class DailyMetric:
    def __init__(self, user, hostname, date, active_seconds, idle_seconds, 
                 afk_seconds, app_switches, utilization_ratio, timestamp):
        self.user = user
        self.hostname = hostname
        self.date = date
        self.active_seconds = active_seconds
        self.idle_seconds = idle_seconds
        self.afk_seconds = afk_seconds
        self.app_switches = app_switches
        self.utilization_ratio = utilization_ratio
        self.timestamp = timestamp

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def load_user_profiles(filepath):
    """Load user profiles from JSON file."""
    with open(filepath, 'r') as f:
        return json.load(f)

def get_date_range(start_str, end_str):
    """Generate list of dates between start and end."""
    start = datetime.strptime(start_str, '%Y-%m-%d')
    end = datetime.strptime(end_str, '%Y-%m-%d')
    dates = []
    current = start
    while current <= end:
        dates.append(current)
        current += timedelta(days=1)
    return dates

def is_weekend(date):
    """Check if date is weekend."""
    return date.weekday() >= 5  # Saturday=5, Sunday=6

def escape_lp_string(s):
    """Escape string for InfluxDB line protocol."""
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'

def escape_lp_tag(s):
    """Escape tag value for InfluxDB line protocol."""
    return s.replace(',', '\\,').replace('=', '\\=').replace(' ', '\\ ')

def datetime_to_nanos(dt):
    """Convert datetime to nanoseconds timestamp."""
    return int(dt.timestamp() * 1_000_000_000)

# ============================================================================
# WINDOW TITLES GENERATOR
# ============================================================================

WINDOW_TITLES = {
    'VSCode': [
        'main.go - VSCode', 'api.py - VSCode', 'README.md - VSCode',
        'config.json - VSCode', 'test_utils.py - VSCode', 'server.js - VSCode'
    ],
    'Terminal': [
        'Terminal', 'bash', 'npm run dev', 'git status', 'docker ps'
    ],
    'Chrome': [
        'Gmail - Chrome', 'Google Search - Chrome', 'Stack Overflow - Chrome',
        'GitHub - Chrome', 'Documentation - Chrome', 'AWS Console - Chrome'
    ],
    'Slack': [
        '#general - Slack', '#engineering - Slack', '#random - Slack', 
        'Direct Messages - Slack'
    ],
    'Outlook': [
        'Inbox - Outlook', 'Calendar - Outlook', 'Meeting Request - Outlook'
    ],
    'Excel': [
        'Budget 2025.xlsx - Excel', 'Report.xlsx - Excel', 'Data.xlsx - Excel'
    ],
    'Xero': [
        'Dashboard - Xero', 'Invoices - Xero', 'Reports - Xero'
    ],
    'Teams': [
        'Team Chat - Teams', 'Meeting - Teams', 'Files - Teams'
    ],
    'DocuSign': [
        'Documents - DocuSign', 'Sign Document - DocuSign'
    ],
    'Salesforce': [
        'Leads - Salesforce', 'Opportunities - Salesforce', 'Dashboard - Salesforce'
    ],
    'Zoom': [
        'Meeting - Zoom', 'Zoom Call'
    ],
    'Calendar': [
        'Calendar', 'Week View - Calendar'
    ],
    'Zendesk': [
        'Tickets - Zendesk', 'Customer Support - Zendesk'
    ],
    'Figma': [
        'Design Project - Figma', 'Wireframes - Figma', 'Prototype - Figma'
    ],
    'Photoshop': [
        'Banner Design - Photoshop', 'Logo - Photoshop'
    ],
    'Reddit': [
        'Reddit - Front Page', 'r/programming - Reddit'
    ],
    'YouTube': [
        'YouTube', 'Watch - YouTube'
    ],
    'Twitter': [
        'Twitter', 'Home - Twitter'
    ],
    'Spotify': [
        'Spotify - Now Playing', 'Playlists - Spotify'
    ],
    'Instagram': [
        'Instagram', 'Feed - Instagram'
    ]
}

def get_window_title(app):
    """Get random window title for app."""
    if app in WINDOW_TITLES:
        return random.choice(WINDOW_TITLES[app])
    return app

# ============================================================================
# DATA GENERATION LOGIC
# ============================================================================

def generate_work_session(user_profile, date, hostname):
    """Generate a work session for a user on a specific date."""
    
    # Check if user works this day
    is_weekend_day = is_weekend(date)
    if is_weekend_day:
        if not user_profile.get('weekend_activity', False):
            return None
        # Use weekend schedule
        day_name = 'saturday' if date.weekday() == 5 else 'sunday'
        weekend_sched = user_profile.get('weekend_schedule', {}).get(day_name)
        if not weekend_sched:
            return None
        
        start_time = datetime.strptime(f"{date.date()} {weekend_sched['start']}", '%Y-%m-%d %H:%M')
        end_time = datetime.strptime(f"{date.date()} {weekend_sched['end']}", '%Y-%m-%d %H:%M')
    else:
        # Regular workday
        work_hours = user_profile['work_hours']
        variance = work_hours['variance_minutes']
        
        start_variance = random.randint(-variance, variance)
        end_variance = random.randint(-variance, variance)
        
        start_time = datetime.strptime(f"{date.date()} {work_hours['start']}", '%Y-%m-%d %H:%M')
        start_time += timedelta(minutes=start_variance)
        
        end_time = datetime.strptime(f"{date.date()} {work_hours['end']}", '%Y-%m-%d %H:%M')
        end_time += timedelta(minutes=end_variance)
    
    return {'start': start_time, 'end': end_time, 'is_weekend': is_weekend_day}

def generate_breaks(user_profile, work_session):
    """Generate break times for a work session."""
    breaks = []
    afk_behavior = user_profile['afk_behavior']
    
    # Lunch break
    work_duration = (work_session['end'] - work_session['start']).seconds
    if work_duration > 4 * 3600:  # More than 4 hours of work
        lunch_duration = random.randint(*afk_behavior['lunch_minutes'])
        lunch_start_offset = random.randint(int(work_duration * 0.3), int(work_duration * 0.5))
        lunch_start = work_session['start'] + timedelta(seconds=lunch_start_offset)
        breaks.append({
            'start': lunch_start,
            'end': lunch_start + timedelta(minutes=lunch_duration),
            'type': 'lunch'
        })
    
    # Coffee breaks
    num_breaks = random.randint(*afk_behavior['coffee_breaks'])
    for _ in range(num_breaks):
        break_duration = random.randint(*afk_behavior['break_duration_minutes'])
        # Random time during work hours, avoiding lunch
        attempts = 0
        while attempts < 10:
            break_offset = random.randint(0, work_duration - break_duration * 60)
            break_start = work_session['start'] + timedelta(seconds=break_offset)
            
            # Check if overlaps with lunch
            overlaps = False
            for existing_break in breaks:
                if break_start < existing_break['end'] and break_start + timedelta(minutes=break_duration) > existing_break['start']:
                    overlaps = True
                    break
            
            if not overlaps:
                breaks.append({
                    'start': break_start,
                    'end': break_start + timedelta(minutes=break_duration),
                    'type': 'coffee'
                })
                break
            attempts += 1
    
    # Sort breaks by start time
    breaks.sort(key=lambda x: x['start'])
    return breaks

def generate_window_activities(user_profile, work_session, breaks):
    """Generate window activity events for a work session."""
    activities = []
    
    # Get user's apps
    all_apps = (user_profile['apps']['productive'] + 
                user_profile['apps']['neutral'] + 
                user_profile['apps']['unproductive'])
    
    if not all_apps:
        all_apps = ['Chrome']  # Fallback
    
    # Calculate app weights (productive apps more likely)
    productive_count = len(user_profile['apps']['productive'])
    neutral_count = len(user_profile['apps']['neutral'])
    unproductive_count = len(user_profile['apps']['unproductive'])
    
    app_weights = ([3] * productive_count + 
                   [2] * neutral_count + 
                   [1] * unproductive_count)
    
    current_time = work_session['start']
    end_time = work_session['end']
    current_app = random.choices(all_apps, weights=app_weights)[0]
    
    while current_time < end_time:
        # Check if we're in a break
        in_break = False
        for brk in breaks:
            if current_time >= brk['start'] and current_time < brk['end']:
                in_break = True
                current_time = brk['end']
                break
        
        if in_break or current_time >= end_time:
            continue
        
        # Duration: shorter for high app switchers, longer for focused workers
        app_switches_range = user_profile['productivity']['app_switches_per_day']
        avg_switches = sum(app_switches_range) / 2
        
        if avg_switches > 80:  # High switcher
            duration = random.randint(30, 180)  # 30s to 3min
        elif avg_switches > 50:  # Medium switcher
            duration = random.randint(60, 300)  # 1min to 5min
        else:  # Low switcher (focused)
            duration = random.randint(180, 900)  # 3min to 15min
        
        # Ensure we don't go past end time or into breaks
        remaining_time = (end_time - current_time).seconds
        next_break_time = None
        for brk in breaks:
            if brk['start'] > current_time:
                next_break_time = brk['start']
                break
        
        if next_break_time:
            remaining_time = min(remaining_time, (next_break_time - current_time).seconds)
        
        duration = min(duration, remaining_time)
        
        if duration > 0:
            activities.append({
                'app': current_app,
                'title': get_window_title(current_app),
                'duration': duration,
                'timestamp': current_time
            })
            
            current_time += timedelta(seconds=duration)
            
            # Maybe switch app
            switch_probability = min(0.7, avg_switches / 100)
            if random.random() < switch_probability:
                current_app = random.choices(all_apps, weights=app_weights)[0]
    
    return activities

def generate_afk_statuses(work_session, breaks, activities):
    """Generate AFK status events based on work session and breaks."""
    statuses = []
    
    # Start with active
    current_time = work_session['start']
    end_time = work_session['end']
    
    # Build timeline of activities and breaks
    timeline = []
    
    # Add work segments
    work_segments = []
    last_end = work_session['start']
    
    for brk in breaks:
        if brk['start'] > last_end:
            work_segments.append({'start': last_end, 'end': brk['start'], 'type': 'work'})
        work_segments.append({'start': brk['start'], 'end': brk['end'], 'type': brk['type']})
        last_end = brk['end']
    
    if last_end < end_time:
        work_segments.append({'start': last_end, 'end': end_time, 'type': 'work'})
    
    # Generate status events
    for segment in work_segments:
        if segment['type'] == 'work':
            # Active status
            duration = int((segment['end'] - segment['start']).total_seconds())
            if duration > 0:
                statuses.append({
                    'status': 'active',
                    'duration': duration,
                    'timestamp': segment['start']
                })
        elif segment['type'] == 'lunch':
            # AFK status
            duration = int((segment['end'] - segment['start']).total_seconds())
            statuses.append({
                'status': 'afk',
                'duration': duration,
                'timestamp': segment['start']
            })
        else:  # coffee break
            # Idle status (short break)
            duration = int((segment['end'] - segment['start']).total_seconds())
            if duration < 600:  # Less than 10 minutes
                statuses.append({
                    'status': 'idle',
                    'duration': duration,
                    'timestamp': segment['start']
                })
            else:
                statuses.append({
                    'status': 'afk',
                    'duration': duration,
                    'timestamp': segment['start']
                })
    
    return statuses

def aggregate_app_usage(activities):
    """Aggregate window activities into hourly app usage."""
    usage_by_hour_app = {}
    
    for activity in activities:
        hour_key = activity['timestamp'].strftime('%Y-%m-%d %H:00:00')
        app = activity['app']
        key = (hour_key, app)
        
        if key not in usage_by_hour_app:
            usage_by_hour_app[key] = {
                'duration': 0,
                'event_count': 0,
                'timestamp': datetime.strptime(hour_key, '%Y-%m-%d %H:%M:%S')
            }
        
        usage_by_hour_app[key]['duration'] += activity['duration']
        usage_by_hour_app[key]['event_count'] += 1
    
    return usage_by_hour_app

def calculate_daily_metrics(date, afk_statuses, activities):
    """Calculate daily metrics from granular data."""
    active_seconds = sum(s['duration'] for s in afk_statuses if s['status'] == 'active')
    idle_seconds = sum(s['duration'] for s in afk_statuses if s['status'] == 'idle')
    afk_seconds = sum(s['duration'] for s in afk_statuses if s['status'] == 'afk')
    
    total_seconds = active_seconds + idle_seconds + afk_seconds
    utilization_ratio = active_seconds / total_seconds if total_seconds > 0 else 0.0
    
    # Count app switches
    app_switches = 0
    last_app = None
    for activity in activities:
        if last_app and last_app != activity['app']:
            app_switches += 1
        last_app = activity['app']
    
    # Timestamp at end of day
    eod_timestamp = datetime.strptime(f"{date.date()} 23:59:59", '%Y-%m-%d %H:%M:%S')
    
    return {
        'date': date.date(),
        'active_seconds': active_seconds,
        'idle_seconds': idle_seconds,
        'afk_seconds': afk_seconds,
        'app_switches': app_switches,
        'utilization_ratio': round(utilization_ratio, 4),
        'timestamp': eod_timestamp
    }

# ============================================================================
# MAIN DATA GENERATION
# ============================================================================

def generate_all_data(profiles_path):
    """Generate all test data."""
    
    print("Loading user profiles...")
    profiles_data = load_user_profiles(profiles_path)
    users = profiles_data['users']
    date_range = get_date_range(profiles_data['date_range']['start'], 
                                  profiles_data['date_range']['end'])
    
    all_window_activities = []
    all_afk_statuses = []
    all_app_usage = []
    all_daily_metrics = []
    
    print(f"\nGenerating data for {len(users)} users across {len(date_range)} days...")
    
    for user_profile in users:
        username = user_profile['username']
        hostnames = user_profile['hostnames']
        
        print(f"\n  Processing {username}...")
        
        for date in date_range:
            # Select hostname (might work from different machines)
            hostname = random.choice(hostnames)
            
            # Generate work session
            work_session = generate_work_session(user_profile, date, hostname)
            if not work_session:
                continue  # No work this day
            
            # Generate breaks
            breaks = generate_breaks(user_profile, work_session)
            
            # Generate window activities
            activities = generate_window_activities(user_profile, work_session, breaks)
            
            # Generate AFK statuses
            statuses = generate_afk_statuses(work_session, breaks, activities)
            
            # Aggregate app usage
            usage_map = aggregate_app_usage(activities)
            
            # Calculate daily metrics
            daily_metric = calculate_daily_metrics(date, statuses, activities)
            
            # Convert to data objects
            for act in activities:
                all_window_activities.append(WindowActivity(
                    username, hostname, act['app'], act['title'], 
                    act['duration'], act['timestamp']
                ))
            
            for stat in statuses:
                all_afk_statuses.append(AfkStatus(
                    username, hostname, stat['status'], 
                    stat['duration'], stat['timestamp']
                ))
            
            for (hour_str, app), usage in usage_map.items():
                all_app_usage.append(AppUsage(
                    username, hostname, app, usage['duration'],
                    usage['event_count'], usage['timestamp']
                ))
            
            all_daily_metrics.append(DailyMetric(
                username, hostname, daily_metric['date'],
                daily_metric['active_seconds'], daily_metric['idle_seconds'],
                daily_metric['afk_seconds'], daily_metric['app_switches'],
                daily_metric['utilization_ratio'], daily_metric['timestamp']
            ))
    
    print(f"\n✓ Generated:")
    print(f"  - {len(all_window_activities)} window_activity records")
    print(f"  - {len(all_afk_statuses)} afk_status records")
    print(f"  - {len(all_app_usage)} app_usage records")
    print(f"  - {len(all_daily_metrics)} daily_metrics records")
    print(f"  Total: {len(all_window_activities) + len(all_afk_statuses) + len(all_app_usage) + len(all_daily_metrics)} records")
    
    return {
        'window_activities': all_window_activities,
        'afk_statuses': all_afk_statuses,
        'app_usage': all_app_usage,
        'daily_metrics': all_daily_metrics
    }

# ============================================================================
# INFLUXDB LINE PROTOCOL EXPORT
# ============================================================================

def export_to_line_protocol(data, output_dir):
    """Export data to InfluxDB line protocol files."""
    
    print(f"\nExporting to InfluxDB line protocol: {output_dir}/")
    
    # App usage
    with open(f"{output_dir}/app_usage.lp", 'w') as f:
        f.write("""# ============================================================================
# APP_USAGE - Turbo Organization Test Data
# ============================================================================
# Measurement: app_usage
# Date Range: 2025-11-15 to 2025-11-23
# Total Records: {}
# ============================================================================

""".format(len(data['app_usage'])))
        
        for record in data['app_usage']:
            nanos = datetime_to_nanos(record.timestamp)
            app_tag = escape_lp_tag(record.app_name)
            hostname_tag = escape_lp_tag(record.hostname)
            user_tag = escape_lp_tag(record.user)
            
            f.write(f"app_usage,app_name={app_tag},hostname={hostname_tag},user={user_tag},org=Turbo " +
                   f"duration_seconds={record.duration_seconds},event_count={record.event_count}i {nanos}\n")
    
    # AFK status
    with open(f"{output_dir}/afk_status.lp", 'w') as f:
        f.write("""# ============================================================================
# AFK_STATUS - Turbo Organization Test Data
# ============================================================================
# Measurement: afk_status
# Date Range: 2025-11-15 to 2025-11-23
# Total Records: {}
# ============================================================================

""".format(len(data['afk_statuses'])))
        
        for record in data['afk_statuses']:
            nanos = datetime_to_nanos(record.timestamp)
            status_tag = escape_lp_tag(record.status)
            hostname_tag = escape_lp_tag(record.hostname)
            user_tag = escape_lp_tag(record.user)
            
            f.write(f"afk_status,status={status_tag},hostname={hostname_tag},user={user_tag},org=Turbo " +
                   f"duration={record.duration} {nanos}\n")
    
    # Window activity
    with open(f"{output_dir}/window_activity.lp", 'w') as f:
        f.write("""# ============================================================================
# WINDOW_ACTIVITY - Turbo Organization Test Data
# ============================================================================
# Measurement: window_activity
# Date Range: 2025-11-15 to 2025-11-23
# Total Records: {}
# ============================================================================

""".format(len(data['window_activities'])))
        
        for record in data['window_activities']:
            nanos = datetime_to_nanos(record.timestamp)
            app_tag = escape_lp_tag(record.app)
            hostname_tag = escape_lp_tag(record.hostname)
            user_tag = escape_lp_tag(record.user)
            title_field = escape_lp_string(record.title)
            
            f.write(f"window_activity,app={app_tag},hostname={hostname_tag},user={user_tag},org=Turbo " +
                   f"title={title_field},duration={record.duration} {nanos}\n")
    
    # Daily metrics
    with open(f"{output_dir}/daily_metrics.lp", 'w') as f:
        f.write("""# ============================================================================
# DAILY_METRICS - Turbo Organization Test Data
# ============================================================================
# Measurement: daily_metrics
# Date Range: 2025-11-15 to 2025-11-23
# Total Records: {}
# ============================================================================

""".format(len(data['daily_metrics'])))
        
        for record in data['daily_metrics']:
            nanos = datetime_to_nanos(record.timestamp)
            date_tag = escape_lp_tag(str(record.date))
            hostname_tag = escape_lp_tag(record.hostname)
            user_tag = escape_lp_tag(record.user)
            
            f.write(f"daily_metrics,date={date_tag},hostname={hostname_tag},user={user_tag},org=Turbo " +
                   f"active_seconds={record.active_seconds},idle_seconds={record.idle_seconds}," +
                   f"afk_seconds={record.afk_seconds},utilization_ratio={record.utilization_ratio}," +
                   f"app_switches={record.app_switches}i {nanos}\n")
    
    print(f"✓ Line protocol export complete")

# ============================================================================
# MANIFEST EXPORT
# ============================================================================

def export_manifest(data, output_path):
    """Export data generation manifest."""
    
    manifest = {
        "generated_at": datetime.now().isoformat(),
        "organization": "Turbo",
        "date_range": {
            "start": "2025-11-15",
            "end": "2025-11-23",
            "total_days": 9
        },
        "record_counts": {
            "window_activity": len(data['window_activities']),
            "afk_status": len(data['afk_statuses']),
            "app_usage": len(data['app_usage']),
            "daily_metrics": len(data['daily_metrics']),
            "total": sum([
                len(data['window_activities']),
                len(data['afk_statuses']),
                len(data['app_usage']),
                len(data['daily_metrics'])
            ])
        },
        "users": 8,
        "formats": ["influxdb_line_protocol"]
    }
    
    with open(output_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    print(f"✓ Manifest exported: {output_path}")

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    profiles_path = os.path.join(script_dir, 'metadata', 'user_profiles.json')
    lp_output_dir = os.path.join(script_dir, 'influxdb')
    manifest_output = os.path.join(script_dir, 'metadata', 'data_manifest.json')
    
    print("=" * 80)
    print("TURBO ORGANIZATION TEST DATA GENERATOR")
    print("=" * 80)
    
    # Generate all data
    data = generate_all_data(profiles_path)
    
    # Export to line protocol
    export_to_line_protocol(data, lp_output_dir)
    
    # Export manifest
    export_manifest(data, manifest_output)
    
    print("\n" + "=" * 80)
    print("✓ DATA GENERATION COMPLETE")
    print("=" * 80)
    print(f"\nOutput files:")
    print(f"  - {lp_output_dir}/app_usage.lp")
    print(f"  - {lp_output_dir}/afk_status.lp")
    print(f"  - {lp_output_dir}/window_activity.lp")
    print(f"  - {lp_output_dir}/daily_metrics.lp")
    print(f"  - {manifest_output}")
    print()

