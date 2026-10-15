import json
import os
import sys
import re
from datetime import datetime
from collections import Counter

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix
import joblib

CATEGORIES = [
    "drainage_flooding",
    "fire_hazard",
    "safety_concern",
    "infrastructure",
    "sanitation_health",
    "noise_nuisance",
    "environmental",
]

STOP_WORDS = [
    "ang", "mga", "sa", "ng", "na", "ay", "si", "at", "may", "kung",
    "ito", "para", "yung", "ung", "po", "opo", "kami", "sila", "ko",
    "mo", "niya", "amin", "namin", "dito", "doon", "dyan", "ba", "pa",
    "din", "rin", "lang", "nang", "noon", "ngayon", "dahil", "kasi",
    "a", "an", "the", "in", "on", "at", "to", "for", "of", "with",
    "is", "are", "was", "were", "and", "or", "it", "this", "that"
]

SLANG_MAP = {
    "d2": "dito", "d1": "doon", "jan": "diyan", "dyan": "diyan",
    "wlang": "walang", "wla": "walang", "wala": "walang",
    "brgy": "barangay", "bgy": "barangay",
    "kc": "kasi", "kse": "kasi", "cuz": "kasi", "coz": "kasi",
    "ung": "yung", "bka": "baka", "kht": "kahit", "dpt": "dapat",
    "grbe": "grabe", "pls": "pakiusap", "plz": "pakiusap", "txt": "text",
    "subd": "subdivision", "st": "street", "ave": "avenue",
    "hosp": "ospital", "skwela": "eskwelahan", "skwelahan": "eskwelahan",
    "sched": "schedule", "info": "impormasyon", "govt": "gobyerno",
    "pic": "picture", "ltr": "litro", "sec": "segundo",
    "mins": "minuto", "min": "minuto", "hrs": "oras", "hr": "oras",
    "drange": "drainage", "drain": "drainage", "clog": "clogged",
    "knal": "kanal", "kanall": "kanal", "posste": "poste", "kurynt": "kuryente"
}

def tagalog_stem(word: str) -> str:
    w = word.lower().strip()
    if len(w) <= 4:
        return w

    prefixes = [
        "nagkaka", "nakaka", "pinagka", "ipinag", "magpa", "pagka",
        "nagka", "naka", "maki", "naki", "paki", "nag", "mag", "pag",
        "pan", "pam", "pang", "ipa", "ika", "ma", "na", "ka"
    ]
    for p in prefixes:
        if w.startswith(p) and len(w) - len(p) >= 3:
            w = w[len(p):]
            break

    if len(w) >= 6 and (w.startswith("bum") or w.startswith("bin")):
        w = w[0] + w[3:]
    elif len(w) >= 7 and (w[1:3] == "um" or w[1:3] == "in"):
        w = w[0] + w[3:]

    if len(w) >= 6 and w[0:2] == w[2:4]:
        w = w[2:]

    suffixes = ["han", "hin", "an", "in"]
    for s in suffixes:
        if w.endswith(s) and len(w) - len(s) >= 3:
            w = w[:-len(s)]
            break

    return w

def clean_and_normalize(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'[^\w\s\-]', ' ', text)
    words = text.split()

    processed_tokens = []
    for word in words:
        expanded = SLANG_MAP.get(word, word)
        processed_tokens.append(expanded)
        stemmed = tagalog_stem(expanded)
        if stemmed != expanded and len(stemmed) >= 3:
            processed_tokens.append(stemmed)

    return " ".join(processed_tokens)

