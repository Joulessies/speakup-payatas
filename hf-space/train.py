"""
train.py — SpeakUp Payatas High-Accuracy Random Forest Classifier.

Upgraded Architecture:
• 3,500+ diverse, balanced training samples across all 22 EOC categories
• Generic context augmentation (time of day, areas, salutations, politeness)
  distributed uniformly across all categories to eliminate dataset bias
• Clean Tagalog slang normalizer + conservative morphological verbal prefix stemmer
• Tagalog + English Stop Words pruning (max_df=0.65)
• Sublinear TF-IDF (unigrams, bigrams, trigrams)
• 200-Tree Calibrated Random Forest (Platt Sigmoid Scaling)
• Context-sensitive Urgency Classifier (LOW / MEDIUM / HIGH)
• Area-aware Department and Base Patrol Dispatch Routing
"""

import os
import json
import random
import re
import warnings
import numpy as np
import joblib

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

warnings.filterwarnings("ignore")
random.seed(42)
np.random.seed(42)

# ─────────────────────────── Official Categories ───────────────────────────

CATEGORIES = [
    "safety_concern", "threats_harassment", "fire_hazard", "medical_health",
    "road_traffic", "road_accidents", "noise_nuisance", "electrical_concerns",
    "animal_concerns", "family_domestic", "substance_concerns", "social_welfare",
    "legal_mediation", "infrastructure", "drainage_flooding", "clearance_concerns",
    "service_assistance", "environmental", "garbage_concerns", "sanitation_health",
    "inquiries", "other",
]

CATEGORY_LABELS = {
    "safety_concern": "Violence and Public Safety",
    "threats_harassment": "Threats and Harassment",
    "fire_hazard": "Fire and Disaster Alert",
    "medical_health": "Medical and Health",
    "road_traffic": "Road and Traffic",
    "road_accidents": "Road Accidents",
    "noise_nuisance": "Public Disturbance / Noise",
    "electrical_concerns": "Electrical Concerns",
    "animal_concerns": "Animal Related Concerns",
    "family_domestic": "Family and Domestic Concerns",
    "substance_concerns": "Substance Related Concerns",
    "social_welfare": "Social Welfare Concerns",
    "legal_mediation": "Legal and Barangay Mediation",
    "infrastructure": "Infrastructure and Public Works",
    "drainage_flooding": "Drainage / Flooding",
    "clearance_concerns": "Clearance Concerns",
    "service_assistance": "Service and Assistance Requests",
    "environmental": "Environmental Concerns",
    "garbage_concerns": "Garbage Concerns",
    "sanitation_health": "Sanitation / Health",
    "inquiries": "Inquiries",
    "other": "Others",
}

URGENCY_LEVELS = ["LOW", "MEDIUM", "HIGH"]

DEPARTMENTS = [
    "ASH / VAW", "BADAC", "BCPC", "BDRRM Office", "BHERT",
    "Alpha Base", "Bravo Base", "LP Base", "Group 13 Base",
    "Clearance Department", "CRO Office", "Environmental Protection",
    "Fire Brigade", "Gender and Development", "Lupon Tagapamayapa",
    "Maynilad", "Meralco", "PDAO", "Police Station 13",
    "Sector 5", "Traffic Base", "Secretary",
]

CATEGORY_DEPT_MAP = {
    "safety_concern": "Police Station 13",
    "threats_harassment": "Police Station 13",
    "fire_hazard": "BDRRM Office",
    "medical_health": "BHERT",
    "road_traffic": "Traffic Base",
    "road_accidents": "Traffic Base",
    "noise_nuisance": "CRO Office",
    "electrical_concerns": "Meralco",
    "animal_concerns": "BHERT",
    "family_domestic": "ASH / VAW",
    "substance_concerns": "BADAC",
    "social_welfare": "Secretary",
    "legal_mediation": "Lupon Tagapamayapa",
    "infrastructure": "Secretary",
    "drainage_flooding": "BDRRM Office",
    "clearance_concerns": "Clearance Department",
    "service_assistance": "Secretary",
    "environmental": "Environmental Protection",
    "garbage_concerns": "Environmental Protection",
    "sanitation_health": "BHERT",
    "inquiries": "Secretary",
    "other": "Secretary",
}

AREA_BASE_MAP = {
    "AREA A": "Alpha Base",
    "AREA B": "Bravo Base",
    "LUPANG PANGAKO": "LP Base",
    "GROUP 13": "Group 13 Base",
}

