/**
 * What happened, and when — the demo dataset's timeline as data.
 *
 * Every row here is a **script for real writers**, never a row to insert. The
 * runner turns each `day` field into one call to the function a screen calls:
 * `createProject`, `createQuotationThread`, `issueVersion`, `acceptThread`,
 * `requestDispatch`, `approveDispatchRequest` and the rest. Nothing in this
 * file names a column, a status or an end state directly, because nothing
 * here is allowed to reach one except through the act that produces it.
 *
 * **Days are days before today.** They run oldest-first, so a thread raised on
 * day 96 and issued on day 90 is exactly that order; the runner refuses a row
 * whose acts go forwards in time, because that would be a thread issued before
 * it was raised.
 *
 * The coverage this file is shaped around:
 *
 *  - every `PROJECT_STATES` value — won (derived from an approved dispatch
 *    `S31`), lost, committed, open — and every `CHAIN_COLUMNS` position, plus
 *    `closed`, which `D29` keeps off the board
 *  - every quotation state a screen can draw: `requested`, `issued`,
 *    `superseded`, returned for edits, accepted, rejected, cancelled — and one
 *    thread carried to **three versions**, so "the latest live version" `S68`
 *    means something. There is no paid state: `S133` took payment off the
 *    quotation entirely, and `S70` records it on the dispatch instead
 *  - `S75`'s three dispatch routes in roughly equal thirds, `S120`'s
 *    difference on both sides of submission, and every `dispatch_status`
 */

import type { PaymentMethod, ShipmentMethod, Stock } from "@/lib/enums";

import type { PersonKey } from "./people";

/* ------------------------------------------------------------------ *
 * Projects `S24` — a first-class record, not a child of a company
 * ------------------------------------------------------------------ */

export type ProjectRow = {
  key: string;
  nameEn: string;
  nameAr: string;
  owner: PersonKey;
  /** Participants `S25`. The first is the one that quotes and dispatches. */
  companies: readonly string[];
  city: string | null;
  /** The rep's estimate — `S29`'s anchor number. */
  sqmExpected: string | null;
  /** Days ago the rep registered it. */
  age: number;
  /** `S29`'s second item — a plain label, deliberately unverified. */
  inProduction?: number;
  /** `S29`'s fifth — the customer agreed, ahead of any dispatch `S31`. */
  committed?: number;
  /** `S29`'s fourth — closes it. `other` requires `detail` `[25 §5]`. */
  lost?: { day: number; code: string; detail?: string };
};

