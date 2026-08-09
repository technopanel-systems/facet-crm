/**
 * Saudi cities `[15 §3]` — the lookup `09 §3.6` and `07 A7` asked for and no
 * document listed until now.
 *
 * **Grouped by administrative region on purpose.** Saudi Arabia has thirteen
 * official regions and `region` has five values, so `15 §3` states the mapping
 * once per administrative region, never per city. Keeping the file in that
 * shape means the decision is checkable by reading thirteen lines rather than
 * two hundred, and there is no way to quietly mis-assign a single town.
 *
 * Adding a city is therefore a one-line change inside the right group, and its
 * region follows without a second thought — which is the point.
 *
 * Names are the common English rendering and the official Arabic. Both are
 * searched by the city combobox whatever the interface language `[15 §5]`, so
 * a rep typing Arabic finds a city in an English session.
 *
 * This list is not claimed to be exhaustive — Saudi Arabia has many hundreds of
 * settlements. It is every city and governorate seat a sales conversation is
 * likely to name. A missing town is a one-line addition, not a schema change.
 */

import type { Region } from "@/lib/enums";

type CityGroup = {
  /** The official administrative region — documentation, not stored. */
  readonly adminEn: string;
  readonly adminAr: string;
  /** The `region` enum value every city in this group inherits `[15 §3]`. */
  readonly region: Region;
  /** `[English, Arabic]`. */
  readonly cities: readonly (readonly [string, string])[];
};

