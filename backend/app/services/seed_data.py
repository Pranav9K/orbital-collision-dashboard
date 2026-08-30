"""Comprehensive seed catalog dataset for initial startup and offline fallback."""

from datetime import datetime, timezone
import math


def _tle_checksum(line: str) -> int:
    """Compute standard TLE line checksum (mod 10 of sum of digits, '-' counts as 1)."""
    s = 0
    for ch in line[:68]:
        if ch.isdigit():
            s += int(ch)
        elif ch == "-":
            s += 1
    return s % 10


def _build_tle(norad_id: int, intl_des: str, incl: float, raan: float, ecc: float,
               argp: float, ma: float, mm: float, bstar: float = 0.0001, epoch_day: float = 60.25) -> tuple[str, str]:
    """Helper to construct valid TLE pair with checksum."""
    des_clean = (intl_des.replace("-", "") + "   ")[:8]
    # Line 1
    l1 = f"1 {norad_id:05d}U {des_clean} 26{epoch_day:012.8f}  .00002150  00000-0  {int(bstar*1e5):05d}-3 0  999"
    l1 = l1[:68]
    l1 = f"{l1}{_tle_checksum(l1)}"
    
    # Line 2
    ecc_str = f"{ecc:.7f}"[2:9]
    l2 = f"2 {norad_id:05d} {incl:8.4f} {raan:8.4f} {ecc_str} {argp:8.4f} {ma:8.4f} {mm:11.8f}01000"
    l2 = l2[:68]
    l2 = f"{l2}{_tle_checksum(l2)}"
    return l1, l2


def _make_sat(norad_id: int, name: str, intl_des: str, obj_type: str, group: str,
              incl: float, raan: float, ecc: float, argp: float, ma: float, mm: float,
              rcs: str = "MEDIUM", bstar: float = 0.0001, epoch_day: float = 60.25) -> dict:
    l1, l2 = _build_tle(norad_id, intl_des, incl, raan, ecc, argp, ma, mm, bstar, epoch_day)
    mu = 398600.4418
    n = mm * 2.0 * math.pi / 86400.0
    a = (mu / (n * n)) ** (1.0 / 3.0)
    apogee = round(a * (1 + ecc) - 6371.0, 1)
    perigee = round(a * (1 - ecc) - 6371.0, 1)
    period = round(1440.0 / mm, 1)
    
    return {
        "norad_id": norad_id,
        "name": name,
        "intl_designator": intl_des,
        "object_type": obj_type,
        "group_name": group,
        "tle_line1": l1,
        "tle_line2": l2,
        "inclination_deg": incl,
        "eccentricity": ecc,
        "period_min": period,
        "apogee_km": apogee,
        "perigee_km": perigee,
        "raan_deg": raan,
        "arg_perigee_deg": argp,
        "mean_anomaly_deg": ma,
        "mean_motion": mm,
        "rcs_size": rcs,
    }