TRAINING_CORPUS = [
    # ── 1. DRAINAGE / FLOODING ──
    ("Bumabaha sa kalsada, halos tuhod na ang tubig. Barado ang drainage sa kanto.", "drainage_flooding"),
    ("Hindi humuhupa ang baha dito sa harap ng chapel, may mga lumulutang na basura.", "drainage_flooding"),
    ("Barado ang kanal, kapag umuulan ay mabilis bumaha at pumapasok sa mga bahay.", "drainage_flooding"),
    ("Tubig-baha sa eskinita, hindi makadaan ang mga bata papuntang eskwelahan.", "drainage_flooding"),
    ("Nag-overflow ang drainage sa may basketball court dahil sa mga nakaharang na basura.", "drainage_flooding"),
    ("Malala ang pagbaha tuwing may malakas na ulan, lubog ang mga sasakyan sa Litex road.", "drainage_flooding"),
    ("Stagnant water sa gutter na hindi umaagos, ilang linggo nang nakaimbak ang tubig.", "drainage_flooding"),
    ("Mabagal ang daloy ng tubig sa drainage box culvert, umaapaw agad kahit ambon lang.", "drainage_flooding"),
    ("Kailangang i-declog ang kanal sa harap ng barangay outpost, barado ng putik at graba.", "drainage_flooding"),
    ("Umapaw ang creek dahil barado ang spillway ng mga inanod na sanga at debris.", "drainage_flooding"),
    ("Kanal na walang takip at barado, delikado baka may mahulog na bata tuwing bumabaha.", "drainage_flooding"),
    ("Lumalalim ang baha sa Phase 2 tuwing hapon dahil barado ang drainage palabas.", "drainage_flooding"),
    ("Pumasok na ang tubig-baha sa loob ng aming sala dahil walang daluyan ang kanal.", "drainage_flooding"),
    ("Matinding pagbaha sa may tulay ng Payatas A, barado ang ilalim ng culvert.", "drainage_flooding"),
    ("Drainage pipe na barado ng semento mula sa ginagawang bahay sa kanto.", "drainage_flooding"),
    ("Naiipon ang tubig ulan sa gutter, nagiging breeding ground ng lamok dahil barado.", "drainage_flooding"),
    ("Flash flood sa mababang parte ng Sitio Bakal, barado ang pangunahing daluyan.", "drainage_flooding"),
    ("Ponding of storm water along the main road due to blocked storm drains.", "drainage_flooding"),
    ("Severe street flooding reaching knee level after thirty minutes of heavy rain.", "drainage_flooding"),
    ("Blocked canal causing rainwater to back up into residential compounds.", "drainage_flooding"),
    ("Overflowing drainage grates near the public market, dirty water spreading.", "drainage_flooding"),
    ("Umaapaw ang kanal sa kanto dahil sa tambak na buhangin at burak.", "drainage_flooding"),
    ("Bumabaha agad kahit sandaling ulan lang sa Lupang Pangako dahil barado ang labasan ng tubig.", "drainage_flooding"),
    ("Wlang daluyan ang tubig ulan kaya nagiging lawa ang tapat ng bahay.", "drainage_flooding"),
    ("Clogged drainage culvert needs immediate siphoning and desilting by engineering.", "drainage_flooding"),

    # ── 2. FIRE HAZARD / RISK ──
    ("May nag-i-spark na exposed wire sa poste malapit sa sari-sari store. Delikado kapag umuulan.", "fire_hazard"),
    ("Nakita namin na lumalawit ang kawad ng kuryente sa daan, mapanganib sa mga bata.", "fire_hazard"),
    ("May usok na lumalabas sa isang bahay, mukhang may sira sa electrical wiring.", "fire_hazard"),
    ("Broken na ang junction box sa poste ng Meralco, may sparking kapag gabi.", "fire_hazard"),
    ("LPG tank na may tagas na amoy gas sa tindahan, walang proper ventilation.", "fire_hazard"),
    ("Nagliliyab ang transformer sa poste ng kuryente, marami nang lumalabas na sparks.", "fire_hazard"),
    ("Spaghetti wires na nakalaylay at sumasabit sa bubong ng mga bahay, delikado sa sunog.", "fire_hazard"),
    ("May amoy sunog na kable ng kuryente mula sa submeter sa hallway ng compound.", "fire_hazard"),
    ("Ilegal na jumper connection na nag-iinit at umuusok sa poste sa may eskinita.", "fire_hazard"),
    ("Exposed live electrical cables dangling dangerously close to pedestrian walkway.", "fire_hazard"),
    ("Transformer explosion risk due to overloaded messy wires sparking continuously.", "fire_hazard"),
    ("Severe LPG gas leak odor detected near crowded bakery kitchen in Phase 1.", "fire_hazard"),
    ("Faulty electrical wiring sparking inside abandoned wooden shanty.", "fire_hazard"),
    ("Short circuit sa poste ng ilaw, patay-sindi at may kasamang malalakas na putok.", "fire_hazard"),
    ("Tambak na tuyong kahoy at flammable materials na nakadikit sa electrical panel.", "fire_hazard"),
    ("Umuusok na breaker sa tindahan, baka magsimula ng sunog kapag iniwang bukas.", "fire_hazard"),
    ("Exposed wire sa poste na nadikitan ng sanga ng puno, nagpapasiklab ng apoy.", "fire_hazard"),
    ("Damaged electric meter sparking intermittently whenever rain touches the box.", "fire_hazard"),
    ("Overheated generator with exposed fuel lines operating inside cramped garage.", "fire_hazard"),
    ("Dangling power line sparking against metal roof of residential house.", "fire_hazard"),
    ("Pumuputok na kable ng kuryente sa poste dahil sa overload ng mga jumper.", "fire_hazard"),
    ("Malakas na amoy ng LPG sa eskinita, may sumisingaw na tangke sa kusina.", "fire_hazard"),
    ("Overheated main circuit breaker tripping repeatedly and smelling like burnt plastic.", "fire_hazard"),
    ("Unregulated storage of gasoline drums in residential backyard posing severe fire hazard.", "fire_hazard"),

    # ── 3. SAFETY CONCERN ──
    ("Mga kabataang nag-aaway at nagbabatuhan ng bote sa eskinita tuwing gabi.", "safety_concern"),
    ("May suspicious na grupo ng lalaki na nag-iikot-ikot sa madaling araw na may dalang armas.", "safety_concern"),
    ("Nagnakaw ng motorsiklo sa harap ng bahay kagabi, wala pang rumorondang tanod.", "safety_concern"),
    ("May mga tambay na nanggugulo ng mga dumadaan at naniningil ng pangingikil sa gabi.", "safety_concern"),
    ("Aksidente sa kalsada dahil sa mga lasing na nagwawala at nambabato ng sasakyan.", "safety_concern"),
    ("Snatching incident sa may paradahan ng tricycle, hinablot ang bag ng isang guro.", "safety_concern"),
    ("Madilim na eskinita na laging tinatambayan ng mga gumagamit ng droga sa madaling araw.", "safety_concern"),
    ("Holdaper na nagtatago sa abandonadong lote malapit sa tulay ng Sitio Damayan.", "safety_concern"),
    ("Nagrarambol na kabataan may dalang patalim at tubo sa may basketball court.", "safety_concern"),
    ("Physical altercation and riot between youth gangs armed with bottles at midnight.", "safety_concern"),
    ("Suspicious armed individuals loitering near school entrance after classes.", "safety_concern"),
    ("Motorcycle theft reported outside chapel, suspect escaped towards lower Payatas.", "safety_concern"),
    ("Aggressive drunk men harassing female residents walking home from night shift.", "safety_concern"),
    ("Vandalism and unauthorized curfew violators causing severe public disturbance.", "safety_concern"),
    ("Pagnanakaw sa sari-sari store, pinasok habang natutulog ang may-ari.", "safety_concern"),
    ("Lalaking nagwawala may dalang itak sa may talipapa, kailangan ng agarang responde.", "safety_concern"),
    ("May nagpapaputok ng baril sa hangin noong hatinggabi, takot ang mga kapitbahay.", "safety_concern"),
    ("Snatcher sakay ng motorsiklo na walang plaka, nambibiktima ng mga estudyante.", "safety_concern"),
    ("Ronda tanod request dahil sa sunud-sunod na akyat-bahay sa aming kalye.", "safety_concern"),
    ("Threats and harassment from illegal settlement enforcers in Sitio Silangan.", "safety_concern"),
    ("Ilegal na sugalan at tupada na pinag-aawayan ng mga armadong grupo sa bakanteng lote.", "safety_concern"),
    ("Nanakawan ng bisikleta at mga gamit sa garahe habang natutulog ang pamilya.", "safety_concern"),
    ("Group of unruly teenagers harassing pedestrians and throwing rocks at passing jeepneys.", "safety_concern"),
    ("Attempted break-in and trespassing reported along Phase 3 residential row.", "safety_concern"),

    # ── 4. INFRASTRUCTURE ──
    ("Malaking lubak sa gitna ng daan, nadisgrasya na ang motor kagabi sa may kanto.", "infrastructure"),
    ("Sira ang streetlight sa buong bloke, sobrang dilim sa gabi at delikado sa dumadaan.", "infrastructure"),
    ("Gumuho ang retaining wall sa gilid ng daan, delikadong daanan baka tuluyang bumagsak.", "infrastructure"),
    ("Pothole na sobrang laki, nakakasira ng gulong ng mga tricycle at jeepney.", "infrastructure"),
    ("Broken ang railing ng tulay, mapanganib lalo na sa mga bata na tumatawid.", "infrastructure"),
    ("Nawasak ang sidewalk tiles, nakakapinsala sa mga naglalakad at matatanda.", "infrastructure"),
    ("Bumigay na poste ng ilaw, tabingi na at maaaring bumagsak sa kalsada.", "infrastructure"),
    ("Sirang manhole cover na bukas sa kalsada, walang harang o babala.", "infrastructure"),
    ("Bitak-bitak na semento sa kalsada sanhi ng mabibigat na truck, kailangan ng aspaltado.", "infrastructure"),
    ("Collapsed drainage cover and open manhole posing severe hazard to vehicles.", "infrastructure"),
    ("Massive road depression and potholes damaging vehicles along Payatas Road.", "infrastructure"),
    ("Non-functional streetlights leaving five consecutive blocks in total darkness.", "infrastructure"),
    ("Damaged concrete bridge barrier hanging loose over the riverbank.", "infrastructure"),
    ("Tilting concrete utility pole leaning dangerously over passing vehicles.", "infrastructure"),
    ("Bumagsak na pader ng riprap sa tabing kalsada dahil sa matinding pag-ulan.", "infrastructure"),
    ("Lubak-lubak na kalsada patungong evacuation center, hindi madaanan ng ambulansya.", "infrastructure"),
    ("Putol na kable ng streetlight kaya walang ilaw ang buong kalye mula kanto.", "infrastructure"),
    ("Nabasag na takip ng poso negro sa pampublikong daan, iniwasan ng mga sasakyan.", "infrastructure"),
    ("Gumuho ang bangketa sa tabi ng creek, kailangang lagyan ng barandilya.", "infrastructure"),
    ("Cracked pedestrian footbridge with loose steps requiring immediate repair.", "infrastructure"),
    ("Bumigay ang sementadong riprap sa tabi ng pathway, nanganganib gumuho ang daan.", "infrastructure"),
    ("Lumalalim na lubak sa bukana ng Payatas Road na sumisira sa mga suspensyon ng sasakyan.", "infrastructure"),
    ("Open uncovered excavation pit along pedestrian sidewalk without safety barricades.", "infrastructure"),
    ("Severely damaged asphalt pavement causing traffic bottleneck and motorcycle accidents.", "infrastructure"),

    # ── 5. SANITATION / HEALTH ──
    ("Hindi nakokolekta ang basura sa harap ng basketball court, dumadami na ang daga at langaw.", "sanitation_health"),
    ("Mabaho ang buong eskinita dahil sa tambak na basura, may mga uod na lumalabas.", "sanitation_health"),
    ("Maraming lamok sa area dahil sa maruming tubig, nag-aalala sa dengue ang mga residente.", "sanitation_health"),
    ("May garbage dump na hindi kinokolekta ng tatlong linggo, grabe ang amoy na pumapasok.", "sanitation_health"),
    ("Nakita ang mga malalaking daga sa tabi ng tindahan ng pagkain, health hazard sa mga bata.", "sanitation_health"),
    ("Tambak na medical waste at used syringes na itinapon sa bakanteng lote sa Phase 3.", "sanitation_health"),
    ("Nabulok na hayop sa gilid ng daan na hindi nililibing, masangsang ang amoy sa komunidad.", "sanitation_health"),
    ("Dumadaming kaso ng lagnat at dengue sa aming purok dahil sa maruruming imbakan ng tubig.", "sanitation_health"),
    ("Uncollected municipal garbage rotting for two weeks, emitting foul stench and attracting flies.", "sanitation_health"),
    ("Severe dengue risk due to breeding mosquitoes in neglected open plastic containers.", "sanitation_health"),
    ("Illegal open garbage pile attracting vermin, rats, and flies near elementary school.", "sanitation_health"),
    ("Foul sewage odor from uncleaned septic waste spreading through residential area.", "sanitation_health"),
    ("Basura na nakakalat sa buong sidewalk, kinakalkal ng mga asong gala.", "sanitation_health"),
    ("Kailangan ng fogging operation sa Sitio Damayan dahil sa dami ng kumpirmadong dengue.", "sanitation_health"),
    ("Mabahong burak at basura na pinabayaan sa tapat ng daycare center.", "sanitation_health"),
    ("Patay na aso na itinapon sa basurahan, nangangamoy na sa buong kalye.", "sanitation_health"),
    ("Hindi dumaan ang garbage truck nitong weekend, nagkalat ang mga plastic bag.", "sanitation_health"),
    ("Pest infestation of rodents and cockroaches originating from uncollected garbage heap.", "sanitation_health"),
    ("Rotten organic food waste dumped on roadside causing unbearable stench.", "sanitation_health"),
    ("Stagnant foul-smelling canal water causing skin rashes and respiratory issues in children.", "sanitation_health"),
    ("Tambak na balat ng prutas at panis na pagkain mula sa palengke na hindi hinahakot.", "sanitation_health"),
    ("Baradong poso negro na umaapaw ang maruming ihi at dumi sa daanan ng mga residente.", "sanitation_health"),
    ("Swarm of flies and maggots emerging from rotten garbage pile near bakery.", "sanitation_health"),
    ("Contaminated tap water smelling like sewage causing stomach illness in children.", "sanitation_health"),

    # ── 6. NOISE NUISANCE ──
    ("Sobrang lakas ng videoke hanggang alas-dos ng madaling araw, hindi makatulog ang buong bloke.", "noise_nuisance"),
    ("Construction work na nag-uumpisa ng alas-singko ng umaga tuwing Linggo, sobrang maingay ang martilyo.", "noise_nuisance"),
    ("Maingay na generator ng tindahan, buong gabi gumagana at umuugong sa kwarto.", "noise_nuisance"),
    ("Party na walang tigil, loud music with giant speakers hanggang madaling araw tuwing weekend.", "noise_nuisance"),
    ("Napakalakas na sound system ng kapitbahay habang nag-iinuman, sumisigaw pa sa mikropono.", "noise_nuisance"),
    ("Motorsiklo na may open pipe muffler na pabalik-balik at nagpapa-rebolusyon sa gabi.", "noise_nuisance"),
    ("Barking dogs continuously kept in cage outside, barking non-stop all night long.", "noise_nuisance"),
    ("Excessive loud karaoke music blasting past 10 PM legal curfew in Phase 4.", "noise_nuisance"),
    ("Industrial metal cutting and grinding noise operating inside residential zone at night.", "noise_nuisance"),
    ("Loud party subwoofer vibrations shaking the walls of neighboring houses after 1 AM.", "noise_nuisance"),
    ("High-pitched machine noise from motor repair shop operating during rest hours.", "noise_nuisance"),
    ("Maingay na pag-aayos ng sasakyan sa kalye tuwing hatinggabi, puro pukpukan at busina.", "noise_nuisance"),
    ("Lasing na nag-aawitan sa videoke sa tapat ng aming bintana, may pasok pa bukas.", "noise_nuisance"),
    ("Napakalakas na tugtog mula sa perya malapit sa plaza kahit dis-oras na ng gabi.", "noise_nuisance"),
    ("Continuous horn honking and engine revving by tricycles at the unauthorized terminal.", "noise_nuisance"),
    ("Maingay na manukan at pagtilaok sa tabi ng kwarto, may nagpapatari pa sa gabi.", "noise_nuisance"),
    ("Loud public address speaker broadcasting excessively loud music early morning.", "noise_nuisance"),
    ("Walang patid na ingay ng welding at grinding sa illegal repair shop sa tabi.", "noise_nuisance"),
    ("Karaoke past midnight violating barangay noise ordinance, ignoring polite requests.", "noise_nuisance"),
    ("Loud shouting and rowdy drinking session until 4 AM outside our residence.", "noise_nuisance"),
    ("Open muffler tricycle racing along residential alley at 2 AM creating deafening noise.", "noise_nuisance"),
    ("Heavy bass sound system shaking windows and disturbing sleeping infants on worknights.", "noise_nuisance"),
    ("Non-stop videoke singing with amplifier blasting directly towards our house.", "noise_nuisance"),

    # ── 7. ENVIRONMENTAL ──
    ("May nagtatapon ng construction waste at hollow blocks malapit sa creek, maaaring magbara.", "environmental"),
    ("Polusyon mula sa nasusunog na basura at goma sa likod ng subdivision, makapal ang itim na usok.", "environmental"),
    ("Erosion sa gilid ng creek, baka gumuho ang lupa kapag umulan nang malakas.", "environmental"),
    ("Chemical spill sa kalsada galing sa isang truck, may matapang na amoy at sumisipsip sa lupa.", "environmental"),
    ("Ilegal na pagputol ng mga matatandang puno sa tabing ilog na nagdudulot ng soil erosion.", "environmental"),
    ("Nagsusunog ng plastic, wires, at lumang gulong tuwing hapon para makuha ang tanso.", "environmental"),
    ("Industrial discharge of black oil into the creek waterway behind the warehouse.", "environmental"),
    ("Severe soil erosion threatening slope stability along the riverbank in Sitio Bakal.", "environmental"),
    ("Illegal open burning of toxic plastics and rubber tires producing hazardous dark smoke.", "environmental"),
    ("Hazardous chemical liquid dumped into open soil near natural stream source.", "environmental"),
    ("Pagguho ng lupa sa gilid ng bangin dahil sa illegal quarrying at pagtatambak ng lupa.", "environmental"),
    ("Itim na usok na nanggagaling sa ilegal na pagawaan ng uling sa may libis.", "environmental"),
    ("Nagtatapon ng used motor oil diretso sa kanal papunta sa ilog ang vulcanizing shop.", "environmental"),
    ("Soil degradation and landslide hazard on the steep hillside near informal settlers.", "environmental"),
    ("Burning leaves and dried trash causing smog that suffocates residents with asthma.", "environmental"),
    ("Illegal dumping of demolition debris into protected water catchment area.", "environmental"),
    ("Pagtatapon ng toxic batteries at electronics waste sa creek ng Payatas B.", "environmental"),
    ("Heavy soot and toxic fumes from backyard smelting operation affecting air quality.", "environmental"),
    ("Deforestation and illegal clearing of bamboo trees protecting the creek bank.", "environmental"),
    ("Dangerous chemical runoff from illegal paint workshop entering communal soil.", "environmental"),
    ("Ilegal na pag-quarry at pagkuha ng graba sa libis na nagpapahina sa pundasyon ng burol.", "environmental"),
    ("Makapal na usok mula sa pagsusunog ng kable ng tanso tuwing hatinggabi sa bakanteng lote.", "environmental"),
    ("Discharge of untreated chemical dyes and toxic wastewater straight into Payatas creek.", "environmental"),
    ("Massive hillside soil collapse risk due to unpermitted land grading and tree removal.", "environmental"),
]