export const PROJECTS: readonly ProjectRow[] = [
  /* --- Faisal ------------------------------------------------------- */
  {
    key: "P01",
    nameEn: "Al Malqa administrative offices",
    nameAr: "مكاتب إدارية - حي الملقا",
    owner: "faisal",
    companies: ["شركة أنماء للمقاولات", "مكتب المعمار الحديث للاستشارات الهندسية"],
    city: "Riyadh",
    sqmExpected: "244",
    age: 112,
  },
  {
    key: "P02",
    nameEn: "King Fahd Road office tower",
    nameAr: "برج مكاتب طريق الملك فهد",
    owner: "faisal",
    companies: ["شركة تمكين للمقاولات"],
    city: "Riyadh",
    sqmExpected: "2400",
    age: 99,
    inProduction: 40,
  },
  {
    key: "P03",
    nameEn: "Diriyah private villa",
    nameAr: "فيلا خاصة - الدرعية",
    owner: "faisal",
    companies: ["شركة رؤى العمران للمقاولات"],
    city: "Ad Diriyah",
    sqmExpected: "210",
    age: 103,
    committed: 60,
  },
  {
    key: "P04",
    nameEn: "Al Kharj road stations",
    nameAr: "محطات طريق الخرج",
    owner: "faisal",
    companies: ["شركة محطات الطريق لإدارة المحطات"],
    city: "Al Kharj",
    sqmExpected: "380",
    age: 86,
  },
  {
    key: "P05",
    nameEn: "Private hospital facade",
    nameAr: "واجهة مستشفى خاص",
    owner: "faisal",
    companies: ["شركة الحصن للمقاولات العامة"],
    city: "Riyadh",
    sqmExpected: "950",
    age: 92,
    lost: { day: 34, code: "price_too_high" },
  },
  {
    key: "P06",
    nameEn: "Commercial complex refurbishment",
    nameAr: "تجديد مجمع تجاري",
    owner: "faisal",
    companies: ["شركة أملاك المستقبل العقارية"],
    city: "Riyadh",
    sqmExpected: "640",
    age: 94,
  },
  {
    key: "P07",
    nameEn: "Qassim private school",
    nameAr: "مدرسة أهلية - القصيم",
    owner: "faisal",
    companies: ["شركة مداد العمار للمقاولات"],
    city: "Buraydah",
    sqmExpected: "410",
    age: 68,
  },
  {
    key: "P08",
    nameEn: "Twenty-two storey residential tower",
    nameAr: "برج سكني اثنان وعشرون دوراً",
    owner: "faisal",
    companies: ["شركة النهضة للمقاولات", "مصنع الرواد للألمنيوم"],
    city: "Riyadh",
    sqmExpected: "2850",
    age: 41,
    committed: 12,
  },
  {
    key: "P09",
    nameEn: "Warehouse cladding, Second Industrial",
    nameAr: "تكسية مستودعات - الصناعية الثانية",
    owner: "faisal",
    companies: ["شركة الأمانة للمقاولات"],
    city: "Riyadh",
    sqmExpected: "520",
    age: 50,
  },
  {
    key: "P10",
    nameEn: "Three villas, Al Yasmin",
    nameAr: "ثلاث فلل - حي الياسمين",
    owner: "faisal",
    companies: ["شركة قصور الرياض"],
    city: "Riyadh",
    sqmExpected: "540",
    age: 37,
  },
  {
    key: "P11",
    nameEn: "Car showroom facade, Buraydah",
    nameAr: "واجهة معرض سيارات - بريدة",
    owner: "faisal",
    companies: ["شركة الياقوت للمقاولات"],
    city: "Buraydah",
    sqmExpected: "320",
    age: 25,
  },
  {
    key: "P12",
    nameEn: "Tabuk factory extension",
    nameAr: "توسعة مصنع تبوك",
    owner: "faisal",
    companies: ["مصنع تبوك الحديثة للألمنيوم"],
    city: "Tabuk",
    sqmExpected: "260",
    age: 64,
    lost: { day: 20, code: "delivery_time_too_long" },
  },
  {
    key: "P13",
    nameEn: "Hotel facade, Northern Ring Road",
    nameAr: "واجهة فندق - الدائري الشمالي",
    owner: "faisal",
    companies: ["شركة واجهات المملكة للمقاولات"],
    city: "Riyadh",
    sqmExpected: "1150",
    age: 3,
  },
  {
    key: "P14",
    nameEn: "Rest house facade, Al Ammariyah",
    nameAr: "واجهة استراحة - العمارية",
    owner: "faisal",
    companies: ["فهد بن عبدالله العتيبي"],
    city: "Riyadh",
    sqmExpected: "95",
    age: 12,
  },
  {
    key: "P15",
    nameEn: "Three residential compounds",
    nameAr: "ثلاثة مجمعات سكنية",
    owner: "faisal",
    companies: ["شركة ناصر بن عبدالله الحقباني للاستثمار والتطوير العقاري"],
    city: "Riyadh",
    sqmExpected: "3100",
    age: 7,
  },
  {
    key: "P16",
    nameEn: "Al Majma'ah municipality building",
    nameAr: "مبنى بلدية المجمعة",
    owner: "faisal",
    companies: ["مؤسسة ركائز البناء"],
    city: "Al Majma'ah",
    sqmExpected: "300",
    age: 88,
    lost: {
      day: 44,
      code: "other",
      detail: "المالك قرر تأجيل المشروع سنة كاملة لأسباب تخص التمويل",
    },
  },
  {
    key: "P17",
    nameEn: "Branch signage programme",
    nameAr: "برنامج لوحات الفروع",
    owner: "faisal",
    companies: ["شركة رسم للدعاية والإعلان"],
    city: "Riyadh",
    sqmExpected: "180",
    age: 44,
  },
  {
    key: "P18",
    nameEn: "Doors and windows supply, Q4",
    nameAr: "توريد أبواب ونوافذ - الربع الأخير",
    owner: "faisal",
    companies: ["مصنع الرياض للأبواب والنوافذ"],
    city: "Riyadh",
    sqmExpected: "165",
    age: 21,
  },
  {
    key: "P19",
    nameEn: "Al Zulfi station canopies",
    nameAr: "مظلات محطة الزلفي",
    owner: "faisal",
    companies: ["مؤسسة واحة الوقود لإدارة المحطات"],
    city: "Az Zulfi",
    sqmExpected: "160",
    age: 53,
  },
  {
    key: "P20",
    nameEn: "Ha'il contractor framework",
    nameAr: "اتفاقية إطارية - حائل",
    owner: "faisal",
    companies: ["مؤسسة درب الشمال للمقاولات"],
    city: "Ha'il",
    sqmExpected: "450",
    age: 65,
  },
  {
    key: "P21",
    nameEn: "Workshop offcuts, standing order",
    nameAr: "بواقي ورشة - طلب دائم",
    owner: "faisal",
    companies: ["ورشة الإتقان للتشكيل المعدني"],
    city: "Riyadh",
    sqmExpected: null,
    age: 16,
  },
  {
    key: "P22",
    nameEn: "Al Muzahimiyah panel supply",
    nameAr: "توريد ألواح - المزاحمية",
    owner: "faisal",
    companies: ["مصنع البيان للتشكيل المعدني"],
    city: "Al Muzahimiyah",
    sqmExpected: "250",
    age: 75,
  },
  {
    key: "P23",
    nameEn: "Al Nakheel showroom signage",
    nameAr: "لوحات معرض النخيل",
    owner: "faisal",
    companies: ["مؤسسة نبض للدعاية والإعلان"],
    city: "Riyadh",
    sqmExpected: "72",
    age: 79,
  },

  /* --- Saad --------------------------------------------------------- */
  {
    key: "P24",
    nameEn: "Port administration building",
    nameAr: "مبنى إدارة الميناء",
    owner: "saad",
    companies: ["شركة مرافئ الدمام للمقاولات"],
    city: "Dammam",
    sqmExpected: "780",
    age: 102,
    inProduction: 30,
  },
  {
    key: "P25",
    nameEn: "Corniche residential towers",
    nameAr: "أبراج سكنية على الكورنيش",
    owner: "saad",
    companies: ["شركة الشاطئ الأزرق للمقاولات", "مصنع الخليج الأول للألمنيوم"],
    city: "Al Khobar",
    sqmExpected: "2150",
    age: 55,
    committed: 18,
  },
  {
    key: "P26",
    nameEn: "Al Ahsa schools, three phases",
    nameAr: "مدارس الأحساء - ثلاث مراحل",
    owner: "saad",
    companies: ["شركة الربيع للمقاولات العامة"],
    city: "Hofuf",
    sqmExpected: "940",
    age: 80,
  },
  {
    key: "P27",
    nameEn: "Jubail road stations, five sites",
    nameAr: "محطات طريق الجبيل - خمسة مواقع",
    owner: "saad",
    companies: ["شركة مسار لإدارة المحطات"],
    city: "Dammam",
    sqmExpected: "1050",
    age: 67,
  },
  {
    key: "P28",
    nameEn: "Khobar shopping centre",
    nameAr: "مركز تجاري - الخبر",
    owner: "saad",
    companies: ["Silver Line Contracting"],
    city: "Al Khobar",
    sqmExpected: "1320",
    age: 36,
  },
  {
    key: "P29",
    nameEn: "Office block refurbishment",
    nameAr: "تجديد مبنى مكاتب",
    owner: "saad",
    companies: ["مجموعة الرمال القابضة"],
    city: "Al Khobar",
    sqmExpected: "690",
    age: 24,
  },
  {
    key: "P30",
    nameEn: "Private hospital, Dammam",
    nameAr: "مستشفى خاص - الدمام",
    owner: "saad",
    companies: ["شركة الرافد للمقاولات"],
    city: "Dammam",
    sqmExpected: "1480",
    age: 11,
  },
  {
    key: "P31",
    nameEn: "Qatif factory panels",
    nameAr: "ألواح مصنع القطيف",
    owner: "saad",
    companies: ["مصنع صدف للصناعات المعدنية"],
    city: "Qatif",
    sqmExpected: "300",
    age: 84,
    lost: { day: 30, code: "lost_to_competitor" },
  },
  {
    key: "P32",
    nameEn: "Jubail contractor framework",
    nameAr: "اتفاقية إطارية - الجبيل",
    owner: "saad",
    companies: ["شركة بوابة الشرق للمقاولات"],
    city: "Jubail",
    sqmExpected: "600",
    age: 108,
  },
  {
    key: "P33",
    nameEn: "Restaurant signage, Khobar",
    nameAr: "لوحات مطاعم - الخبر",
    owner: "saad",
    companies: ["مؤسسة ألوان الشرق للدعاية والإعلان"],
    city: "Al Khobar",
    sqmExpected: "55",
    age: 88,
  },
  {
    key: "P34",
    nameEn: "Ras Tanura panel supply",
    nameAr: "توريد ألواح - رأس تنورة",
    owner: "saad",
    companies: ["مصنع الساحل للألمنيوم"],
    city: "Ras Tanura",
    sqmExpected: "420",
    age: 59,
  },
  {
    key: "P35",
    nameEn: "Al Mubarraz batch order",
    nameAr: "طلب دفعات - المبرز",
    owner: "saad",
    companies: ["مصنع النخبة للتشكيل المعدني"],
    city: "Al Mubarraz",
    sqmExpected: "350",
    age: 47,
  },

  /* --- Majed -------------------------------------------------------- */
  {
    key: "P36",
    nameEn: "Madinah Road office tower",
    nameAr: "برج مكاتب طريق المدينة",
    owner: "majed",
    companies: ["شركة صروح جدة للمقاولات", "مصنع البحر الأحمر للألمنيوم"],
    city: "Jeddah",
    sqmExpected: "2600",
    age: 110,
    inProduction: 26,
  },
  {
    key: "P37",
    nameEn: "Jeddah hills residential compound",
    nameAr: "مجمع سكني - تلال جدة",
    owner: "majed",
    companies: ["شركة تلال جدة للمقاولات"],
    city: "Jeddah",
    sqmExpected: "1050",
    age: 98,
  },
  {
    key: "P38",
    nameEn: "Corniche hotel refurbishment",
    nameAr: "تجديد فندق الكورنيش",
    owner: "majed",
    companies: ["شركة مراسي جدة"],
    city: "Jeddah",
    sqmExpected: "1900",
    age: 81,
    committed: 22,
  },
  {
    key: "P39",
    nameEn: "Yanbu first order",
    nameAr: "أول طلب - ينبع",
    owner: "majed",
    companies: ["مصنع الينابيع للصناعات المعدنية"],
    city: "Yanbu",
    sqmExpected: "240",
    age: 42,
  },
  {
    key: "P40",
    nameEn: "Jeddah towers, design pending",
    nameAr: "أبراج جدة - بانتظار التصميم",
    owner: "majed",
    companies: ["شركة مرافئ العقارية"],
    city: "Jeddah",
    sqmExpected: "2400",
    age: 8,
  },
  {
    key: "P41",
    nameEn: "Madinah factory supply",
    nameAr: "توريد مصنع المدينة",
    owner: "majed",
    companies: ["مصنع الأصالة للألمنيوم"],
    city: "Madinah",
    sqmExpected: "310",
    age: 63,
    lost: { day: 26, code: "colour_or_product_unavailable" },
  },

  /* --- Turki -------------------------------------------------------- */
  {
    key: "P42",
    nameEn: "Abha municipality building",
    nameAr: "مبنى بلدية أبها",
    owner: "turki",
    companies: ["شركة ديار الجنوب للمقاولات"],
    city: "Abha",
    sqmExpected: "520",
    age: 96,
  },
  {
    key: "P43",
    nameEn: "Jazan corniche project",
    nameAr: "مشروع كورنيش جازان",
    owner: "turki",
    companies: ["شركة الياسمين للمقاولات"],
    city: "Jazan",
    sqmExpected: "640",
    age: 45,
  },
  {
    key: "P44",
    nameEn: "Mountain resort, Asir",
    nameAr: "منتجع جبلي - عسير",
    owner: "turki",
    companies: ["شركة جبال السروات للمقاولات"],
    city: "Abha",
    sqmExpected: "830",
    age: 15,
    committed: 4,
  },
  {
    key: "P45",
    nameEn: "Bisha road station",
    nameAr: "محطة طريق بيشة",
    owner: "turki",
    companies: ["مؤسسة الطريق السريع لإدارة المحطات"],
    city: "Bisha",
    sqmExpected: "175",
    age: 60,
  },

  /* --- Nouf `S127` -------------------------------------------------- */
  {
    key: "P46",
    nameEn: "Office signage, direct account",
    nameAr: "لوحات مكتبية - حساب مباشر",
    owner: "nouf",
    companies: ["شركة لمسات للدعاية والإعلان"],
    city: "Riyadh",
    sqmExpected: "80",
    age: 90,
  },

  /* --- no quotation at all: `D29`'s first column, `new` ------------- */
  {
    key: "P47",
    nameEn: "Commercial building, Al Narjis",
    nameAr: "مبنى تجاري - حي النرجس",
    owner: "faisal",
    companies: ["شركة الرافدين للمقاولات"],
    city: "Riyadh",
    sqmExpected: "460",
    age: 11,
  },
  {
    key: "P48",
    nameEn: "Warehouse extension, Jubail",
    nameAr: "توسعة مستودع - الجبيل",
    owner: "saad",
    companies: ["مؤسسة حصاد البناء"],
    city: "Jubail",
    sqmExpected: "380",
    age: 27,
  },
  {
    key: "P49",
    nameEn: "Showroom refit, Madinah",
    nameAr: "تجديد صالة عرض - المدينة",
    owner: "majed",
    companies: ["مؤسسة الأفنان للتجارة"],
    city: "Madinah",
    sqmExpected: "150",
    age: 55,
  },
  /*
   * **This project exists so `S132`'s *With the customer* pile is not empty**,
   * and that is the whole of its job.
   *
   * The pile is the longest wait in the business — a quotation accepted `S65`
   * and the customer deciding, days to months — and until this row the dataset
   * never produced one. Measured before it was added: all 19 projects carrying
   * an accepted thread also carried an approved dispatch **from that same
   * thread**, so furthest-along-wins `S132` read every one of them as Won and
   * the column rendered its zero on every identity. A pile nobody can see
   * working is a pile nobody can judge.
   *
   * So `T61` below is accepted and has NO dispatch, on a project no other
   * thread touches, held by `faisal` so the pile is non-empty for a rep as well
   * as for the manager and the coordinator.
   */
  {
    key: "P50",
    nameEn: "Buraydah retail frontage",
    nameAr: "واجهة محلات تجارية - بريدة",
    owner: "faisal",
    companies: ["شركة البنيان الراسخ للمقاولات"],
    city: "Buraydah",
    sqmExpected: "540",
    age: 80,
  },
] as const;