CATEGORY_URGENCY_MAP = {
    "safety_concern": "HIGH",
    "threats_harassment": "HIGH",
    "fire_hazard": "HIGH",
    "medical_health": "HIGH",
    "road_accidents": "HIGH",
    "family_domestic": "HIGH",
    "substance_concerns": "HIGH",
    "road_traffic": "MEDIUM",
    "electrical_concerns": "MEDIUM",
    "animal_concerns": "MEDIUM",
    "drainage_flooding": "MEDIUM",
    "environmental": "MEDIUM",
    "sanitation_health": "MEDIUM",
    "social_welfare": "MEDIUM",
    "legal_mediation": "MEDIUM",
    "noise_nuisance": "LOW",
    "infrastructure": "LOW",
    "clearance_concerns": "LOW",
    "service_assistance": "LOW",
    "garbage_concerns": "LOW",
    "inquiries": "LOW",
    "other": "LOW",
}

TAGALOG_STOP_WORDS = [
    "sa", "ng", "ang", "mga", "na", "at", "po", "dito", "doon", "diyan",
    "yung", "ung", "namin", "nila", "ko", "mo", "siya", "kami", "tayo",
    "kayo", "ay", "ito", "iyon", "may", "mayroon", "wala", "walang",
    "dahil", "kasi", "kc", "kse", "para", "kapag", "kung", "lang", "naman",
    "din", "rin", "daw", "raw", "the", "is", "at", "which", "on", "in", "a", "an",
    "to", "of", "and", "or", "for", "with", "this", "that", "from"
]

# ─────────────────── Tagalog Slang Normalizer & Stemmer ───────────────────

SLANG_MAP = {
    "d2": "dito", "d1": "doon", "jan": "diyan", "dyan": "diyan",
    "wlang": "walang", "wla": "walang",
    "brgy": "barangay", "bgy": "barangay",
    "kc": "kasi", "kse": "kasi", "cuz": "kasi", "coz": "kasi",
    "ung": "yung", "bka": "baka", "kht": "kahit", "dpt": "dapat",
    "grbe": "grabe", "pls": "pakiusap", "plz": "pakiusap", "txt": "text",
    "pki": "paki", "tpos": "tapos", "bsta": "basta", "bkit": "bakit",
    "hosp": "ospital", "skwela": "eskwelahan", "skwelahan": "eskwelahan",
    "sched": "schedule", "info": "impormasyon", "govt": "gobyerno",
    "pic": "picture", "ltr": "litro", "sec": "segundo",
    "mins": "minuto", "min": "minuto", "hrs": "oras", "hr": "oras",
    "drange": "drainage", "drain": "drainage", "clog": "clogged",
    "knal": "kanal", "kanall": "kanal", "posste": "poste", "kurynt": "kuryente",
    "basuraa": "basura", "bahang": "baha", "sunogg": "sunog",
}

def clean_tagalog_token(w: str) -> str:
    """Normalize slang and strip productive verbal prefixes without destroying root nouns."""
    w = SLANG_MAP.get(w, w)
    if len(w) <= 4:
        return w
    # Conservative verbal prefix stripping (only for long verbal forms)
    verbal_prefixes = [
        "nagkaka", "nakaka", "pinagka", "ipinag", "magpa", "pagka",
        "nagka", "naka", "maki", "naki", "paki", "nag", "mag", "pag"
    ]
    for p in verbal_prefixes:
        if w.startswith(p) and len(w) - len(p) >= 4:
            # e.g., nag-aaway -> away, nagbaha -> baha, nagsusuntukan -> suntukan
            return w[len(p):]
    return w

def preprocess_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"[^\w\s\-]", " ", text)
    words = text.split()
    tokens = []
    for w in words:
        stemmed = clean_tagalog_token(w)
        tokens.append(stemmed)
    return " ".join(tokens)

# ─────────────────── Generic Context Variation Pools ───────────────────

AREAS = [
    "Area A", "Area B", "Lupang Pangako", "Group 13", "Payatas Road",
    "Kasunduan", "Litex", "Phase 1", "Phase 2", "Phase 4", "Sitio Damayan",
    "Sandakot", "Molave", "Amlac", "San Vicente", "Barangay Payatas",
]

TIME_PHRASES = [
    "kaninang madaling araw", "hatinggabi na", "kaninang umaga",
    "kaninang hapon", "ngayong gabi", "tuwing gabi", "kahapon",
    "ngayong araw", "kanina lang", "", "", "",
]

SALUTATIONS = [
    "Magandang araw po,", "Hello po,", "Good morning po,", "Good afternoon po,",
    "Paki-report po:", "Gusto ko po mag-report:", "Report ko lang po:",
    "Emergency report:", "Concern report mula sa residente:", "", "", "",
]

