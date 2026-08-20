"""Quick API test script."""
import urllib.request
import json

def get(path):
    r = urllib.request.urlopen(f"http://localhost:5000/api/{path}")
    return json.loads(r.read())

# Test stats
print("=== CATALOG STATS ===")
stats = get("satellites/stats")
print(f"  Total objects: {stats['total']}")
print(f"  By type: {stats['by_type']}")
print(f"  By group: {stats['by_group']}")

# Test ISS lookup
print("\n=== ISS (NORAD 25544) ===")
try:
    iss = get("satellites/25544")
    print(f"  Name: {iss['name']}")
    print(f"  Inclination: {iss['inclination_deg']}°")
    print(f"  Period: {iss['period_min']} min")
    print(f"  Apogee: {iss['apogee_km']} km")
    print(f"  Perigee: {iss['perigee_km']} km")
except Exception as e:
    print(f"  Error: {e}")

# Test positions (stations only - small set)
print("\n=== STATION POSITIONS ===")
try:
    pos = get("positions?group=stations")
    print(f"  Count: {pos['count']}")
    for p in pos["positions"]:
        print(f"  {p['name']}: lat={p['latitude']}, lon={p['longitude']}, alt={p['altitude_km']}km, speed={p['speed_km_s']}km/s")
except Exception as e:
    print(f"  Error: {e}")

# Test conjunctions
print("\n=== CONJUNCTIONS ===")
try:
    conj = get("conjunctions")
    print(f"  Active events: {conj['count']}")
    for c in conj["conjunctions"][:5]:
        print(f"  {c['object1_name']} <-> {c['object2_name']}: {c['miss_distance_km']}km, risk={c['risk_score']}")
except Exception as e:
    print(f"  Error: {e}")

# Test alerts
print("\n=== ALERTS ===")
try:
    alerts = get("conjunctions/alerts")
    print(f"  High-risk alerts: {alerts['count']}")
except Exception as e:
    print(f"  Error: {e}")

print("\n=== ALL TESTS COMPLETE ===")