/* ------------------------------------------------------------------ *
 * Quotation threads `S52` — raised as version 1, `requested`, no SMAC
 * ------------------------------------------------------------------ */

/**
 * One thread's whole life as day numbers. A field that is absent is an act
 * that never happened; there is no status to set and no state to name.
 *
 * `raised` < every other day is enforced by the runner, because a thread
 * issued before it was raised is not a fixture, it is a bug.
 */
export type ThreadRow = {
  key: string;
  company: string;
  /** Null exercises `S50` — quote first, project at dispatch `S74`. */
  project: string | null;
  /** Name the company's contact where it has one. */
  contact?: boolean;
  stock: Stock;
  /** Target square metres for the whole quotation `S55`. */
  sqm: number;
  /** How many product lines `S53`; always at least one `S60`. */
  lines: number;
  /** Service lines `S59` — their sqm is excluded from the total. */
  services?: number;
  /** Leave the last line with no price `S58`. */
  unpriced?: boolean;
  raised: number;
  /** `S62` — the coordinator hands it back with a written reason. */
  returned?: number;
  /** `S66` — each entry supersedes the one before it. */
  revisions?: readonly number[];
  /**
   * Which route produced the revision `[07 C2]`. The rep asking for a change
   * is the ordinary case; the coordinator editing directly is the other, and
   * without one thread taking it `coordinator_direct_edit` would be an enum
   * value nothing in the dataset can reach.
   */
  revisedBy?: "rep" | "coordinator";
  /** `S63` — the coordinator types the SMAC number back. */
  issued?: number;
  /** `S65` — internal approval, never a won deal. */
  accepted?: number;
  rejected?: number;
  cancelled?: number;
};