POLITENESS = ["po", "po,", "naman po", "paki-aksyunan po agad", ""]

# ─────────────────── Rich Category Templates (22 Classes) ───────────────────

CATEGORY_PHRASES: dict[str, list[str]] = {
    # ── 1. safety_concern ──
    "safety_concern": [
        "May nag-aaway na grupo ng mga lalaki sa kanto {TIME}",
        "Nagsusuntukan ang mga tambay sa tapat ng tindahan",
        "Snatching incident nangyari may inagawan ng bag at cellphone",
        "May magnanakaw na pumasok sa bahay ng kapitbahay",
        "Holdaper nag-ooperate may dalang patalim at baril",
        "May kahina-hinalang mga kalalakihan na may dalang kutsilyo",
        "Riot ng mga kabataan sa basketball court nagbabatuhan ng bote at bato",
        "Vandalism at paninira ng ari-arian sa barangay outpost",
        "Robbery and theft incident reported near the grocery store",
        "Suspicious men lingering around dark alleys late at night",
        "May nagwawala na lalaki may dalang itak delikado sa kalsada",
        "Binasag ang salamin ng nakaparadang sasakyan at ninakawan",
        "May nag-aamok na tao dito sa may kalsada kailangan ng pulis",
        "Looting and pickpocketing around the public market",
        "Putok ng baril narinig may nagpaputok sa kalsada",
        "Panloloob at akyat-bahay sa compound",
        "Away ng magkabilang grupo sa kalsada may saksakan na nangyari",
        "Gang riot and public brawl involving weapons and blades",
        "Kailangan ng backup ng Police Station 13 may violent fight",
        "Sinaksak ang isang residente matapos holdapin sa madilim na eskinita",
    ],

    # ── 2. threats_harassment ──
    "threats_harassment": [
        "Lagi kaming binabantaan ng kapitbahay na papatayin daw kami",
        "May lalaking nag-iistalk at palihim na sumusunod sa anak kong dalaga",
        "Binastos at hinipuan ang kapatid ko habang naglalakad sa eskinita",
        "Death threat sa pamilya namin mula sa dating kagalit",
        "Catcalling, pambabastos at harassment ng mga tambay sa mga babae",
        "Patuloy na pambu-bully at pananakot sa mga mag-aaral",
        "Online harassment at cyberbullying na may banta sa buhay",
        "A man is persistently harassing female pedestrians near the terminal",
        "Persistent verbal threats and intimidation from our aggressive landlord",
        "May nagbabanta na susunugin ang aming tahanan",
        "Sinundan ako hanggang sa gate ng bahay ng lalaking lasing",
        "Pananakot sa mga tindera na sisingilin ng protection money",
        "Aggressive stalking behavior reported near the chapel",
        "Binabantaan ang buhay ng aming pamilya araw-araw",
        "Threatening text messages received from an unknown stalker",
    ],

    # ── 3. fire_hazard ──
    "fire_hazard": [
        "May malaking sunog sa residential area kailangan ng bumbero agad",
        "Sumabog ang tangke ng LPG sa kusina may makapal na usok",
        "Nasusunog na mga kabahayan gawa sa light materials saklolo",
        "Grass fire kumakalat malapit sa mga bahay sa bakanteng lote",
        "Makapal na maitim na usok lumalabas sa nasusunog na bodega",
        "Fire disaster alert! Multiple houses are catching fire right now",
        "May nasusunog na poste ng kuryente na kumalat sa bubong ng bahay",
        "Naiwang kandila nagdulot ng sunog sa ikalawang palapag",
        "Fire brigade needed immediately! Rapidly spreading blaze",
        "Sunog sa bakery malapit sa palengke mag-evacuate na mga tao",
        "Chemical smoke and fire emergency reported inside a workshop",
        "LPG gas leak with strong burning smell threatening explosion",
        "BDRRM rescue needed fire spreading fast due to strong winds",
        "Structural fire in progress near the elementary school",
        "Nagliliyab na kable ng kuryente dumidikit sa mga bubong ng kabahayan",
    ],

    # ── 4. medical_health ──
    "medical_health": [
        "Kailangan ng ambulansya nahimatay at hindi humihinga ang pasyente",
        "May buntis na manganganak na sa bahay kailangan ng medical rescue",
        "Inatake sa puso ang tatay ko kailangan ng emergency stretcher",
        "Emergency ambulance needed for a severely bleeding resident",
        "Bata nagkombulsyon at mataas ang lagnat kailangan dalhin sa ospital",
        "Severe stroke symptoms observed, elderly patient unresponsive",
        "BHERT health assistance needed for dengue patients with high fever",
        "Nasugatan nang malalim dahil sa bubog kailangan ng first aid",
        "A person collapsed unconscious on the sidewalk needing CPR",
        "Kailangan ng oxygen tank at medical transport para sa bedridden patient",
        "Senior citizen nahulog sa hagdan hindi makagalaw ang balakang",
        "Suspected food poisoning multiple family members vomiting severely",
        "Ambulansya paki-padala agad sa may health center emergency",
        "Residente naaksidente sa loob ng bahay bali ang buto sa binti",
    ],

    # ── 5. road_traffic ──
    "road_traffic": [
        "Napakabigat ng trapik sa kanto dahil sa mga nakaharang na tricycle",
        "Illegal parking sa magkabilang kalsada hindi makadaan ang mga sasakyan",
        "Nakaharang na delivery truck sa one-way street nagdudulot ng gridlock",
        "Mga jeep na nagbababa sa gitna ng daan nagdudulot ng matinding traffic",
        "Severe traffic jam caused by illegal street vendors blocking the lane",
        "Obstruction on the main road: abandoned vehicle blocking emergency access",
        "Traffic base enforcer needed at the intersection no one is directing",
        "Nakasagabal na construction materials sa kalsada kalahati lang ang madaanan",
        "Mga colorum na tricycle nagte-terminal sa pedestrian lane",
        "Bawal pumarada pero ginawang garahe ang kalsada ng mga pribadong kotse",
        "Baradong trapiko dahil sa ginagawang kalsada walang traffic signage",
        "Illegal counterflow of motorcycles causing traffic chaos and bottleneck",
    ],

    # ── 6. road_accidents ──
    "road_accidents": [
        "May nagbanggaang motor at tricycle sa kanto may sugatan sa kalsada",
        "Head-on collision between a speeding motorcycle and jeepney",
        "Hit and run incident: may nasagasaang bata ang tumakas na kotse",
        "Sumemplang na motorsiklo dahil sa madulas na kalsada duguan ang driver",
        "Kotse bumangga sa poste ng ilaw sira ang harapan kailangan ng tulong",
        "A pedestrian was hit by a speeding vehicle along the crosswalk",
        "Multiple vehicle pile-up on the highway section with injured passengers",
        "Nasalpok ng delivery van ang pampasaherong jeep may naipit na pasahero",
        "Vehicular accident with serious physical injuries reported on the road",
        "Bumangga ang truck sa waiting shed may nasugatang commuter",
        "Motorcycle rider thrown off vehicle after hitting an open manhole",
        "Aksidente sa kalsada kailangan ng traffic investigator at ambulansya",
    ],

    # ── 7. noise_nuisance ──
    "noise_nuisance": [
        "Napakalakas ng videoke at karaoke sa tapat namin hindi kami makatulog {TIME}",
        "Maingay na tugtugan, sound system at inuman sa kalsada {TIME}",
        "Loud party music with heavy bass shaking our walls past midnight",
        "May nagko-construction at gumagamit ng grinder at lagari sa dis-oras ng gabi",
        "Walang tigil na tahol ng mga aso at sigawan ng mga nag-iinuman {TIME}",
        "Disruption of peace: loud exhaust open-pipe motorcycle revving repeatedly",
        "Karaoke singing with loud amplifier still blasting at 2 AM",
        "Sigawan at murahan ng mga lasing na nag-iinuman sa sidewalk",
        "Nuisance noise from an illegal metal fabrication welding shop operating late",
        "CRO office paki-suway ang maingay na birthday celebration sa tapat ng bahay",
        "Sobrang ingay ng bass ng speaker hindi makatulog at makapag-aral ang mga bata",
        "Dis-oras na ng gabi nagpapatugtog pa rin ng napakalakas na videoke",
        "Puyat na puyat na ang mga residente dahil sa walang tigil na kantahan at videoke",
        "Maingay na live band at soundbox sa kanto nakakaistorbo sa tulog",
        "Videoke session hanggang umaga napaka-iresponsable paki-patahimik",
    ],

    # ── 8. electrical_concerns ──
    "electrical_concerns": [
        "May lumalaylay at nakabiting live wire sa kalsada delikado sa mga dumadaan",
        "Pumuputok at nag-iispark ang transformer sa poste ng Meralco",
        "Blackout at brownout sa buong street namin pumutok ang fuse sa poste",
        "Sparking electrical wires touching residential tin roofs and trees",
        "Nakatagilid at mababaling poste ng kuryente na may kable",
        "Illegal electrical connection or jumper discovered tapping on the power line",
        "Low dangling power cable caught on a passing truck pulling the pole",
        "Umuusok ang kuntador ng kuryente sa poste delikado baka sumabog",
        "Meralco emergency: power outage with sparking service drop wire",
        "Nahulog ang kawad ng kuryente sa baha may live current delikado",
        "Poste ng ilaw walang kuryente at madilim ang buong eskinita sa gabi",
    ],

    # ── 9. animal_concerns ──
    "animal_concerns": [
        "May asong gala na nanghahabol at nangangagat ng mga naglalakad",
        "Stray aggressive rabid dog roaming around the elementary school",
        "May nakitang malaking ahas sa drainage canal malapit sa mga bahay",
        "Rabies concern: resident bitten by an unvaccinated stray dog",
        "Dumaraming mga pusang gala na nagkakalat at nagdudulot ng dumi",
        "Inabandonang mga tuta at aso na nakakulong sa initan walang pagkain",
        "Animal welfare issue: neighbor abusing and beating their pet cruelty",
        "BHERT assistance needed for anti-rabies vaccination after dog bite",
        "May patay na aso sa gilid ng kalsada mabaho at naaagnas na",
        "Aggressive pitbull loose on the street chasing children and neighbors",
    ],

    # ── 10. family_domestic ──
    "family_domestic": [
        "May asawang babae na binubugbog ng mister niya naririnig ang iyak at saklolo",
        "Domestic violence incident: husband physically abusing wife and children",
        "VAWC report: pananakit, pananaksak at pananakot sa loob ng tahanan",
        "Child abuse and physical punishment heard from the neighbor's house",
        "Mag-asawang nagwawala at nagbabatuhan ng gamit may batang umiiyak",
        "ASH/VAW intervention requested for battered woman seeking shelter",
        "Tatay na lasing pinagbantaan at pinalayas ang buong pamilya sa bahay",
        "Emotional and physical abuse of an elderly parent by their child",
        "Marital dispute escalating into physical harm needing barangay rescue",
        "Kailangan ng tulong ng GAD desk may babaeng sinasaktan ng kinakasama",
    ],

    # ── 11. substance_concerns ──
    "substance_concerns": [
        "May lantaran na nagbebenta ng ilegal na droga at shabu sa may eskinita",
        "Illegal drug session and pot session happening in an abandoned shanty",
        "BADAC report: mga kilalang pusher at adik nagtitipon tuwing gabi",
        "Lumalalanghap ng rugby at solvent ang mga kabataan sa ilalim ng tulay",
        "Drug trafficking and illegal substance distribution observed in the alley",
        "May nagtatagong drug user na nagwawala kapag sabog sa droga",
        "Suspicious drug trade transactions happening at the basketball court",
        "Police Station 13 tip: suspected drug den operating inside a house",
        "Mga kabataang gumagamit ng ipinagbabawal na gamot sa madilim na kanto",
    ],

    # ── 12. social_welfare ──
    "social_welfare": [
        "Nais mag-inquire tungkol sa ayuda at financial assistance para sa PWD",
        "Application for 4Ps, solo parent ID, or indigent social pension",
        "Senior citizen living alone needing food relief and medical support",
        "Request for emergency burial assistance (AICS) from the barangay",
        "Educational assistance inquiry for impoverished students residing in the barangay",
        "PDAO assistance needed for wheelchair donation for a paralyzed resident",
        "Tulong pinansyal para sa pampalibing ng aming pumanaw na kamag-anak",
        "Inquiry on the distribution schedule of relief goods and cash aid",
        "Abandonadong matanda na walang kumakalinga kailangan ng DSWD shelter",
        "Nanghihingi po kami ng tulong pinansyal para sa gamot at pampagamot ng aking nanay",
        "Medical financial assistance at guarantee letter para sa pampa-ospital",
        "Hihingi po ng ayuda o pinansyal na tulong para sa maintenance ng gamot ng senior",
        "Tulong pinansyal para sa operasyon at dialysis ng pasyente sa ospital",
        "Humihingi ng financial aid at tulong pambili ng gatas at gamot ng bata",
        "DSWD at barangay social service assistance para sa mahihirap na pamilya",
    ],

    # ── 13. legal_mediation ──
    "legal_mediation": [
        "Gusto kong magreklamo sa Lupon Tagapamayapa laban sa kapitbahay kong may utang",
        "Request for barangay conciliation and mediation hearing for boundary dispute",
        "Lupon summon requested: harassment and unpaid rental lease agreement",
        "Boundary property line conflict between adjacent homeowners",
        "Patawag sa barangay para sa kasunduan at settlement ng atraso",
        "Breach of contract and financial conflict needing Lupon mediation",
        "Kailangan namin ng hearing schedule sa barangay dahil sa alitan sa lupa",
        "Formal complaint filed regarding property encroachment and boundary dispute",
    ],

    # ── 14. infrastructure ──
    "infrastructure": [
        "May malaking lubak at bitak sa kalsada na nagdudulot ng disgrasya",
        "Bumigay ang pader at riprap ng kanal dahil sa malakas na ulan",
        "Sirang tulay o hanging bridge na pumuputol ang kable delikado",
        "Potholes and severely damaged asphalt roadway requiring public works repair",
        "Collapsed retaining wall or sidewalk posing hazard to pedestrians",
        "Bukas na manhole walang takip nahulog ang gulong ng sasakyan",
        "Sirang street light poste ng ilaw madilim at delikado sa gabi",
        "Bagsak na footbridge at barandilya kailangan ng kumpuni",
        "Bitak-bitak na semento sa kalsada kailangan ng aspalto at semento",
    ],

    # ── 15. drainage_flooding ──
    "drainage_flooding": [
        "Bumabaha hanggang tuhod sa kalsada dahil barado ang drainage at kanal",
        "Clogged canal overflowing with black dirty wastewater during heavy rain",
        "Umaapaw na estero at baradong culvert nagdudulot ng matinding baha",
        "Flooding in residential compound: water entering houses after rain",
        "Kailangan ng dredging o de-clogging ng kanal punong-puno ng putik at burak",
        "Severe street flooding impassable to light vehicles near the creek",
        "Baradong kanal sanhi ng mga plastik at basura bumabaho at bumabaha",
        "BDRRM flood advisory: rising water level threatening low-lying homes",
        "Submerged roads due to inadequate drainage system and blocked waterways",
        "Pumutok po ang tubo ng tubig sa tapat ng bahay bumabaha na sa kalsada",
        "May pumutok na water pipe o tubo ng Maynilad tumatagas at nagbabaha",
        "Sirang tubo ng tubig na nagdudulot ng matinding baha at sayang ang tubig",
        "Tumatagas na malaking tubo ng tubig bumabaha na sa tapat ng bahay namin",
        "Burst water pipe flooding the whole street and pathway",
    ],

    # ── 16. clearance_concerns ──
    "clearance_concerns": [
        "Gusto kong kumuha ng Barangay Clearance para sa employment at trabaho",
        "Inquiry on requirements for Certificate of Indigency and Residency",
        "Application for Barangay Business Permit and clearance documents",
        "Paano mag-apply ng Barangay ID at Cedula para sa bagong lipat",
        "Requesting certificate of good moral character from the barangay clearance desk",
        "Payment and processing of community tax certificate at the barangay hall",
        "Magtatanong kung magkano ang bayad sa barangay clearance para sa trabaho",
    ],

    # ── 17. service_assistance ──
    "service_assistance": [
        "Requesting to borrow tents, tolda, chairs, and tables for a wake lamay",
        "Pahiram ng mga monoblock chairs at lamesa para sa community meeting",
        "Request for barangay ambulance service to transport patient for check-up",
        "Sound system and tent rental reservation for a community event",
        "Humihingi ng tulong sa barangay vehicle para maghakot ng gamit sa paglipat",
        "Request for fogging and fumigation machine service in our street",
        "Pahiram ng court o multipurpose hall para sa school activity",
    ],

    # ── 18. environmental ──
    "environmental": [
        "May nagtatapon ng kemikal at toxic waste sa ilog o estero",
        "Illegal cutting of large trees without permit risking landslide",
        "Soil erosion and slope instability threatening houses on the ridge",
        "Nagsusunog ng plastic at basura nagdudulot ng nakakasamang usok at polusyon",
        "Air and chemical pollution from an unlicensed factory operating nearby",
        "Landslide alert: gumuguho ang lupa sa gilid ng bundok malapit sa kabahayan",
        "Environmental violation: direct sewage pipe draining into the public creek",
    ],

    # ── 19. garbage_concerns ──
    "garbage_concerns": [
        "Tambak na basura sa kanto hindi pa nahahakot ng garbage truck",
        "Uncollected solid waste piles accumulating foul smell on the street",
        "Matagal nang hindi dumadaan ang trak ng basura umaapaw na ang tambakan",
        "Illegal dumping of trash bags and construction debris on the sidewalk",
        "Nangangalat ang mga sako ng basura kinakalkal ng mga aso at pusa",
        "Garbage collection schedule inquiry: dalawang linggo nang walang hakot",
        "Mabahong tambak ng bulok na basura malapit sa talipapa at kalsada",
        "Environmental protection unit needed: improper waste segregation and dumping",
    ],

    # ── 20. sanitation_health ──
    "sanitation_health": [
        "Napakabaho ng poso negro na tumatagas sa kanal sa tapat namin",
        "Stagnant dirty water breeding dengue mosquitoes in an empty lot",
        "Foul sewage odor coming from overflowing septic tank leaking to the road",
        "Sanitation health hazard: unhygienic piggery or poultry smell in residential area",
        "Baradong kubeta o poso negro nagdudulot ng maruming tubig sa kalsada",
        "Health inspection needed for unsanitary food stall operating without permit",
        "Pest infestation: dumaraming daga at ipis dahil sa baradong maruming tubig",
    ],

    # ── 21. inquiries ──
    "inquiries": [
        "Magtatanong kung anong oras bukas ang barangay hall para sa transaction",
        "Inquiry on office hours and available services this coming holiday",
        "Schedule of medical mission and free dental check-up in the barangay",
        "Saan pwede mag-follow up ng naunang request sa barangay secretary",
        "Tanong ko lang kung bukas ang barangay hall tuwing Sabado at Linggo",
        "General inquiry regarding requirements for new barangay residents",
    ],

    # ── 22. other ──
    "other": [
        "Gusto ko lang magbigay ng feedback at papuri sa magandang serbisyo",
        "General community suggestion regarding street beautification and lighting",
        "Lost item report: may naiwang bag sa may waiting shed sana maibalik",
        "Inquiry regarding general barangay matters not covered by specific desks",
        "Community announcement inquiry for upcoming barangay sports fest",
    ],
}