def generate_seed_catalog() -> list[dict]:
    """Generates a rich, diverse catalog of 130+ orbital objects."""
    sats = []

    # 1. Space Stations (Protected high-value targets)
    sats.append(_make_sat(25544, "ISS (ZARYA)", "1998-067A", "PAYLOAD", "stations", 51.6416, 247.4627, 0.0006703, 130.5360, 325.0288, 15.49815306, "LARGE", 0.0001027, 60.54848380))
    sats.append(_make_sat(48274, "CSS (TIANHE)", "2021-035A", "PAYLOAD", "stations", 41.4721, 168.3241, 0.0004128, 85.2314, 274.9125, 15.61245100, "LARGE", 0.0002134, 60.48512731))

    # 2. Major Earth Observation & Science (LEO / SSO)
    science_sats = [
        (20580, "HST (HUBBLE)", "1990-037B", 28.4690, 115.3421, 0.0002845, 290.1245, 69.8712, 15.09245120, "LARGE"),
        (25994, "TERRA", "1999-068A", 98.2045, 78.4312, 0.0001421, 74.3210, 285.8190, 14.57112450, "LARGE"),
        (27424, "AQUA", "2002-022A", 98.2150, 82.1245, 0.0001540, 68.4120, 291.7340, 14.57124510, "LARGE"),
        (27386, "ENVISAT", "2002-009A", 98.5412, 102.3412, 0.0001120, 110.4120, 249.7120, 14.37124500, "LARGE"),
        (39084, "LANDSAT 8", "2013-008A", 98.2120, 95.4120, 0.0001350, 80.1240, 280.0120, 14.57110000, "LARGE"),
        (49260, "LANDSAT 9", "2021-088A", 98.2110, 97.8120, 0.0001380, 82.4120, 277.6120, 14.57111000, "LARGE"),
        (39634, "SENTINEL-1A", "2014-016A", 98.1812, 110.2314, 0.0001280, 90.4120, 269.7120, 14.59214500, "LARGE"),
        (40697, "SENTINEL-2A", "2015-028A", 98.5714, 125.4120, 0.0001150, 102.1240, 258.0120, 14.30812400, "LARGE"),
        (42063, "SENTINEL-2B", "2017-013A", 98.5720, 129.8120, 0.0001160, 104.5120, 255.6120, 14.30813000, "LARGE"),
        (41335, "SENTINEL-3A", "2016-011A", 98.6310, 135.4120, 0.0001080, 112.4120, 247.7120, 14.26124500, "LARGE"),
        (42969, "SENTINEL-5P", "2017-064A", 98.7120, 140.8120, 0.0001220, 118.1240, 242.0120, 14.19512400, "LARGE"),
        (43013, "NOAA 20 (JPSS-1)", "2017-073A", 98.7412, 145.2145, 0.0001400, 122.4120, 237.7120, 14.19524000, "LARGE"),
        (54234, "NOAA 21 (JPSS-2)", "2022-150A", 98.7420, 148.5120, 0.0001420, 125.1240, 235.0120, 14.19525000, "LARGE"),
        (37849, "SUOMI NPP", "2011-061A", 98.7012, 142.1240, 0.0001350, 120.4120, 239.7120, 14.19518000, "LARGE"),
        (43689, "ICESAT-2", "2018-070A", 92.0120, 160.4120, 0.0001150, 135.1240, 224.9120, 15.19245000, "LARGE"),
        (40376, "SMAP", "2015-003A", 98.1240, 105.4120, 0.0001250, 95.1240, 264.9120, 14.61245000, "LARGE"),
        (54754, "SWOT", "2022-173A", 77.6120, 175.4120, 0.0001550, 145.1240, 214.9120, 14.41245000, "LARGE"),
    ]
    for norad, name, des, incl, raan, ecc, argp, ma, mm, rcs in science_sats:
        sats.append(_make_sat(norad, name, des, "PAYLOAD", "visual", incl, raan, ecc, argp, ma, mm, rcs))

    # 3. Starlink Constellation Satellites (LEO ~550 km, incl ~53°)
    for i in range(1, 25):
        norad = 44700 + i
        name = f"STARLINK-{1000 + i}"
        des = f"2019-074{chr(64 + (i % 26))}"
        raan = (210.0 + i * 5.4) % 360.0
        ma = (80.0 + i * 14.2) % 360.0
        sats.append(_make_sat(norad, name, des, "PAYLOAD", "visual", 53.05 + (i * 0.01 % 0.1), raan, 0.00014 + (i * 1e-6), 88.0 + (i * 1.5), ma, 15.064 + (i * 1e-5), "MEDIUM"))

    # 4. OneWeb Constellation (LEO ~1200 km, polar incl ~87.4°)
    for i in range(1, 15):
        norad = 45100 + i
        name = f"ONEWEB-{i:04d}"
        des = f"2020-008{chr(64 + (i % 26))}"
        raan = (45.0 + i * 24.0) % 360.0
        ma = (30.0 + i * 25.0) % 360.0
        sats.append(_make_sat(norad, name, des, "PAYLOAD", "visual", 87.4 + (i * 0.02), raan, 0.00018, 95.0 + i, ma, 13.102, "MEDIUM"))

    # 5. GPS Navigation Constellation (MEO ~20,200 km, 12h orbit, incl ~55°)
    gps_sats = [
        (36585, "GPS BIIF-1 (PRN 25)", "2010-022A", 55.45, 142.12, 0.0054, 180.41, 179.61),
        (37753, "GPS BIIF-2 (PRN 01)", "2011-036A", 55.32, 202.41, 0.0048, 195.12, 164.81),
        (38833, "GPS BIIF-3 (PRN 24)", "2012-053A", 55.21, 262.15, 0.0051, 210.45, 149.55),
        (39166, "GPS BIIF-4 (PRN 27)", "2013-023A", 55.15, 322.80, 0.0049, 225.10, 134.90),
        (39533, "GPS BIIF-5 (PRN 30)", "2014-008A", 55.38, 22.40, 0.0052, 240.80, 119.20),
        (40105, "GPS BIIF-6 (PRN 06)", "2014-026A", 55.42, 82.90, 0.0050, 255.40, 104.60),
        (40294, "GPS BIIF-7 (PRN 09)", "2014-045A", 55.28, 142.60, 0.0047, 270.10, 89.90),
        (40534, "GPS BIIF-8 (PRN 03)", "2015-013A", 55.35, 203.10, 0.0053, 285.60, 74.40),
        (41019, "GPS BIIF-9 (PRN 10)", "2015-062A", 55.40, 263.50, 0.0049, 300.20, 59.80),
        (41328, "GPS BIIF-10 (PRN 32)", "2016-007A", 55.25, 323.90, 0.0051, 315.80, 44.20),
    ]
    for norad, name, des, incl, raan, ecc, argp, ma in gps_sats:
        sats.append(_make_sat(norad, name, des, "PAYLOAD", "visual", incl, raan, ecc, argp, ma, 2.0056, "LARGE"))

    # 6. Galileo & GLONASS (MEO Navigation)
    meo_sats = [
        (37846, "GALILEO 1 (GSAT0101)", "2011-060A", 56.02, 120.40, 0.0002, 120.0, 240.0, 1.7047),
        (37847, "GALILEO 2 (GSAT0102)", "2011-060B", 56.04, 120.80, 0.0002, 122.0, 238.0, 1.7047),
        (38857, "GALILEO 3 (GSAT0103)", "2012-055A", 56.00, 240.20, 0.0003, 140.0, 220.0, 1.7047),
        (38858, "GALILEO 4 (GSAT0104)", "2012-055B", 56.01, 240.60, 0.0002, 142.0, 218.0, 1.7047),
        (37137, "COSMOS 2469 (GLONASS)", "2010-048A", 64.80, 150.00, 0.0012, 190.0, 170.0, 2.1310),
        (37138, "COSMOS 2470 (GLONASS)", "2010-048B", 64.82, 150.40, 0.0011, 192.0, 168.0, 2.1310),
        (37139, "COSMOS 2471 (GLONASS)", "2010-048C", 64.81, 150.80, 0.0013, 194.0, 166.0, 2.1310),
    ]
    for norad, name, des, incl, raan, ecc, argp, ma, mm in meo_sats:
        sats.append(_make_sat(norad, name, des, "PAYLOAD", "visual", incl, raan, ecc, argp, ma, mm, "LARGE"))

    # 7. Geostationary Satellites (GEO ~35,786 km, 24h orbit)
    geo_sats = [
        (41866, "GOES 16", "2016-071A", 0.04, 75.2, 0.0001, 50.0, 120.0, 1.0027),
        (43226, "GOES 17", "2018-022A", 0.05, 137.2, 0.0001, 60.0, 110.0, 1.0027),
        (51850, "GOES 18", "2022-021A", 0.03, 137.0, 0.0001, 65.0, 105.0, 1.0027),
        (40940, "METEOSAT-11 (MSG-4)", "2015-034A", 1.20, 0.0, 0.0002, 80.0, 90.0, 1.0027),
        (40267, "HIMAWARI-8", "2014-060A", 0.08, 140.7, 0.0001, 70.0, 100.0, 1.0027),
        (39234, "INSAT-3D", "2013-038B", 0.12, 82.0, 0.0002, 90.0, 80.0, 1.0027),
    ]
    for norad, name, des, incl, raan, ecc, argp, ma, mm in geo_sats:
        sats.append(_make_sat(norad, name, des, "PAYLOAD", "visual", incl, raan, ecc, argp, ma, mm, "LARGE"))

    # 8. Cosmos 1408 ASAT Debris Cloud (1982-092 Debris, 420-520 km)
    for i in range(1, 26):
        norad = 49500 + i
        name = f"COSMOS 1408 DEB ({chr(64 + i)})"
        des = f"1982-092{chr(64 + i)}"
        raan = (190.0 + i * 1.8) % 360.0
        ma = (140.0 + i * 8.5) % 360.0
        ecc = 0.0035 + (i * 0.0002)
        mm = 15.42 + (i * 0.008)
        sats.append(_make_sat(norad, name, des, "DEBRIS", "1982-092", 82.56 + (i * 0.02), raan, ecc, 210.0 + i, ma, mm, "SMALL"))

    # 9. Direct Close-Approach Conjunction Hazards (Pair engineered to generate close approaches with ISS / Satellites)
    # ISS hazard piece
    sats.append(_make_sat(49550, "COSMOS 1408 DEB (ISS CONJUNCTION)", "1982-092ZZ", "DEBRIS", "1982-092", 51.6420, 247.4700, 0.0006900, 130.6000, 325.0400, 15.49818000, "MEDIUM", 0.0001030, 60.54848380))
    # Hubble hazard piece
    sats.append(_make_sat(49551, "CZ-2D DEB (HST CONJUNCTION)", "2013-066C", "DEBRIS", "visual", 28.4710, 115.3480, 0.0002900, 290.1500, 69.8800, 15.09246000, "SMALL", 0.0000450, 60.31250000))
    # Starlink hazard piece
    sats.append(_make_sat(49552, "SL-8 DEB (STARLINK CONJUNCTION)", "1982-045C", "DEBRIS", "visual", 53.0550, 210.4580, 0.0001480, 88.1300, 272.0200, 15.06413500, "SMALL", 0.0000350, 60.25000000))

    # 10. Fengyun-1C & Iridium 33 Debris
    for i in range(1, 12):
        norad = 31110 + i
        name = f"FENGYUN 1C DEB #{i}"
        des = f"2007-006{chr(64 + i)}"
        sats.append(_make_sat(norad, name, des, "DEBRIS", "visual", 98.70 + (i * 0.03), 150.0 + (i * 3.5), 0.012 + (i * 0.0005), 140.0 + i, 220.0 + (i * 12), 14.125 + (i * 0.004), "SMALL"))

    for i in range(1, 10):
        norad = 33770 + i
        name = f"IRIDIUM 33 DEB #{i}"
        des = f"1997-051{chr(64 + i)}"
        sats.append(_make_sat(norad, name, des, "DEBRIS", "visual", 86.40 + (i * 0.02), 175.0 + (i * 4.0), 0.008 + (i * 0.0004), 160.0 + i, 200.0 + (i * 15), 14.320 + (i * 0.005), "SMALL"))

    # 11. Rocket Bodies (Derelict Upper Stages)
    rocket_bodies = [
        (13245, "SL-8 R/B", "1982-045B", 82.95, 130.41, 0.0112, 170.12, 190.41, 14.215),
        (22676, "SL-16 R/B", "1993-036B", 71.01, 110.41, 0.0085, 185.12, 175.41, 14.254),
        (39480, "CZ-2D R/B", "2013-066B", 97.85, 90.41, 0.0054, 190.12, 170.41, 14.612),
        (40968, "ATLAS 5 CENTAUR R/B", "2015-056B", 28.15, 80.20, 0.0045, 165.40, 195.20, 14.850),
        (44715, "FALCON 9 R/B", "2019-074C", 53.04, 211.45, 0.0012, 95.41, 264.81, 15.112),
        (41945, "H-2A R/B", "2017-005B", 31.90, 70.10, 0.0062, 150.10, 210.50, 14.720),
        (42740, "ARIANE 5 R/B", "2017-030B", 6.80, 50.40, 0.5800, 180.00, 180.00, 2.310),
        (38345, "PSLV R/B", "2012-021B", 98.20, 85.10, 0.0035, 175.20, 185.40, 14.580),
        (44390, "GSLV R/B", "2019-042B", 19.20, 65.40, 0.6200, 195.00, 165.00, 2.240),
        (37790, "DELTA 4 R/B", "2011-041B", 55.30, 190.20, 0.0050, 180.00, 180.00, 2.005),
    ]
    for norad, name, des, incl, raan, ecc, argp, ma, mm in rocket_bodies:
        sats.append(_make_sat(norad, name, des, "ROCKET BODY", "visual", incl, raan, ecc, argp, ma, mm, "LARGE"))

    return sats


# Pre-calculated seed list
SEED_SATELLITES = generate_seed_catalog()


def get_seed_satellites() -> list[dict]:
    """Return a list of seed satellite records with calculated epochs."""
    now = datetime.now(timezone.utc)
    records = []
    for s in SEED_SATELLITES:
        rec = dict(s)
        rec["epoch"] = now
        records.append(rec)
    return records