export const THREADS: readonly ThreadRow[] = [
  /* --- live and still the rep's to edit `S61` ----------------------- */
  { key: "T01", company: "شركة أنماء للمقاولات", project: "P01", contact: true, stock: "riyadh", sqm: 244, lines: 2, raised: 104 },
  { key: "T02", company: "مصنع البيان للتشكيل المعدني", project: "P22", stock: "malham", sqm: 250, lines: 1, raised: 70 },
  { key: "T03", company: "مؤسسة نبض للدعاية والإعلان", project: "P23", stock: "riyadh", sqm: 72, lines: 1, raised: 74 },
  { key: "T04", company: "مصنع الساحل للألمنيوم", project: "P34", stock: "dammam", sqm: 420, lines: 2, raised: 54 },
  { key: "T05", company: "مؤسسة الطريق السريع لإدارة المحطات", project: "P45", contact: true, stock: "south", sqm: 175, lines: 2, raised: 57 },
  { key: "T06", company: "مصنع الرياض للأبواب والنوافذ", project: "P18", contact: true, stock: "riyadh", sqm: 165, lines: 2, unpriced: true, raised: 19 },

  /* --- recent, multi-line, editable: `verify:routes` §17's fodder --- */
  { key: "T07", company: "شركة واجهات المملكة للمقاولات", project: "P13", contact: true, stock: "riyadh", sqm: 1150, lines: 3, raised: 3 },
  { key: "T08", company: "شركة ناصر بن عبدالله الحقباني للاستثمار والتطوير العقاري", project: "P15", contact: true, stock: "riyadh", sqm: 3100, lines: 4, raised: 6 },
  { key: "T09", company: "فهد بن عبدالله العتيبي", project: "P14", stock: "malham", sqm: 95, lines: 3, raised: 10 },
  { key: "T10", company: "شركة الرافد للمقاولات", project: "P30", contact: true, stock: "dammam", sqm: 1480, lines: 3, raised: 9 },
  { key: "T11", company: "شركة مرافئ العقارية", project: "P40", contact: true, stock: "riyadh", sqm: 2400, lines: 3, raised: 5 },
  { key: "T12", company: "شركة جبال السروات للمقاولات", project: "P44", contact: true, stock: "south", sqm: 830, lines: 3, raised: 13 },

  /* --- returned for edits and not resubmitted `S62` ----------------- */
  { key: "T13", company: "شركة معالم الرياض للمقاولات", project: null, stock: "riyadh", sqm: 300, lines: 2, raised: 62, returned: 46 },
  { key: "T14", company: "مؤسسة حصاد البناء", project: null, stock: "dammam", sqm: 280, lines: 2, raised: 30, returned: 21 },
  { key: "T15", company: "مؤسسة إتقان التعمير", project: null, contact: true, stock: "riyadh", sqm: 340, lines: 2, raised: 17, returned: 11 },

  /* --- carrying a service line `S59` -------------------------------- */
  { key: "T16", company: "شركة الياقوت للمقاولات", project: "P11", contact: true, stock: "riyadh", sqm: 320, lines: 2, services: 2, raised: 24 },
  { key: "T17", company: "مصنع الشعلة للألمنيوم", project: null, contact: true, stock: "malham", sqm: 400, lines: 2, services: 1, raised: 5 },

  /* --- issued, awaiting signature `D29` ----------------------------- */
  { key: "T18", company: "شركة تمكين للمقاولات", project: "P02", stock: "riyadh", sqm: 2400, lines: 3, raised: 97, issued: 93 },
  { key: "T19", company: "شركة محطات الطريق لإدارة المحطات", project: "P04", contact: true, stock: "riyadh", sqm: 380, lines: 2, raised: 84, issued: 78 },
  { key: "T20", company: "شركة الربيع للمقاولات العامة", project: "P26", contact: true, stock: "dammam", sqm: 940, lines: 3, raised: 78, issued: 72 },
  { key: "T21", company: "شركة مسار لإدارة المحطات", project: "P27", contact: true, stock: "dammam", sqm: 1050, lines: 2, raised: 65, issued: 58 },
  { key: "T22", company: "شركة تلال جدة للمقاولات", project: "P37", stock: "riyadh", sqm: 1050, lines: 2, raised: 95, issued: 88 },
  { key: "T23", company: "شركة ديار الجنوب للمقاولات", project: "P42", contact: true, stock: "south", sqm: 520, lines: 2, raised: 93, issued: 86 },
  { key: "T24", company: "مصنع الينابيع للصناعات المعدنية", project: "P39", contact: true, stock: "riyadh", sqm: 240, lines: 1, raised: 40, issued: 34 },
  { key: "T25", company: "مؤسسة درب الشمال للمقاولات", project: "P20", stock: "malham", sqm: 450, lines: 2, raised: 63, issued: 55 },
  { key: "T26", company: "شركة الأمانة للمقاولات", project: "P09", contact: true, stock: "riyadh", sqm: 520, lines: 2, raised: 48, issued: 42 },
  { key: "T27", company: "مؤسسة واحة الوقود لإدارة المحطات", project: "P19", stock: "riyadh", sqm: 160, lines: 1, raised: 51, issued: 44 },

  /* --- accepted: the coordinator has the signatures `S65` ----------- */
  { key: "T28", company: "شركة رؤى العمران للمقاولات", project: "P03", contact: true, stock: "riyadh", sqm: 210, lines: 2, raised: 100, issued: 94, accepted: 88 },
  { key: "T29", company: "شركة قصور الرياض", project: "P10", contact: true, stock: "riyadh", sqm: 540, lines: 3, raised: 35, issued: 29, accepted: 23 },
  { key: "T30", company: "شركة الشاطئ الأزرق للمقاولات", project: "P25", contact: true, stock: "dammam", sqm: 2150, lines: 3, raised: 52, issued: 45, accepted: 38 },
  { key: "T31", company: "مجموعة الرمال القابضة", project: "P29", stock: "dammam", sqm: 690, lines: 2, raised: 22, issued: 16, accepted: 9 },
  { key: "T32", company: "شركة مراسي جدة", project: "P38", contact: true, stock: "riyadh", sqm: 1900, lines: 3, raised: 76, issued: 70, accepted: 62 },
  { key: "T33", company: "شركة رسم للدعاية والإعلان", project: "P17", stock: "riyadh", sqm: 180, lines: 2, raised: 42, issued: 36, accepted: 28 },

  /* --- accepted, with a dispatch behind them `S132` ------------------ */
  { key: "T34", company: "مؤسسة إبداع للدعاية والإعلان", project: null, stock: "riyadh", sqm: 90, lines: 1, raised: 90, issued: 84, accepted: 79 },
  { key: "T35", company: "شركة البناء المتين للمقاولات", project: null, contact: true, stock: "riyadh", sqm: 380, lines: 2, raised: 82, issued: 76, accepted: 70 },
  { key: "T36", company: "مصنع النخبة للتشكيل المعدني", project: "P35", stock: "dammam", sqm: 350, lines: 2, raised: 44, issued: 38, accepted: 32 },
  { key: "T37", company: "Silver Line Contracting", project: "P28", contact: true, stock: "riyadh", sqm: 1320, lines: 3, raised: 33, issued: 27, accepted: 20 },
  { key: "T38", company: "شركة الياسمين للمقاولات", project: "P43", contact: true, stock: "south", sqm: 640, lines: 2, raised: 43, issued: 37, accepted: 31 },

  /* --- accepted, shipped, and still open `S77` ---------------------- */
  { key: "T39", company: "مصنع سدرة للصناعات المعدنية", project: null, contact: true, stock: "riyadh", sqm: 480, lines: 2, raised: 110, issued: 105, accepted: 100 },
  { key: "T40", company: "مصنع درة الشرق للصناعة", project: null, contact: true, stock: "dammam", sqm: 600, lines: 2, raised: 112, issued: 107, accepted: 102 },
  { key: "T41", company: "unico aluminum factory", project: null, contact: true, stock: "riyadh", sqm: 700, lines: 2, raised: 91, issued: 85, accepted: 80 },

  /* --- rejected `S62` ----------------------------------------------- */
  { key: "T42", company: "شركة الحصن للمقاولات العامة", project: "P05", contact: true, stock: "riyadh", sqm: 950, lines: 3, raised: 88, issued: 82, rejected: 40 },
  { key: "T43", company: "مصنع صدف للصناعات المعدنية", project: "P31", stock: "dammam", sqm: 300, lines: 2, raised: 80, issued: 74, rejected: 35 },
  { key: "T44", company: "مصنع الأصالة للألمنيوم", project: "P41", contact: true, stock: "riyadh", sqm: 310, lines: 2, raised: 60, issued: 54, rejected: 30 },
  { key: "T45", company: "مؤسسة ركائز البناء", project: "P16", contact: true, stock: "malham", sqm: 300, lines: 2, raised: 85, issued: 79, rejected: 47 },

  /* --- cancelled after signature `S62` ------------------------------ */
  { key: "T46", company: "مصنع تبوك الحديثة للألمنيوم", project: "P12", contact: true, stock: "riyadh", sqm: 260, lines: 2, raised: 61, issued: 55, cancelled: 23 },
  { key: "T47", company: "مؤسسة ألوان الشرق للدعاية والإعلان", project: "P33", stock: "dammam", sqm: 55, lines: 1, raised: 86, issued: 80, cancelled: 51 },
  { key: "T48", company: "شركة بوابة الشرق للمقاولات", project: "P32", contact: true, stock: "dammam", sqm: 600, lines: 2, raised: 106, issued: 99, cancelled: 66 },

  /* --- revised: v1 superseded, v2 issued `S66` `S68` ---------------- */
  { key: "T49", company: "شركة مرافئ الدمام للمقاولات", project: "P24", contact: true, stock: "dammam", sqm: 780, lines: 2, raised: 100, revisions: [92], issued: 87 },
  { key: "T50", company: "شركة صروح جدة للمقاولات", project: "P36", contact: true, stock: "riyadh", sqm: 2600, lines: 3, raised: 107, revisions: [101], issued: 96 },
  { key: "T51", company: "مؤسسة الصرح للمقاولات", project: null, stock: "riyadh", sqm: 260, lines: 2, raised: 111, revisions: [103], revisedBy: "coordinator", issued: 98 },
  { key: "T52", company: "شركة أملاك المستقبل العقارية", project: "P06", contact: true, stock: "riyadh", sqm: 640, lines: 2, raised: 90, revisions: [83], issued: 77 },

  /* --- three versions, so "the latest live version" means something -- */
  { key: "T53", company: "شركة النهضة للمقاولات", project: "P08", contact: true, stock: "riyadh", sqm: 2850, lines: 3, raised: 39, revisions: [33, 26], issued: 19 },

  /* --- issued and dispatched against `S126` ------------------------- */
  { key: "T54", company: "مصنع الأفق للألمنيوم", project: null, contact: true, stock: "riyadh", sqm: 320, lines: 2, raised: 108, issued: 102, accepted: 97 },
  { key: "T55", company: "مصنع الرواد للألمنيوم", project: null, contact: true, stock: "malham", sqm: 300, lines: 2, raised: 79, issued: 73, accepted: 68 },
  { key: "T56", company: "مصنع الخليج الأول للألمنيوم", project: null, stock: "dammam", sqm: 450, lines: 2, raised: 103, issued: 96, accepted: 90 },
  { key: "T57", company: "شركة مداد العمار للمقاولات", project: "P07", contact: true, stock: "riyadh", sqm: 410, lines: 2, raised: 66, issued: 60, accepted: 54 },
  { key: "T58", company: "مصنع البحر الأحمر للألمنيوم", project: "P36", contact: true, stock: "riyadh", sqm: 520, lines: 2, raised: 94, issued: 88, accepted: 82 },
  { key: "T59", company: "مصنع تهامة للألمنيوم", project: null, contact: true, stock: "south", sqm: 260, lines: 2, raised: 82, issued: 76, accepted: 70 },
  { key: "T60", company: "شركة لمسات للدعاية والإعلان", project: "P46", contact: true, stock: "riyadh", sqm: 80, lines: 1, raised: 86, issued: 80, accepted: 74 },

  /* --- with the customer: accepted, and nothing has shipped `S132` --- */
  /* The only thread in the set that reaches `withCustomer` and stops there.
     Every other accepted thread carries a dispatch, so furthest-along-wins
     reads its project as Won and the pile would render its zero. Accepted
     64 days ago and still undecided, which is what `S132` calls the long
     wait. Do not give it a dispatch. See `P50` for the full reasoning. */
  { key: "T61", company: "شركة البنيان الراسخ للمقاولات", project: "P50", contact: true, stock: "riyadh", sqm: 540, lines: 2, raised: 76, issued: 70, accepted: 64 },
] as const;