def generate_samples(target_per_category: int = 160) -> tuple[list[str], list[str], list[str]]:
    texts = []
    clean_texts = []
    labels = []
    urgencies = []

    for cat in CATEGORIES:
        phrases = CATEGORY_PHRASES[cat]
        default_urg = CATEGORY_URGENCY_MAP[cat]

        for i in range(target_per_category):
            phrase = phrases[i % len(phrases)]
            area = random.choice(AREAS)
            time_phrase = random.choice(TIME_PHRASES)
            salutation = random.choice(SALUTATIONS)
            po = random.choice(POLITENESS)

            # Format phrase
            sample = phrase.replace("{AREA}", area).replace("{TIME}", time_phrase)
            
            # Augment with random salutation & politeness
            parts = []
            if salutation and random.random() < 0.6:
                parts.append(salutation)
            parts.append(sample)
            if po and random.random() < 0.5:
                parts.append(po)
            if area not in sample and random.random() < 0.7:
                parts.append(f"dito sa {area}")

            full_text = " ".join(parts)
            full_text = re.sub(r"\s+", " ", full_text).strip()

            clean = preprocess_text(full_text)
            if not clean.strip():
                continue

            texts.append(full_text)
            clean_texts.append(clean)
            labels.append(cat)

            # Context-sensitive urgency calculation
            urg = default_urg
            low_text = full_text.lower()
            if any(w in low_text for w in ["sunog", "fire", "emergency", "sugatan", "patay", "duguan", "delikado", "bomba", "baril", "holdup", "saklolo"]):
                urg = "HIGH"
            elif any(w in low_text for w in ["baha", "lubog", "putol", "spark", "kagat", "buntis"]):
                urg = "MEDIUM" if default_urg != "HIGH" else "HIGH"
            urgencies.append(urg)

    return texts, clean_texts, labels, urgencies