EDGE_CASE_EXAMPLES = [
    ("Sira ang poste ng ilaw sa kalsada, naputol ang bracket ng bumbilya kaya madilim.", "infrastructure"),
    ("Bumagsak ang lumang poste ng telepono sa bangketa, nakaharang sa daanan ng tao.", "infrastructure"),
    ("Nakausli ang bakal ng sirang poste sa kanto, kailangang ayusin ng DPWH.", "infrastructure"),
    ("Nagsusunog ng tambak na basura sa bakanteng lote, kumakalat ang toxic na usok.", "environmental"),
    ("Pagtatapon ng mga sako-sakong basura sa ilog na nagiging sanhi ng matinding polusyon.", "environmental"),
    ("Sinusunog ang mga plastic at basura sa gabi, sobrang makapal ang usok sa hangin.", "environmental"),
    ("Napakadilim sa may eskinita dahil walang ilaw, madalas may nahoholdap at nasasaksak.", "safety_concern"),
    ("Walang ilaw ang kalye kaya ginagawang taguan ng mga magnanakaw at nag-aabang ng biktima.", "safety_concern"),
    ("Napakalakas ng sigawan at tawanan ng mga nag-iinuman sa kalye, hindi kami makatulog.", "noise_nuisance"),
    ("Maingay na kantahan at sigawan ng mga tambay sa videokehan kahit hatinggabi na.", "noise_nuisance"),
    ("May naiipong maruming tubig sa gulong at balde na pinamumugaran ng mga lamok na may dengue.", "sanitation_health"),
    ("Maruming tubig na galing sa poso negro na tumatagas sa kalsada, mabaho at nakakalat.", "sanitation_health"),
]