/* ------------------------------------------------------------------ *
 * Dispatches `S75` — three routes, roughly a third each
 * ------------------------------------------------------------------ */

/**
 * `thread` null is `S75`'s third route, the free entry. It names a company
 * directly and **no project at all** — `requestDispatch` writes null there by
 * design, so a free entry wins nothing `S31`. That is `S75`'s unbuilt half,
 * recorded in `WORKFLOW §5`, and this dataset makes it visible rather than
 * papering over it.
 *
 * `editedByRep` is `S120`'s first half — the rep changed a line before
 * submitting, so the flag records the difference as theirs. `editedByCoord`
 * is the second — she corrected it after submission, which `S120` says is
 * never the rep's deviation and `S123` counts separately.
 */
export type DispatchRow = {
  key: string;
  /** A thread key. Absent is a free entry `S75` — no quotation at all. */
  thread?: string | null;
  /** Free entry only — the company it is against. */
  company?: string;
  /** Only reaches anything when the thread carries no project `S74`. */
  project?: string;
  stock: Stock;
  shipment: ShipmentMethod;
  cargo?: string;
  /** Days ago, as `dispatch_date`. */
  date: number;
  requested: number;
  /** `S120` — the rep edits a line before submitting. */
  editedByRep?: number;
  submitted?: number;
  /** `S62` `S125` — the coordinator edits a submitted request. */
  editedByCoord?: number;
  approved?: number;
  payment?: PaymentMethod;
  paymentNote?: string;
  smac?: string;
  refused?: number;
  /** `S122` — only she may revive one, and it returns to the rep unsubmitted. */
  revived?: number;
  /** `S73` — approval is final; a wrong one is cancelled, never un-approved. */
  cancelled?: number;
  /** Free entry only: what it carries. */
  sqm?: number;
  lines?: number;
};