# ─────────────────────────── Training Pipeline ───────────────────────────

def train_and_save():
    print(f"\n{'=' * 65}")
    print("SpeakUp Payatas — Advanced Calibrated Random Forest Training")
    print("Classes: 22 Concern Types | Target: Production-Grade Accuracy")
    print(f"{'=' * 65}\n")

    texts, clean_texts, labels, urgencies = generate_samples(target_per_category=165)
    total_samples = len(clean_texts)
    print(f"Generated {total_samples} balanced training samples.")
    print(f"Sample count per category: {total_samples // len(CATEGORIES)}\n")

    # ── 1. TF-IDF Feature Extraction ──
    print("Fitting TF-IDF Vectorizer (Unigrams, Bigrams, Trigrams)...")
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 3),
        max_features=12000,
        sublinear_tf=True,
        min_df=2,
        max_df=0.65,  # Prunes words appearing in >65% of documents (stops generic noise)
        stop_words=TAGALOG_STOP_WORDS,
        strip_accents="unicode",
    )
    X = vectorizer.fit_transform(clean_texts)
    y_cat = np.array(labels)
    y_urg = np.array(urgencies)

    # ── 2. Category Classifier (200-Tree Calibrated Random Forest) ──
    print("Splitting train/test data (85% train, 15% test)...")
    X_train_c, X_test_c, y_train_c, y_test_c = train_test_split(
        X, y_cat, test_size=0.15, random_state=42, stratify=y_cat
    )

    print("Training 200-Tree Random Forest with CalibratedClassifierCV (Sigmoid)...")
    base_rf_cat = RandomForestClassifier(
        n_estimators=200,
        class_weight="balanced_subsample",
        max_depth=None,
        min_samples_split=2,
        random_state=42,
        n_jobs=-1,
    )
    calibrated_rf_cat = CalibratedClassifierCV(base_rf_cat, cv=3, method="sigmoid")
    calibrated_rf_cat.fit(X_train_c, y_train_c)

    y_pred_c = calibrated_rf_cat.predict(X_test_c)
    cat_accuracy = accuracy_score(y_test_c, y_pred_c)
    print(f"\n[+] Category Test Accuracy: {cat_accuracy * 100:.2f}%\n")
    print("Classification Report (Category):")
    print(classification_report(y_test_c, y_pred_c, zero_division=0))

    # ── 3. Urgency Classifier (120-Tree Calibrated Random Forest) ──
    print("Training Urgency Classifier (120 Trees with CalibratedClassifierCV)...")
    X_train_u, X_test_u, y_train_u, y_test_u = train_test_split(
        X, y_urg, test_size=0.15, random_state=42, stratify=y_urg
    )

    base_rf_urg = RandomForestClassifier(
        n_estimators=120,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    calibrated_rf_urg = CalibratedClassifierCV(base_rf_urg, cv=3, method="sigmoid")
    calibrated_rf_urg.fit(X_train_u, y_train_u)

    y_pred_u = calibrated_rf_urg.predict(X_test_u)
    urg_accuracy = accuracy_score(y_test_u, y_pred_u)
    print(f"\n[+] Urgency Test Accuracy: {urg_accuracy * 100:.2f}%\n")

    # ── 4. Save Artifacts ──
    model_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model")
    os.makedirs(model_dir, exist_ok=True)

    print("Saving calibrated model artifacts...")
    joblib.dump(vectorizer, os.path.join(model_dir, "tfidf_category.joblib"), compress=3)
    joblib.dump(calibrated_rf_cat, os.path.join(model_dir, "rf_category.joblib"), compress=3)
    joblib.dump(vectorizer, os.path.join(model_dir, "tfidf_urgency.joblib"), compress=3)
    joblib.dump(calibrated_rf_urg, os.path.join(model_dir, "rf_urgency.joblib"), compress=3)

    metadata = {
        "model_name": "SpeakUp Payatas Advanced Calibrated Random Forest",
        "model_type": "Calibrated Random Forest (200 Trees) + Sublinear TF-IDF (1-3 ngrams)",
        "version": "3.1.0",
        "categories": CATEGORIES,
        "category_labels": CATEGORY_LABELS,
        "urgency_levels": URGENCY_LEVELS,
        "departments": DEPARTMENTS,
        "category_dept_map": CATEGORY_DEPT_MAP,
        "area_base_map": AREA_BASE_MAP,
        "category_urgency_defaults": CATEGORY_URGENCY_MAP,
        "category_accuracy": round(float(cat_accuracy), 4),
        "urgency_accuracy": round(float(urg_accuracy), 4),
        "n_trees_category": 200,
        "n_trees_urgency": 120,
        "total_training_samples": total_samples,
        "calibrated": True,
        "stop_words_count": len(TAGALOG_STOP_WORDS),
    }

    with open(os.path.join(model_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"\n{'=' * 65}")
    print(f"[SUCCESS] Model training complete and saved to {model_dir}/")
    print(f"  • Category Accuracy: {cat_accuracy * 100:.2f}%")
    print(f"  • Urgency Accuracy:  {urg_accuracy * 100:.2f}%")
    print(f"  • Total Samples:     {total_samples}")
    print(f"{'=' * 65}\n")


if __name__ == "__main__":
    train_and_save()