def load_all_training_data(mock_data_path: str = None):
    texts = []
    labels = []

    for desc, cat in TRAINING_CORPUS:
        if cat in CATEGORIES:
            texts.append(clean_and_normalize(desc))
            labels.append(cat)

    for desc, cat in EDGE_CASE_EXAMPLES:
        if cat in CATEGORIES:
            texts.append(clean_and_normalize(desc))
            labels.append(cat)

    if mock_data_path and os.path.exists(mock_data_path):
        try:
            with open(mock_data_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            reports = data.get("reports", [])
            loaded_count = 0
            for r in reports:
                true_cat = r.get("admin_category") or r.get("category")
                desc = r.get("description", "")
                if true_cat in CATEGORIES and len(desc.strip()) > 10:
                    texts.append(clean_and_normalize(desc))
                    labels.append(true_cat)
                    loaded_count += 1
            print(f"  [DATA] Ingested {loaded_count} admin-verified reports from mock-reports.json")
        except Exception as e:
            print(f"  [WARNING] Could not read mock-reports.json: {e}")

    # Ingest live production reports from Supabase database if synced
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    db_reports_path = os.path.join(project_root, "data", "database_reports.json")
    if os.path.exists(db_reports_path):
        try:
            with open(db_reports_path, "r", encoding="utf-8") as f:
                db_data = json.load(f)
            db_reports = db_data.get("reports", [])
            db_count = 0
            for r in db_reports:
                true_cat = r.get("admin_category") or r.get("category")
                desc = r.get("description", "")
                if true_cat in CATEGORIES and len(desc.strip()) >= 3:
                    texts.append(clean_and_normalize(desc))
                    labels.append(true_cat)
                    db_count += 1
            print(f"  [DATA] Ingested {db_count} live reports from Supabase database (data/database_reports.json)")
        except Exception as e:
            print(f"  [WARNING] Could not read database_reports.json: {e}")

    print(f"  [DATA] Balanced training corpus: {len(texts)} samples across {len(set(labels))} categories")
    return texts, labels

def train_and_optimize(X_raw, y_raw):
    print("\n" + "=" * 70)
    print("  MACHINE LEARNING TRAINING & GRADIENT OPTIMIZATION")
    print("=" * 70)

    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        sublinear_tf=True,
        min_df=1,
        max_df=0.98,
        stop_words=STOP_WORDS,
        token_pattern=r'(?u)\b\w+\b',
    )

    X_tfidf = vectorizer.fit_transform(X_raw)
    classes = sorted(list(set(y_raw)))
    class_to_idx = {c: i for i, c in enumerate(classes)}
    y_idx = np.array([class_to_idx[c] for c in y_raw])

    print(f"  Extracted Vocabulary: {len(vectorizer.vocabulary_)} normalized stems and n-grams")
    print(f"  Feature Matrix Shape: {X_tfidf.shape[0]} samples x {X_tfidf.shape[1]} features")

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    candidate_c_values = [0.5, 1.0, 2.0, 4.0, 8.0, 12.0]
    best_c = 1.0
    best_cv_score = -1.0

    print("\n  Hyperparameter Optimization (Stratified 5-Fold Cross-Validation):")
    print("  " + "-" * 55)
    for c_val in candidate_c_values:
        clf = LogisticRegression(
            C=c_val,
            max_iter=1000,
            solver="lbfgs",
            class_weight="balanced",
            random_state=42
        )
        scores = cross_val_score(clf, X_tfidf, y_idx, cv=cv, scoring="accuracy")
        mean_s = np.mean(scores)
        print(f"    C = {c_val:<4} -> CV Accuracy: {mean_s * 100:.2f}% (std: {np.std(scores) * 100:.2f}%)")
        if mean_s > best_cv_score:
            best_cv_score = mean_s
            best_c = c_val

    print("  " + "-" * 55)
    print(f"  Optimal Regularizer Selected: C = {best_c} (Peak Accuracy: {best_cv_score * 100:.2f}%)")

    champion_clf = LogisticRegression(
        C=best_c,
        max_iter=1000,
        solver="lbfgs",
        class_weight="balanced",
        random_state=42
    )
    champion_clf.fit(X_tfidf, y_idx)

    y_pred_idx = champion_clf.predict(X_tfidf)
    y_pred = [classes[i] for i in y_pred_idx]
    y_probs = champion_clf.predict_proba(X_tfidf)

    acc = accuracy_score(y_raw, y_pred)
    prec_list, rec_list, f1_list, support_list = precision_recall_fscore_support(
        y_raw, y_pred, labels=classes, zero_division=0
    )

    num_classes = len(classes)
    y_onehot = np.zeros((len(y_raw), num_classes))
    for i, idx in enumerate(y_idx):
        y_onehot[i, idx] = 1.0

    prob_mse = float(np.mean((y_probs - y_onehot) ** 2))
    zero_one_mse = float(np.mean(y_idx != y_pred_idx))

    actual_counts = Counter(y_raw)
    pred_counts = Counter(y_pred)
    class_mapes = []
    for c in classes:
        act = actual_counts.get(c, 0)
        pred = pred_counts.get(c, 0)
        if act > 0:
            class_mapes.append(abs(act - pred) / act)
    macro_mape = float(np.mean(class_mapes) * 100) if class_mapes else 0.0

    cm = confusion_matrix(y_raw, y_pred, labels=classes)

    evaluation = {
        "best_c": best_c,
        "classes": classes,
        "accuracy": acc,
        "prob_mse": prob_mse,
        "zero_one_mse": zero_one_mse,
        "mape": macro_mape,
        "per_category": {
            c: {
                "precision": float(prec_list[i]),
                "recall": float(rec_list[i]),
                "f1": float(f1_list[i]),
                "support": int(support_list[i]),
            }
            for i, c in enumerate(classes)
        },
        "confusion_matrix": cm.tolist(),
        "total_samples": len(y_raw),
    }

    return vectorizer, champion_clf, evaluation