const GROUPS: readonly CityGroup[] = [
  {
    adminEn: "Riyadh",
    adminAr: "الرياض",
    region: "center",
    cities: [
      ["Riyadh", "الرياض"],
      ["Ad Diriyah", "الدرعية"],
      ["Al Kharj", "الخرج"],
      ["Ad Dawadmi", "الدوادمي"],
      ["Al Majma'ah", "المجمعة"],
      ["Al Quwaiyah", "القويعية"],
      ["Wadi ad-Dawasir", "وادي الدواسر"],
      ["Layla", "ليلى"],
      ["Az Zulfi", "الزلفي"],
      ["Shaqra", "شقراء"],
      ["Hotat Bani Tamim", "حوطة بني تميم"],
      ["Afif", "عفيف"],
      ["As Sulayyil", "السليل"],
      ["Dhurma", "ضرما"],
      ["Al Muzahimiyah", "المزاحمية"],
      ["Rumah", "رماح"],
      ["Thadiq", "ثادق"],
      ["Huraymila", "حريملاء"],
      ["Al Hariq", "الحريق"],
      ["Al Ghat", "الغاط"],
      ["Marat", "مرات"],
      ["Al Artawiyah", "الأرطاوية"],
      ["Sajir", "ساجر"],
      ["Hautat Sudair", "حوطة سدير"],
      ["Tumair", "تمير"],
      ["Al Bejadiah", "البجادية"],
      ["Nafi", "نفي"],
      ["Al Hayathem", "الهياثم"],
    ],
  },
  {
    adminEn: "Al-Qassim",
    adminAr: "القصيم",
    region: "center",
    cities: [
      ["Buraydah", "بريدة"],
      ["Unayzah", "عنيزة"],
      ["Ar Rass", "الرس"],
      ["Al Bukayriyah", "البكيرية"],
      ["Al Badai", "البدائع"],
      ["Al Mithnab", "المذنب"],
      ["Riyadh Al Khabra", "رياض الخبراء"],
      ["Uyun AlJawa", "عيون الجواء"],
      ["An Nabhaniyah", "النبهانية"],
      ["Ash Shimasiyah", "الشماسية"],
      ["Dariyah", "ضرية"],
      ["Al Asyah", "الأسياح"],
      ["Qusaiba", "قصيباء"],
      ["Ain Ibn Fuhaid", "عين ابن فهيد"],
    ],
  },
  {
    adminEn: "Tabuk",
    adminAr: "تبوك",
    region: "north",
    cities: [
      ["Tabuk", "تبوك"],
      ["Duba", "ضباء"],
      ["Umluj", "أملج"],
      ["Haql", "حقل"],
      ["Al Wajh", "الوجه"],
      ["Tayma", "تيماء"],
      ["Al Bad'", "البدع"],
    ],
  },
  {
    adminEn: "Ha'il",
    adminAr: "حائل",
    region: "north",
    cities: [
      ["Ha'il", "حائل"],
      ["Baqaa", "بقعاء"],
      ["Al Ghazalah", "الغزالة"],
      ["Ash Shinan", "الشنان"],
      ["Mawqaq", "موقق"],
      ["As Sulaimi", "السليمي"],
      ["Simira", "سميراء"],
      ["Al Hait", "الحائط"],
      ["Ash Shamli", "الشملي"],
      ["Al Kahafah", "الكهفة"],
      ["Qufar", "قفار"],
    ],
  },
  {
    adminEn: "Al-Jawf",
    adminAr: "الجوف",
    region: "north",
    cities: [
      ["Sakaka", "سكاكا"],
      ["Dumat al-Jandal", "دومة الجندل"],
      ["Al Qurayyat", "القريات"],
      ["Tabarjal", "طبرجل"],
      ["Suwayr", "صوير"],
      ["Al Isawiyah", "العيساوية"],
    ],
  },
  {
    adminEn: "Northern Borders",
    adminAr: "الحدود الشمالية",
    region: "north",
    cities: [
      ["Arar", "عرعر"],
      ["Rafha", "رفحاء"],
      ["Turaif", "طريف"],
      ["Al Uwayqilah", "العويقيلة"],
    ],
  },
  {
    adminEn: "Eastern Province",
    adminAr: "المنطقة الشرقية",
    region: "east",
    cities: [
      ["Dammam", "الدمام"],
      ["Dhahran", "الظهران"],
      ["Al Khobar", "الخبر"],
      ["Jubail", "الجبيل"],
      ["Hofuf", "الهفوف"],
      ["Al Mubarraz", "المبرز"],
      ["Qatif", "القطيف"],
      ["Safwa", "صفوى"],
      ["Saihat", "سيهات"],
      ["Tarut", "تاروت"],
      ["Ras Tanura", "رأس تنورة"],
      ["Abqaiq", "بقيق"],
      ["Hafar al-Batin", "حفر الباطن"],
      ["Al Khafji", "الخفجي"],
      ["An Nairyah", "النعيرية"],
      ["Qaryat al-Ulya", "قرية العليا"],
      ["Al Udhailiyah", "العضيلية"],
      ["Al Awamiyah", "العوامية"],
      ["Anak", "عنك"],
      ["Al Uyun", "العيون"],
      ["Al Mutayrifi", "المطيرفي"],
      ["Harad", "حرض"],
      ["Salwa", "سلوى"],
      ["Al Qaisumah", "القيصومة"],
      ["Al Batha", "البطحاء"],
      ["Al Kharsaniyah", "الخرسانية"],
    ],
  },
  {
    adminEn: "Makkah",
    adminAr: "مكة المكرمة",
    region: "west",
    cities: [
      ["Makkah", "مكة المكرمة"],
      ["Jeddah", "جدة"],
      ["Ta'if", "الطائف"],
      ["Rabigh", "رابغ"],
      ["Al Qunfudhah", "القنفذة"],
      ["Al Lith", "الليث"],
      ["Khulais", "خليص"],
      ["Al Jumum", "الجموم"],
      ["Turubah", "تربة"],
      ["Ranyah", "رنية"],
      ["Al Khurmah", "الخرمة"],
      ["Al Kamil", "الكامل"],
      ["Al Muwayh", "المويه"],
      ["Adham", "أضم"],
      ["Al Ardiyat", "العرضيات"],
      ["Thuwal", "ثول"],
      ["Bahrah", "بحرة"],
      ["King Abdullah Economic City", "مدينة الملك عبدالله الاقتصادية"],
    ],
  },
  {
    adminEn: "Al-Madinah",
    adminAr: "المدينة المنورة",
    region: "west",
    cities: [
      ["Madinah", "المدينة المنورة"],
      ["Yanbu", "ينبع"],
      ["Al Ula", "العلا"],
      ["Badr", "بدر"],
      ["Khaybar", "خيبر"],
      ["Al Hinakiyah", "الحناكية"],
      ["Mahd adh Dhahab", "مهد الذهب"],
      ["Al Ais", "العيص"],
      ["Yanbu al-Nakhl", "ينبع النخل"],
    ],
  },
  {
    adminEn: "'Asir",
    adminAr: "عسير",
    region: "south",
    cities: [
      ["Abha", "أبها"],
      ["Khamis Mushait", "خميس مشيط"],
      ["Bisha", "بيشة"],
      ["Muhayil Asir", "محايل عسير"],
      ["An Namas", "النماص"],
      ["Sarat Ubaidah", "سراة عبيدة"],
      ["Rijal Almaa", "رجال ألمع"],
      ["Tathlith", "تثليث"],
      ["Ahad Rufaidah", "أحد رفيدة"],
      ["Balqarn", "بلقرن"],
      ["Al Majaridah", "المجاردة"],
      ["Dhahran Al Janub", "ظهران الجنوب"],
      ["Tanumah", "تنومة"],
      ["Billasmar", "بللسمر"],
      ["Bariq", "بارق"],
      ["Wadi Bin Hashbal", "وادي بن هشبل"],
    ],
  },
  {
    adminEn: "Jazan",
    adminAr: "جازان",
    region: "south",
    cities: [
      ["Jazan", "جازان"],
      ["Sabya", "صبيا"],
      ["Abu Arish", "أبو عريش"],
      ["Samtah", "صامطة"],
      ["Ahad Al Masarihah", "أحد المسارحة"],
      ["Farasan", "فرسان"],
      ["Baish", "بيش"],
      ["Damad", "ضمد"],
      ["Al Aridhah", "العارضة"],
      ["Ad Darb", "الدرب"],
      ["Ar Rayth", "الريث"],
      ["Al Harth", "الحرث"],
      ["Fifa", "فيفاء"],
      ["Al Aydabi", "العيدابي"],
      ["Ad Dair", "الدائر"],
    ],
  },
  {
    adminEn: "Najran",
    adminAr: "نجران",
    region: "south",
    cities: [
      ["Najran", "نجران"],
      ["Sharurah", "شرورة"],
      ["Habuna", "حبونا"],
      ["Badr Al Janub", "بدر الجنوب"],
      ["Yadamah", "يدمة"],
      ["Thar", "ثار"],
      ["Khubash", "خباش"],
      ["Al Kharkhir", "الخرخير"],
    ],
  },
  {
    adminEn: "Al-Bahah",
    adminAr: "الباحة",
    region: "south",
    cities: [
      ["Al Bahah", "الباحة"],
      ["Baljurashi", "بلجرشي"],
      ["Al Mandaq", "المندق"],
      ["Al Mikhwah", "المخواة"],
      ["Qilwah", "قلوة"],
      ["Al Aqiq", "العقيق"],
      ["Al Qura", "القرى"],
      ["Ghamid Al Zinad", "غامد الزناد"],
      ["Bani Hasan", "بني حسن"],
    ],
  },
];

export type CitySeedRow = {
  nameEn: string;
  nameAr: string;
  region: Region;
};

/** The groups flattened to rows, which is what the seeder writes. */
export const CITY_SEED: readonly CitySeedRow[] = GROUPS.flatMap((group) =>
  group.cities.map(([nameEn, nameAr]) => ({
    nameEn,
    nameAr,
    region: group.region,
  })),
);

/** Exported for the seed script's summary line — reading it back is how you
 *  check the grouping without opening the database. */
export const CITY_SEED_GROUPS = GROUPS;