export const DISPATCHES: readonly DispatchRow[] = [
  /* --- from a quotation, lines untouched `S75` route one ------------ */
  { key: "D01", thread: "T39", project: "P02", stock: "riyadh", shipment: "tt", date: 94, requested: 94, submitted: 94, approved: 93, payment: "bank_transfer_full", smac: "DN-24-100341" },
  { key: "D02", thread: "T40", project: "P32", stock: "dammam", shipment: "ct", date: 96, requested: 96, submitted: 96, approved: 95, payment: "handled_by_finance", paymentNote: "تساهيل — المرجع في سماك", smac: "DN-24-100352" },
  { key: "D03", thread: "T54", project: "P01", stock: "riyadh", shipment: "tt", date: 90, requested: 91, submitted: 91, approved: 90, payment: "bank_transfer_downpayment", smac: "DN-24-100377" },
  { key: "D04", thread: "T56", project: "P24", stock: "dammam", shipment: "ct", date: 83, requested: 84, submitted: 84, approved: 83, payment: "on_delivery", smac: "DN-24-100405" },
  { key: "D05", thread: "T58", stock: "riyadh", shipment: "tt", date: 74, requested: 75, submitted: 75, approved: 74, payment: "bank_transfer_full", smac: "DN-24-100448" },
  { key: "D06", thread: "T60", stock: "riyadh", shipment: "cargo", cargo: "الرياض - حي الصحافة", date: 67, requested: 68, submitted: 68, approved: 67, payment: "cash_in_office", smac: "DN-24-100496" },
  { key: "D07", thread: "T55", project: "P02", stock: "malham", shipment: "tt", date: 61, requested: 62, submitted: 62, approved: 61, payment: "card_in_office", smac: "DN-24-100538" },
  { key: "D08", thread: "T57", stock: "riyadh", shipment: "tt", date: 46, requested: 47, submitted: 47, approved: 46, payment: "bank_transfer_full", smac: "DN-24-100612" },
  { key: "D09", thread: "T35", project: "P20", stock: "riyadh", shipment: "tt", date: 62, requested: 63, submitted: 63, approved: 62, payment: "bank_transfer_full", smac: "DN-24-100527" },
  { key: "D10", thread: "T34", project: "P23", stock: "riyadh", shipment: "cargo", cargo: "بريدة - الشارع العام", date: 72, requested: 73, submitted: 73, approved: 72, payment: "cash_in_office", smac: "DN-24-100461" },
  { key: "D11", thread: "T36", stock: "dammam", shipment: "ct", date: 25, requested: 26, submitted: 26, approved: 25, payment: "on_delivery", smac: "DN-24-100701" },
  { key: "D12", thread: "T38", stock: "south", shipment: "ct", date: 23, requested: 24, submitted: 24, approved: 23, payment: "bank_transfer_downpayment", smac: "DN-24-100718" },
  { key: "D13", thread: "T59", project: "P42", stock: "south", shipment: "ct", date: 63, requested: 64, submitted: 64, approved: 63, payment: "on_delivery", smac: "DN-24-100515" },

  /* --- from a quotation, with edits — the normal case `S75` --------- */
  { key: "D14", thread: "T54", project: "P01", stock: "riyadh", shipment: "tt", date: 70, requested: 71, editedByRep: 71, submitted: 71, approved: 70, payment: "bank_transfer_full", smac: "DN-24-100472" },
  { key: "D15", thread: "T56", project: "P24", stock: "riyadh", shipment: "tt", date: 55, requested: 56, editedByRep: 56, submitted: 56, approved: 55, payment: "handled_by_finance", paymentNote: "عقد شركة — التسوية في سماك", smac: "DN-24-100563" },
  { key: "D16", thread: "T57", stock: "malham", shipment: "tt", date: 31, requested: 32, editedByRep: 32, submitted: 32, approved: 31, payment: "bank_transfer_full", smac: "DN-24-100668" },
  { key: "D17", thread: "T37", stock: "riyadh", shipment: "cargo", cargo: "الخبر - طريق الملك فهد", date: 12, requested: 13, editedByRep: 13, submitted: 13, approved: 12, payment: "bank_transfer_downpayment", smac: "DN-24-100774" },
  { key: "D18", thread: "T30", stock: "dammam", shipment: "ct", date: 34, requested: 35, editedByRep: 35, submitted: 35, approved: 34, payment: "on_delivery", smac: "DN-24-100650" },
  { key: "D19", thread: "T32", stock: "riyadh", shipment: "tt", date: 58, requested: 59, editedByRep: 59, submitted: 59, approved: 58, payment: "bank_transfer_full", smac: "DN-24-100549" },
  { key: "D20", thread: "T28", stock: "riyadh", shipment: "tt", date: 85, requested: 86, editedByRep: 86, submitted: 86, approved: 85, payment: "card_in_office", smac: "DN-24-100392" },
  { key: "D21", thread: "T29", stock: "riyadh", shipment: "tt", date: 20, requested: 21, editedByRep: 21, submitted: 21, approved: 20, payment: "bank_transfer_full", smac: "DN-24-100739" },
  { key: "D22", thread: "T33", stock: "riyadh", shipment: "cargo", cargo: "الرياض - المصانع الشرقية", date: 26, requested: 27, editedByRep: 27, submitted: 27, approved: 26, payment: "cash_in_office", smac: "DN-24-100694" },
  /* the coordinator corrects a submitted request `S62` `S125` `S123` */
  { key: "D23", thread: "T55", project: "P02", stock: "malham", shipment: "tt", date: 44, requested: 46, submitted: 46, editedByCoord: 45, approved: 44, payment: "bank_transfer_full", smac: "DN-24-100628" },
  { key: "D24", thread: "T58", stock: "riyadh", shipment: "tt", date: 40, requested: 42, submitted: 42, editedByCoord: 41, approved: 40, payment: "on_delivery", smac: "DN-24-100641" },
  { key: "D25", thread: "T31", stock: "dammam", shipment: "ct", date: 7, requested: 8, submitted: 8, editedByCoord: 7, approved: 7, payment: "bank_transfer_downpayment", smac: "DN-24-100801" },
  /* approved, then cancelled — un-wins its project and de-credits `S73` */
  { key: "D26", thread: "T46", stock: "riyadh", shipment: "tt", date: 45, requested: 46, editedByRep: 46, submitted: 46, approved: 45, payment: "bank_transfer_full", smac: "DN-24-100619", cancelled: 24 },

  /* --- free entries: no quotation at all `S75` route three ---------- */
  { key: "D27", company: "مصنع نجد للكلادينج", stock: "riyadh", shipment: "tt", date: 88, requested: 89, submitted: 89, approved: 88, payment: "cash_in_office", sqm: 180, lines: 1, smac: "DN-24-100381" },
  { key: "D28", company: "مصنع الواحة للصناعات المعدنية", stock: "riyadh", shipment: "ct", date: 76, requested: 77, submitted: 77, approved: 76, payment: "on_delivery", sqm: 240, lines: 1, smac: "DN-24-100437" },
  { key: "D29", company: "مصنع الميثاق للصناعات المعدنية", stock: "malham", shipment: "tt", date: 57, requested: 58, submitted: 58, approved: 57, payment: "bank_transfer_full", sqm: 320, lines: 2, smac: "DN-24-100552" },
  { key: "D30", company: "مصنع الوسام للصناعات المعدنية", stock: "riyadh", shipment: "cargo", cargo: "الرياض - السلي", date: 49, requested: 50, submitted: 50, approved: 49, payment: "card_in_office", sqm: 200, lines: 1, smac: "DN-24-100601" },
  { key: "D31", company: "مصنع المدى للألمنيوم", stock: "riyadh", shipment: "tt", date: 32, requested: 33, submitted: 33, approved: 32, payment: "bank_transfer_full", sqm: 300, lines: 1, smac: "DN-24-100659" },
  { key: "D32", company: "مصنع الجزيرة للواجهات", stock: "dammam", shipment: "ct", date: 29, requested: 30, submitted: 30, approved: 29, payment: "on_delivery", sqm: 260, lines: 1, smac: "DN-24-100677" },
  { key: "D33", company: "مصنع القمة للتشكيل المعدني", stock: "riyadh", shipment: "tt", date: 39, requested: 40, submitted: 40, approved: 39, payment: "handled_by_finance", paymentNote: "حساب ائتماني — المرجع في سماك", sqm: 210, lines: 1, smac: "DN-24-100637" },
  { key: "D34", company: "مصنع الشروق للتشكيل المعدني", stock: "south", shipment: "ct", date: 27, requested: 28, submitted: 28, approved: 27, payment: "cash_in_office", sqm: 190, lines: 1, smac: "DN-24-100688" },
  { key: "D35", company: "مصنع المنارة للألمنيوم", stock: "south", shipment: "ct", date: 18, requested: 19, submitted: 19, approved: 18, payment: "on_delivery", sqm: 165, lines: 1, smac: "DN-24-100751" },
  { key: "D36", company: "ورشة الإتقان للتشكيل المعدني", stock: "riyadh", shipment: "ct", date: 14, requested: 15, submitted: 15, approved: 14, payment: "cash_in_office", sqm: 150, lines: 1 },
  /* approved, then cancelled — finance refused `S73` `S128` */
  { key: "D37", company: "مؤسسة سواعد التعمير", stock: "riyadh", shipment: "tt", date: 36, requested: 37, submitted: 37, approved: 36, payment: "bank_transfer_downpayment", sqm: 165, lines: 1, smac: "DN-24-100645", cancelled: 17 },

  /* --- still moving: draft, submitted, refused, revived `S86` ------- */
  /* waiting on the rep `S86` */
  { key: "D38", thread: "T53", stock: "riyadh", shipment: "tt", date: 0, requested: 4 },
  { key: "D39", company: "مصنع الأصالة للألمنيوم", stock: "riyadh", shipment: "tt", date: 0, requested: 2, sqm: 310, lines: 1 },
  /* waiting on the coordinator `S88` `S89` — oldest first on her queue */
  { key: "D40", thread: "T26", stock: "riyadh", shipment: "tt", date: 0, requested: 12, submitted: 11 },
  { key: "D41", thread: "T21", stock: "dammam", shipment: "ct", date: 0, requested: 9, editedByRep: 9, submitted: 8 },
  { key: "D42", thread: "T37", stock: "riyadh", shipment: "cargo", cargo: "الخبر - الراكة", date: 0, requested: 6, submitted: 5 },
  { key: "D43", company: "مصنع سدرة للصناعات المعدنية", stock: "riyadh", shipment: "tt", date: 0, requested: 3, submitted: 2, sqm: 480, lines: 2 },
  { key: "D44", thread: "T24", stock: "riyadh", shipment: "tt", date: 0, requested: 2, submitted: 1 },
  /* refused, archived with a reason `S124` `S122` */
  { key: "D45", thread: "T27", stock: "riyadh", shipment: "tt", date: 0, requested: 38, submitted: 37, refused: 36 },
  { key: "D46", company: "مصنع صدف للصناعات المعدنية", stock: "dammam", shipment: "ct", date: 0, requested: 28, submitted: 27, refused: 26, sqm: 300, lines: 1 },
  { key: "D47", thread: "T25", stock: "malham", shipment: "tt", date: 0, requested: 21, submitted: 20, refused: 19 },
  /* refused, then revived — it returns to the rep, unsubmitted `S122` */
  { key: "D48", thread: "T19", stock: "riyadh", shipment: "tt", date: 0, requested: 16, submitted: 15, refused: 14, revived: 10 },
] as const;