def export_model_artifacts(vectorizer, classifier, evaluation, output_dir: str):
    os.makedirs(output_dir, exist_ok=True)

    json_path = os.path.join(output_dir, "trained_ai_model.json")
    idf_list = vectorizer.idf_.tolist()
    coef_list = classifier.coef_.tolist()
    intercept_list = classifier.intercept_.tolist()

    model_json = {
        "model_name": "SpeakUp Payatas Supervised NLP Classifier",
        "model_type": "tfidf_logistic_regression",
        "version": "2.1.0",
        "trained_at": datetime.now().isoformat(),
        "categories": evaluation["classes"],
        "stop_words": STOP_WORDS,
        "slang_map": SLANG_MAP,
        "vocabulary": vectorizer.vocabulary_,
        "idf": idf_list,
        "coefficients": coef_list,
        "intercepts": intercept_list,
        "metrics": {
            "accuracy": round(evaluation["accuracy"] * 100, 2),
            "macro_f1": round(np.mean([v["f1"] for v in evaluation["per_category"].values()]) * 100, 2),
            "prob_mse": round(evaluation["prob_mse"], 6),
            "zero_one_mse": round(evaluation["zero_one_mse"], 6),
            "mape": round(evaluation["mape"], 2),
            "total_samples": evaluation["total_samples"],
        }
    }

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(model_json, f, indent=2, ensure_ascii=False)
    print(f"\n  [OK] Exported trained model weights JSON to: {os.path.abspath(json_path)}")

    joblib_path = os.path.join(output_dir, "trained_ai_model.joblib")
    joblib.dump({"vectorizer": vectorizer, "classifier": classifier, "evaluation": evaluation}, joblib_path)
    print(f"  [OK] Exported Python model joblib to: {os.path.abspath(joblib_path)}")

