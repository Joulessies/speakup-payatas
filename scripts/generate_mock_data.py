"""
Generate an expanded, realistic 30-day mock dataset for SpeakUp Payatas.
Adds 50+ reports spread across 30 days with realistic patterns:
  - More reports on weekdays, fewer on weekends
  - Category distribution mirrors real Payatas incident patterns
  - Drainage/flooding spikes during "rainy" days
  - Realistic Tagalog/English descriptions
  - Proper ai_category and admin_category for accuracy evaluation
"""

import json
import os
import random
import uuid
import hashlib
from datetime import datetime, timedelta

random.seed(42)  # Reproducible results

# ── Configuration ──
BASE_DATE = datetime(2026, 9, 15, 0, 0, 0)  # 30 days before Oct 15
TOTAL_DAYS = 30
TARGET_REPORTS = 60

# ── Payatas Areas ──
AREAS = [
    ("Lupang Pangako", 14.7088, 121.1072),
    ("Phase 1, Payatas A", 14.7079, 121.0964),
    ("Phase 2, Payatas B", 14.7062, 121.1018),
    ("Phase 3, Payatas A", 14.7045, 121.0985),
    ("Phase 4, Payatas B", 14.7022, 121.1052),
    ("Sitio Damayan", 14.6942, 121.1022),
    ("Sitio Bakal", 14.7182, 121.1012),
    ("Group Two", 14.6972, 121.0942),
    ("Payatas Central", 14.7055, 121.0990),
    ("Sitio Silangan", 14.7010, 121.1040),
    ("Sitio Bagong Silang", 14.7035, 121.0975),
    ("Bagong Pag-asa", 14.6995, 121.1005),
]

# ── Report Templates ──
# (category, description_tagalog, severity_range, admin_agrees_pct)
# admin_agrees_pct = chance that admin_category matches ai_category (simulates real accuracy)
TEMPLATES = {
    "drainage_flooding": [
        ("Bumabaha sa kalsada, halos tuhod na ang tubig. Barado ang drainage sa kanto.", (3, 5)),
        ("Hindi humuhupa ang baha dito sa harap ng chapel, may mga lumulutang na basura.", (3, 4)),
        ("Barado ang kanal, kapag umuulan ay mabilis bumaha at pumapasok sa mga bahay.", (4, 5)),
        ("Tubig-baha sa eskinita, hindi makadaan ang mga bata papuntang eskwelahan.", (3, 4)),
        ("Nag-overflow ang drainage sa may basketball court dahil sa mga nakaharang na basura.", (3, 5)),
        ("Malala ang pagbaha tuwing may malakas na ulan, lubog ang mga sasakyan.", (4, 5)),
        ("May stagnant water na ilang araw na sa tabi ng kalsada, nag-aalala sa dengue.", (2, 3)),
    ],
    "fire_hazard": [
        ("May nag-i-spark na exposed wire sa poste malapit sa sari-sari store. Delikado kapag umuulan.", (4, 5)),
        ("Nakita namin na lumalawit ang kawad ng kuryente sa daan, mapanganib sa mga bata.", (4, 5)),
        ("May usok na lumalabas sa isang bahay, mukhang may sira sa electrical wiring.", (3, 5)),
        ("Broken na ang junction box sa poste, may sparking kapag gabi.", (3, 4)),
        ("LPG tank na walang proper ventilation sa tindahan, malapit sa mga bahay.", (3, 4)),
    ],
    "safety_concern": [
        ("Mga kabataang nag-aaway at nagbabatuhan ng bote sa eskinita tuwing gabi.", (2, 4)),
        ("May suspicious na grupo ng lalaki na nag-iikot-ikot sa madaling araw.", (2, 3)),
        ("Nagnakaw ng motorsiklo sa harap ng bahay kagabi, wala pang aksyon.", (3, 4)),
        ("May mga tambay na nanggugulo ng mga dumadaan, lalo na sa gabi.", (2, 3)),
        ("Aksidente sa kalsada dahil sa madilim na eskinita at walang ilaw.", (3, 4)),
    ],
    "infrastructure": [
        ("Malaking lubak sa gitna ng daan, nadisgrasya na ang motor kagabi.", (3, 5)),
        ("Sira ang streetlight sa buong bloke, sobrang dilim sa gabi.", (2, 3)),
        ("Gumuho ang retaining wall sa gilid ng daan, delikadong daanan.", (4, 5)),
        ("Pothole na sobrang laki, nakakasira ng gulong ng mga tricycle.", (3, 4)),
        ("Broken ang railing ng tulay, mapanganib lalo na sa mga bata.", (3, 4)),
        ("Nawasak ang sidewalk tiles, nakakapinsala sa mga naglalakad.", (2, 3)),
    ],
    "sanitation_health": [
        ("Hindi nakokolekta ang basura sa harap ng basketball court, dumadami na ang daga.", (2, 4)),
        ("Mabaho ang buong eskinita dahil sa tambak na basura, may mga langaw na rin.", (2, 3)),
        ("Maraming lamok sa area, nag-aalala sa dengue ang mga residente.", (3, 4)),
        ("May garbage dump na hindi kinokolekta ng tatlong linggo, grabe ang amoy.", (3, 4)),
        ("Nakita ang daga sa tabi ng tindahan ng pagkain, health hazard.", (2, 3)),
    ],
    "environmental": [
        ("May nagtatapon ng construction waste malapit sa creek, maaaring magbara.", (2, 4)),
        ("Polusyon mula sa nasusunog na basura sa likod ng subdivision.", (2, 3)),
        ("Erosion sa gilid ng creek, baka gumuho ang lupa kapag umulan.", (3, 4)),
        ("Chemical spill sa kalsada galing sa isang truck, mabaho at mapanganib.", (3, 5)),
    ],
    "noise_nuisance": [
        ("Sobrang lakas ng videoke hanggang alas-dos, hindi makatulog ang buong bloke.", (1, 3)),
        ("Construction work na nag-uumpisa ng alas-singko ng umaga, tuwing araw.", (1, 2)),
        ("Maingay na generator ng tindahan, buong gabi gumagana.", (1, 2)),
        ("Party na walang tigil, loud music hanggang madaling araw tuwing weekend.", (1, 3)),
    ],
}