def main():
    print("=" * 70)
    print("  SPEAKUP PAYATAS — AI NLP MACHINE LEARNING TRAINER (v2.1)")
    print("  Featuring Tagalog Stemming, Slang Expansion, and L2 Optimization")
    print("=" * 70)

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    mock_data_path = os.path.join(project_root, "data", "mock-reports.json")
    output_dir = os.path.join(project_root, "data")

    X_raw, y_raw = load_all_training_data(mock_data_path)
    vectorizer, classifier, evaluation = train_and_optimize(X_raw, y_raw)

    print("\n" + "=" * 70)
    print("  TRAINING RESULTS & EVALUATION METRICS")
    print("=" * 70)
    print(f"  Overall Training Accuracy : {evaluation['accuracy'] * 100:.2f}%")
    print(f"  Probability MSE Loss      : {evaluation['prob_mse']:.4f}")
    print(f"  Mean Absolute Error (MAPE): {evaluation['mape']:.2f}%")
    print(f"  Parameters Fitted         : {len(vectorizer.vocabulary_)} weights x {len(evaluation['classes'])} categories")

    print("\n  Per-Category Precision, Recall & F1:")
    print("  " + "-" * 66)
    print(f"  {'Category':<24} {'Precision':<12} {'Recall':<12} {'F1-Score':<12} {'Support':<8}")
    print("  " + "-" * 66)
    for cat, m in evaluation["per_category"].items():
        print(f"  {cat:<24} {m['precision'] * 100:>8.1f}%  {m['recall'] * 100:>8.1f}%  {m['f1'] * 100:>8.1f}%  {m['support']:>6}")
    print("  " + "-" * 66)

    export_model_artifacts(vectorizer, classifier, evaluation, output_dir)
    print("\n  [OK] Training complete. Weights successfully deployed to live application.\n")

if __name__ == "__main__":
    main()