# Misclassification templates — descriptions that could trick the AI classifier
# These simulate edge cases where the AI might get it wrong
TRICKY_TEMPLATES = [
    # Description sounds like fire_hazard but is actually infrastructure
    ("infrastructure", "fire_hazard", "Sira ang poste ng ilaw sa kalsada, kailangan ng repair. Hindi na gumagana.", (2, 3)),
    # Description sounds like drainage but is actually environmental
    ("environmental", "drainage_flooding", "May dumadaloy na maruming tubig sa creek galing sa factory, polusyon ito.", (3, 4)),
    # Description sounds like sanitation but is actually environmental
    ("environmental", "sanitation_health", "Nagtatapon ng basura sa gilid ng ilog, nagdudulot ng polusyon sa tubig.", (2, 3)),
    # Description sounds like safety but is actually noise
    ("noise_nuisance", "safety_concern", "Gulo tuwing gabi dahil sa ingay ng videoke at away ng mga lasing.", (2, 3)),
    # Description sounds like infrastructure but is actually safety
    ("safety_concern", "infrastructure", "Aksidente sa lubak na daan, sugatan ang sakay ng motor.", (3, 4)),
]


def generate_hash():
    return hashlib.sha256(uuid.uuid4().bytes).hexdigest()


def generate_reports():
    reports = []
    receipt_counter = 1924  # Continue from existing mock data
    
    # Distribute reports across 30 days with realistic patterns
    daily_distribution = []
    for day_offset in range(TOTAL_DAYS):
        d = BASE_DATE + timedelta(days=day_offset)
        weekday = d.weekday()  # 0=Mon, 6=Sun
        
        # Base reports per day: more on weekdays, fewer weekends
        if weekday < 5:
            base = random.randint(1, 4)
        else:
            base = random.randint(0, 2)
        
        # Simulate rainy days (more flooding reports)
        is_rainy = random.random() < 0.3
        if is_rainy:
            base += random.randint(1, 3)
        
        daily_distribution.append((d, base, is_rainy))
    
    # Generate reports for each day
    for day_date, num_reports, is_rainy in daily_distribution:
        for _ in range(num_reports):
            receipt_counter += 1
            
            # Choose category (weighted distribution)
            if is_rainy and random.random() < 0.5:
                category = "drainage_flooding"
            else:
                category = random.choices(
                    list(TEMPLATES.keys()),
                    weights=[25, 12, 10, 18, 15, 8, 12],
                    k=1
                )[0]
            
            # Choose template
            template = random.choice(TEMPLATES[category])
            description = template[0]
            severity_min, severity_max = template[1]
            severity = random.randint(severity_min, severity_max)
            
            # Choose area
            area_name, base_lat, base_lng = random.choice(AREAS)
            # Add slight GPS jitter
            lat = base_lat + random.uniform(-0.001, 0.001)
            lng = base_lng + random.uniform(-0.001, 0.001)
            
            # Generate time within the day
            hour = random.choice([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21])
            minute = random.randint(0, 59)
            created_at = day_date.replace(hour=hour, minute=minute)
            
            ai_category = classify_simple(description)
            
            admin_category = category
            
            # Determine status
            days_ago = (datetime(2026, 10, 15) - created_at).days
            if days_ago > 10:
                status = random.choice(["resolved", "resolved", "resolved", "in_progress"])
                verification_status = "valid"
            elif days_ago > 5:
                status = random.choice(["in_progress", "verified", "resolved"])
                verification_status = "valid"
            elif days_ago > 2:
                status = random.choice(["pending", "verified", "in_progress"])
                verification_status = random.choice(["valid", "unreviewed"])
            else:
                status = "pending"
                verification_status = "unreviewed"
            
            report = {
                "id": str(uuid.uuid4()),
                "receipt_id": f"SPK-PAY-{receipt_counter:05d}",
                "reporter_hash": generate_hash(),
                "category": category,
                "ai_category": ai_category,
                "admin_category": admin_category if verification_status == "valid" else None,
                "description": description,
                "area": area_name,
                "latitude": round(lat, 4),
                "longitude": round(lng, 4),
                "severity": severity,
                "status": status,
                "verification_status": verification_status,
                "verified_by": "staff@speakup.local" if verification_status == "valid" else None,
                "verified_at": (created_at + timedelta(hours=random.randint(1, 24))).strftime("%Y-%m-%dT%H:%M:%S.000Z") if verification_status == "valid" else None,
                "is_flagged": False,
                "flag_reason": None,
                "photo_url": None,
                "confirmations_count": random.randint(0, 12),
                "created_at": created_at.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                "submitted_at": created_at.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                "action_history": [
                    {
                        "id": f"act-{receipt_counter:05d}-001",
                        "status": "pending",
                        "note": "Report submitted by resident.",
                        "actor": "Resident",
                        "created_at": created_at.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                    }
                ],
            }
            
            reports.append(report)
    
    # Add tricky edge cases (for testing misclassification detection)
    for actual_cat, expected_ai_cat, desc, sev_range in TRICKY_TEMPLATES:
        receipt_counter += 1
        day_offset = random.randint(5, 25)
        day_date = BASE_DATE + timedelta(days=day_offset)
        hour = random.randint(8, 20)
        created_at = day_date.replace(hour=hour, minute=random.randint(0, 59))
        
        area_name, base_lat, base_lng = random.choice(AREAS)
        
        report = {
            "id": str(uuid.uuid4()),
            "receipt_id": f"SPK-PAY-{receipt_counter:05d}",
            "reporter_hash": generate_hash(),
            "category": actual_cat,
            "ai_category": expected_ai_cat,  # AI gets this wrong
            "admin_category": actual_cat,     # Admin corrects it
            "description": desc,
            "area": area_name,
            "latitude": round(base_lat + random.uniform(-0.001, 0.001), 4),
            "longitude": round(base_lng + random.uniform(-0.001, 0.001), 4),
            "severity": random.randint(sev_range[0], sev_range[1]),
            "status": "verified",
            "verification_status": "valid",
            "verified_by": "staff@speakup.local",
            "verified_at": (created_at + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "is_flagged": False,
            "flag_reason": None,
            "photo_url": None,
            "confirmations_count": random.randint(1, 8),
            "created_at": created_at.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "submitted_at": created_at.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "action_history": [
                {
                    "id": f"act-{receipt_counter:05d}-001",
                    "status": "pending",
                    "note": "Report submitted by resident.",
                    "actor": "Resident",
                    "created_at": created_at.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                }
            ],
        }
        reports.append(report)
    
    # Sort by created_at
    reports.sort(key=lambda r: r["created_at"])
    return reports


def classify_simple(description):
    """Simplified version of the NLP classifier for data generation."""
    import re
    CATS = {
        "drainage_flooding": ["flood", "flooding", "baha", "bumabaha", "lubog", "tubig", "drainage", "kanal", "clogged", "barado", "estero"],
        "fire_hazard": ["fire", "sunog", "spark", "sparking", "usok", "smoke", "wire", "kuryente", "electrical", "poste", "lpg", "gas"],
        "safety_concern": ["crime", "krimen", "magnanakaw", "robbery", "theft", "snatcher", "suspicious", "kahina-hinala", "away", "fight", "tambay", "gulo", "accident", "aksidente"],
        "infrastructure": ["road", "daan", "kalsada", "pothole", "lubak", "sira", "broken", "bridge", "tulay", "light", "ilaw", "poste", "crack", "collapsed"],
        "sanitation_health": ["dengue", "disease", "sakit", "health", "kalusugan", "garbage", "basura", "kalat", "smell", "mabaho", "rat", "daga", "lamok"],
        "environmental": ["pollution", "polusyon", "tree", "puno", "landslide", "guho", "erosion", "burn", "sunog basura", "chemical", "spill"],
        "noise_nuisance": ["noise", "ingay", "maingay", "loud", "music", "karaoke", "videoke", "party", "construction", "gabi", "disturbance"],
    }
    text = description.lower()
    best = "other"
    max_m = 0
    for cat, kws in CATS.items():
        m = 0
        for kw in kws:
            if re.search(rf'\b{re.escape(kw)}\b', text, re.IGNORECASE):
                m += 1
            elif len(kw) > 4 and kw in text:
                m += 0.5
        if m > max_m:
            max_m = m
            best = cat
    return best if max_m >= 1 else "other"


def main():
    reports = generate_reports()
    
    # Load existing file to preserve structure
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "mock-reports.json")
    data_path = os.path.abspath(data_path)
    
    with open(data_path, "r", encoding="utf-8") as f:
        existing = json.load(f)
    
    # Merge: keep original reports + add new ones
    original_reports = existing.get("reports", [])
    all_reports = original_reports + reports
    
    # Update metadata
    existing["metadata"]["total_reports"] = len(all_reports)
    existing["metadata"]["description"] = (
        "Comprehensive mock data for testing incident reporting, staff verification, "
        "tracking, analytics, and accuracy evaluation across Barangay Payatas-A and Payatas-B. "
        f"Contains {len(original_reports)} original + {len(reports)} generated reports over 30 days."
    )
    existing["reports"] = all_reports
    
    # Save
    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Generated {len(reports)} new reports")
    print(f"✓ Total reports: {len(all_reports)} ({len(original_reports)} original + {len(reports)} new)")
    print(f"✓ Date range: {reports[0]['created_at'][:10]} to {reports[-1]['created_at'][:10]}")
    print(f"✓ Saved to: {data_path}")
    
    # Stats
    cats = {}
    for r in reports:
        c = r["category"]
        cats[c] = cats.get(c, 0) + 1
    
    print("\n  Category Distribution:")
    for cat, count in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"    {cat:<22} {count:>3} reports")
    
    verified = sum(1 for r in reports if r.get("admin_category"))
    mismatched = sum(1 for r in reports if r.get("admin_category") and r.get("ai_category") != r.get("admin_category"))
    print(f"\n  Admin-verified: {verified}")
    print(f"  AI misclassified: {mismatched}")


if __name__ == "__main__":
    main()
