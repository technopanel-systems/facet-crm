/**
 * What the reps typed — reports `S32`, comments `S114`, targets `S83`, shares
 * `S96`, and the planned diary `[25 §18]`.
 *
 * **Reports carry a real date, not a shifted one.** `ReportInput.reportDate`
 * is caller-supplied, so a visit logged as happening 40 days ago is written
 * that way by `createReport` itself — no clock is moved for these. That is
 * also what makes two of the six `FOLLOW_UP_KINDS` fall out for free:
 * `company_quiet` reads `max(report_date)` and `catalogue_no_response` reads
 * the date of the catalogue itself (`follow-ups.ts:688`, `:483`).
 *
 * **The ten issued threads are deliberately left un-logged since issuing.**
 * `quotation_no_response` requires no interaction on the company after the
 * version was issued, so a friendly recent visit on one of those companies
 * would quietly empty a whole tile of `D33`.
 *
 * Nine in ten entries attach to a company `S33`, so the field notes here are
 * eight of eighty-six. Every channel `S34`, every outcome `S35`, every field
 * note category and every `REPORT_SIGNALS` value appears at least once — the
 * runner asserts that rather than trusting this comment.
 */

import type {
  FieldNoteCategory,
  ReportChannel,
  ReportOutcome,
  ReportSignal,
} from "@/lib/enums";

import type { PersonKey } from "./people";

export type SignalEntry = { signal: ReportSignal; reference?: string };

export type ReportEntry = {
  /** Null is a field note `S33` — no company at all. */
  company: string | null;
  project?: string;
  /** Name the company's contact where it has one. */
  contact?: boolean;
  by: PersonKey;
  /** Days ago — becomes `report_date`, not a shifted clock. */
  day: number;
  channel?: ReportChannel;
  outcome?: ReportOutcome;
  /** Field note only. */
  category?: FieldNoteCategory;
  city?: string;
  /** `S37` — days in the FUTURE. Required when the outcome is on hold. */
  onHoldInDays?: number;
  signals?: readonly SignalEntry[];
  text: string;
};

export const REPORTS: readonly ReportEntry[] = [
  /* ---- the oldest contact on each company, so nothing reads as never
   *      touched. `company_quiet` then falls out of the gaps `S89`. ---- */
  { company: "مصنع سدرة للصناعات المعدنية", contact: true, by: "faisal", day: 117, channel: "visit", outcome: "introduced", text: "زيارة أولى للمصنع، شرحت المنتج والفروقات بين الفئات، مهتم بالكميات الكبيرة" },
  { company: "شركة أنماء للمقاولات", contact: true, project: "P01", by: "faisal", day: 111, channel: "visit", outcome: "introduced", text: "اجتماع في مكتبهم مع مدير المشاريع، عندهم واجهة مكاتب إدارية، اللون نحاسي، طلب عرض" },
  { company: "مؤسسة الصرح الوطنية للمقاولات العامة والتشييد والصيانة والتشغيل", by: "faisal", day: 110, channel: "call", outcome: "introduced", text: "اتصال تعريفي، طلب كتالوج على الواتساب" },
  { company: "مصنع الأفق للألمنيوم", contact: true, by: "faisal", day: 113, channel: "visit", outcome: "introduced", text: "زيارة المصنع، يشتري حالياً من مورد ثاني، فتح الباب لعرض سعر" },
  { company: "Delta Rock Co", contact: true, by: "faisal", day: 109, channel: "meeting", outcome: "catalogue_sent", text: "جاء للمكتب ومعه رسومات المشروع، سلمته الكتالوج وشرحت التفاصيل الفنية" },
  { company: "مكتب المعمار الحديث للاستشارات الهندسية", contact: true, by: "faisal", day: 108, channel: "email", outcome: "documents_sent", text: "أرسلت شهادات مقاومة الحريق والمواصفات الفنية بالإيميل للاعتماد في المواصفة" },
  { company: "شركة البناء المتين للمقاولات", contact: true, by: "faisal", day: 105, channel: "visit", outcome: "samples_sent", text: "سلمت عينات ثلاثة ألوان في موقعهم، وعدوا بالرد خلال أسبوع" },
  { company: "مؤسسة إبداع للدعاية والإعلان", by: "faisal", day: 104, channel: "whatsapp", outcome: "discussed_pricing", text: "تفاوض على سعر المتر للوحات الصغيرة، شرحت أن السعر ثابت للكميات تحت 100 متر" },
  { company: "شركة رؤى العمران للمقاولات", contact: true, project: "P03", by: "faisal", day: 101, channel: "visit", outcome: "introduced", text: "زيارة موقع الفيلا في الدرعية، اللون خشبي، توريد وتركيب" },
  { company: "مصنع نجد للكلادينج", contact: true, by: "faisal", day: 100, channel: "call", outcome: "discussed_pricing", text: "ناقشنا السعر للكميات المتكررة، طلب تخفيض لم أوافق عليه" },
  { company: "شركة تمكين للمقاولات", project: "P02", by: "faisal", day: 98, channel: "meeting", outcome: "technical_submitting", text: "جاؤوا للمكتب لمراجعة التفاصيل الفنية للبرج، قدمنا الحل الفني للتثبيت" },
  { company: "مؤسسة ركائز البناء", contact: true, by: "faisal", day: 97, channel: "visit", outcome: "introduced", text: "زيارة المجمعة، مشروع مبنى بلدية، عرضوا التفاصيل" },
  { company: "شركة أملاك المستقبل العقارية", contact: true, project: "P06", by: "faisal", day: 93, channel: "visit", outcome: "discussed_pricing", text: "المالك يبي تجديد كامل للواجهة، ناقشنا الميزانية، اللون شمبين" },
  { company: "شركة الحصن للمقاولات العامة", contact: true, project: "P05", by: "faisal", day: 91, channel: "visit", outcome: "technical_submitting", text: "قدمنا العرض الفني لواجهة المستشفى، الاستشاري يراجع" },
  { company: "مصنع الواحة للصناعات المعدنية", by: "faisal", day: 89, channel: "call", outcome: "catalogue_sent", text: "أرسلت الكتالوج بعد الاتصال، ينتظر موافقة الإدارة" },
  { company: "مؤسسة سواعد التعمير", contact: true, by: "faisal", day: 87, channel: "visit", outcome: "introduced", text: "زيارة تعريفية، مقاول صغير يشتغل على فلل، كميات محدودة" },
  { company: "شركة محطات الطريق لإدارة المحطات", contact: true, project: "P04", by: "faisal", day: 83, channel: "visit", outcome: "technical_submitting", text: "معاينة محطتين على طريق الخرج، قدمنا تفاصيل المظلات والواجهات" },
  { company: "مصنع الرواد للألمنيوم", contact: true, by: "faisal", day: 82, channel: "visit", outcome: "introduced", text: "مصنع كبير يشتري بالحاويات، أبيض وفضي فقط، لا يحتاج تركيب" },
  { company: "شركة البنيان الراسخ للمقاولات", contact: true, by: "faisal", day: 80, channel: "visit", outcome: "catalogue_sent", text: "زيارة بريدة، سلمت الكتالوج ولوحة الألوان" },
  { company: "مؤسسة نبض للدعاية والإعلان", project: "P23", by: "faisal", day: 78, channel: "whatsapp", outcome: "discussed_pricing", text: "لوحة واجهة معرض، اللون أسود مطفي، 72 متر، ناقشنا السعر" },
  { company: "مجموعة الفهد القابضة", contact: true, by: "faisal", day: 76, channel: "meeting", outcome: "introduced", text: "اجتماع في مكتبهم، مجموعة عندها عدة مبان، بداية علاقة" },
  { company: "مصنع البيان للتشكيل المعدني", project: "P22", by: "faisal", day: 74, channel: "call", outcome: "discussed_pricing", text: "مصنع صغير، يطلب دفعات 150 إلى 250 متر، اتفقنا على السعر" },
  { company: "مؤسسة أساس المستقبل للمقاولات", contact: true, by: "faisal", day: 72, channel: "visit", outcome: "samples_sent", text: "سلمت عينتين، يفاضل بين موردين" },
  { company: "مكتب الرؤية الهندسية", by: "faisal", day: 70, channel: "email", outcome: "documents_sent", text: "أرسلت ملف المواصفات الفنية للمكتب الاستشاري" },
  { company: "شركة مداد العمار للمقاولات", contact: true, project: "P07", by: "faisal", day: 67, channel: "visit", outcome: "technical_submitting", text: "مدرسة أهلية في بريدة، قدمنا الحل الفني، اللون بيج" },
  { company: "مصنع تبوك الحديثة للألمنيوم", contact: true, project: "P12", by: "faisal", day: 62, channel: "visit", outcome: "samples_sent", text: "أول تعامل، سلمت عينات رمادي فاتح، يبي يجربها قبل الطلب" },
  { company: "مؤسسة درب الشمال للمقاولات", project: "P20", by: "faisal", day: 64, channel: "call", outcome: "introduced", text: "اتصال تعريفي مع مقاول في حائل، عنده مشاريع متفرقة" },
  { company: "شركة أبراج الشمال", contact: true, by: "faisal", day: 62, channel: "visit", outcome: "catalogue_sent", text: "زيارة تبوك، سلمت الكتالوج للمالك مباشرة" },
  { company: "شركة الفريدة للمقاولات", by: "faisal", day: 60, channel: "whatsapp", outcome: "discussed_pricing", text: "واجهة مبنى إداري 288 متر، اللون نحاسي، تفاوض على السعر" },
  { company: "مصنع الميثاق للصناعات المعدنية", contact: true, by: "faisal", day: 58, channel: "visit", outcome: "introduced", text: "زيارة أولى، مصنع متوسط في الصناعية" },
  { company: "مكتب خطوط التصميم للاستشارات", by: "faisal", day: 56, channel: "email", outcome: "documents_sent", text: "أرسلت كراسة المواصفات لاعتمادها ضمن مواصفة المشروع" },
  { company: "شركة نماء للتوريدات", contact: true, by: "faisal", day: 54, channel: "call", outcome: "discussed_pricing", text: "وسيط توريد، يبي سعر خاص للكميات، شرحت سياسة الأسعار" },
  { company: "مؤسسة واحة الوقود لإدارة المحطات", project: "P19", by: "faisal", day: 50, channel: "visit", outcome: "technical_submitting", text: "معاينة محطة الزلفي، قدمنا تفاصيل المظلات" },
  { company: "شركة الأمانة للمقاولات", contact: true, project: "P09", by: "faisal", day: 47, channel: "visit", outcome: "discussed_pricing", text: "مشروع مستودعات، اللون رمادي، توريد فقط، ناقشنا السعر والكمية" },
  { company: "مصنع الوسام للصناعات المعدنية", by: "faisal", day: 45, channel: "call", outcome: "no_answer", text: "اتصلت ثلاث مرات ولا رد، بحاول الأسبوع الجاي" },
  { company: "مؤسسة بناء الوطن", contact: true, by: "faisal", day: 43, channel: "visit", outcome: "catalogue_sent", text: "زيارة الخرج، سلمت الكتالوج، وعدني يرجع لي" },
  { company: "شركة رسم للدعاية والإعلان", project: "P17", by: "faisal", day: 41, channel: "whatsapp", outcome: "discussed_pricing", text: "برنامج لوحات لعشرين فرع، ناقشنا سعر المتر" },
  { company: "مكتب الزاوية للاستشارات الهندسية", contact: true, by: "faisal", day: 39, channel: "meeting", outcome: "introduced", text: "جاء للمكتب، مهندس شاب، يحب يفهم المنتج قبل ما يوصفه" },
  { company: "شركة النهضة للمقاولات", contact: true, project: "P08", by: "faisal", day: 37, channel: "visit", outcome: "technical_submitting", text: "برج سكني ٢٢ دور، قدمنا الحل الفني للتثبيت، اللون فضي لامع" },
  { company: "مصنع القمة للتشكيل المعدني", by: "faisal", day: 35, channel: "call", outcome: "introduced", text: "اتصال تعريفي، مصنع جديد نسبياً" },
  { company: "شركة قصور الرياض", contact: true, project: "P10", by: "faisal", day: 33, channel: "visit", outcome: "discussed_pricing", text: "ثلاث فلل في الياسمين، اللون خشبي، اتفقنا مبدئياً على السعر" },
  { company: "مؤسسة الشرق للتجارة العامة", by: "faisal", day: 31, channel: "call", outcome: "not_interested", text: "قال إنه غير مهتم حالياً، تركت الباب مفتوح", signals: [{ signal: "project_delayed" }] },
  { company: "شركة سواري للمقاولات", contact: true, by: "faisal", day: 29, channel: "visit", outcome: "catalogue_sent", text: "زيارة الدرعية، سلمت الكتالوج ولوحة الألوان" },
  { company: "مصنع المدى للألمنيوم", by: "faisal", day: 27, channel: "whatsapp", outcome: "other", text: "أرسل صور لدفعة سابقة فيها خدش بسيط، تابعت مع المستودع", signals: [{ signal: "quality_concern" }] },
  { company: "مؤسسة الخطوة الأولى للمقاولات", by: "faisal", day: 26, channel: "call", outcome: "no_answer", text: "ما رد، الرقم مشغول طول اليوم" },
  { company: "مكتب البعد الثالث للاستشارات", contact: true, by: "faisal", day: 24, channel: "email", outcome: "documents_sent", text: "أرسلت المواصفات الفنية والشهادات" },
  { company: "شركة الياقوت للمقاولات", contact: true, project: "P11", by: "faisal", day: 22, channel: "visit", outcome: "technical_submitting", text: "معرض سيارات في بريدة، قدمنا تفاصيل التركيب، اللون أسود مطفي" },
  { company: "مؤسسة المدار للدعاية والإعلان", by: "faisal", day: 20, channel: "whatsapp", outcome: "catalogue_sent", text: "أرسلت الكتالوج على الواتساب" },
  { company: "مصنع الرياض للأبواب والنوافذ", contact: true, project: "P18", by: "faisal", day: 18, channel: "visit", outcome: "discussed_pricing", text: "يشتري للأبواب فقط، 3 مم بني، ناقشنا السعر والكمية 165 متر" },
  { company: "شركة الميدان للاستثمار", by: "faisal", day: 16, channel: "call", outcome: "on_hold", onHoldInDays: 34, text: "قال إن المشروع موقوف لين تخلص إجراءات التمويل، أرجع له بعد شهر" },
  { company: "مؤسسة إتقان التعمير", contact: true, by: "faisal", day: 15, channel: "visit", outcome: "discussed_pricing", text: "ناقشنا سعر 340 متر، يشوف عرض ثاني قبل ما يقرر", signals: [{ signal: "competitor_cheaper", reference: "الشركة الوطنية للألواح" }] },
  { company: "ورشة الإتقان للتشكيل المعدني", by: "faisal", day: 14, channel: "meeting", outcome: "other", text: "جاء للمستودع يشوف البواقي، أخذ كمية صغيرة" },
  { company: "شركة الرافدين للمقاولات", contact: true, by: "faisal", day: 12, channel: "visit", outcome: "introduced", text: "زيارة أولى، مقاول متوسط، عنده مشروعين قادمين" },
  { company: "فهد بن عبدالله العتيبي", project: "P14", by: "faisal", day: 10, channel: "whatsapp", outcome: "discussed_pricing", text: "واجهة استراحة 95 متر، اللون خشبي، توريد وتركيب، وافق على السعر" },
  { company: "مؤسسة الاستراحة لإدارة المحطات", contact: true, by: "faisal", day: 9, channel: "call", outcome: "introduced", text: "اتصال تعريفي، عندهم ثلاث محطات في الخرج" },
  { company: "شركة ناصر بن عبدالله الحقباني للاستثمار والتطوير العقاري", contact: true, project: "P15", by: "faisal", day: 6, channel: "meeting", outcome: "technical_submitting", text: "اجتماع في مكتبهم، ثلاثة مشاريع سكنية دفعة واحدة، قدمنا الحل الفني والجدول الزمني" },
  { company: "مصنع الشعلة للألمنيوم", contact: true, by: "faisal", day: 5, channel: "visit", outcome: "samples_sent", text: "سلمت عينات، يبي يشوفها مع الإنتاج" },
  { company: "شركة واجهات المملكة للمقاولات", contact: true, project: "P13", by: "faisal", day: 3, channel: "visit", outcome: "discussed_pricing", text: "مشروع فندق 1,150 متر، اللون شمبين، ناقشنا السعر والجدول" },
  { company: "مكتب الميزان الهندسي", by: "faisal", day: 1, channel: "meeting", outcome: "introduced", text: "جاء للمكتب اليوم، مكتب استشاري جديد، أخذ الكتالوج" },

  /* ---- Saad ---- */
  { company: "مصنع درة الشرق للصناعة", contact: true, by: "saad", day: 118, channel: "visit", outcome: "introduced", text: "زيارة المصنع في الدمام، مصنع كبير، طلبات شهرية محتملة" },
  { company: "شركة بوابة الشرق للمقاولات", contact: true, project: "P32", by: "saad", day: 107, channel: "visit", outcome: "technical_submitting", text: "اجتماع في الجبيل، اتفاقية إطارية، قدمنا التفاصيل الفنية" },
  { company: "مصنع الخليج الأول للألمنيوم", by: "saad", day: 109, channel: "call", outcome: "discussed_pricing", text: "يطلب A2 مقاوم حريق، ناقشنا فرق السعر عن العادي" },
  { company: "شركة مرافئ الدمام للمقاولات", contact: true, project: "P24", by: "saad", day: 101, channel: "visit", outcome: "technical_submitting", text: "مبنى إدارة الميناء، اللون أزرق داكن، قدمنا الحل الفني" },
  { company: "شركة أعمدة الخليج للمقاولات", by: "saad", day: 97, channel: "call", outcome: "catalogue_sent", text: "أرسلت الكتالوج بعد الاتصال" },
  { company: "مؤسسة معمار الشرق", contact: true, by: "saad", day: 92, channel: "visit", outcome: "introduced", text: "زيارة الظهران، مقاول يشتغل مع أرامكو، متطلبات مواصفة عالية" },
  { company: "مؤسسة ألوان الشرق للدعاية والإعلان", project: "P33", by: "saad", day: 87, channel: "whatsapp", outcome: "discussed_pricing", text: "لوحات مطاعم، كميات صغيرة، ناقشنا سعر المتر" },
  { company: "مصنع صدف للصناعات المعدنية", project: "P31", by: "saad", day: 79, channel: "visit", outcome: "discussed_pricing", text: "ألواح مصنع القطيف 300 متر، طلب سعر أفضل", signals: [{ signal: "price_too_high" }, { signal: "competitor_cheaper", reference: "مصنع الشرق للألواح" }] },
  { company: "شركة الربيع للمقاولات العامة", contact: true, project: "P26", by: "saad", day: 77, channel: "visit", outcome: "technical_submitting", text: "مدارس الأحساء ثلاث مراحل، قدمنا الحل الفني للمرحلة الأولى" },
  { company: "مصنع الفرات للألمنيوم", contact: true, by: "saad", day: 75, channel: "email", outcome: "documents_sent", text: "عميل خارج المملكة، أرسلت المواصفات وشروط الشحن" },
  { company: "مكتب المحور للاستشارات الهندسية", by: "saad", day: 71, channel: "email", outcome: "documents_sent", text: "أرسلت الشهادات الفنية للمكتب" },
  { company: "شركة مسار لإدارة المحطات", contact: true, project: "P27", by: "saad", day: 64, channel: "visit", outcome: "technical_submitting", text: "خمس محطات على طريق الجبيل، معاينة موقعين، قدمنا التفاصيل" },
  { company: "مجموعة الوادي التجارية", by: "saad", day: 61, channel: "call", outcome: "introduced", text: "اتصال تعريفي مع إدارة المجموعة" },
  { company: "مصنع الساحل للألمنيوم", contact: true, project: "P34", by: "saad", day: 53, channel: "visit", outcome: "discussed_pricing", text: "توريد رأس تنورة 420 متر، ناقشنا السعر والجدولة" },
  { company: "شركة الشاطئ الأزرق للمقاولات", contact: true, project: "P25", by: "saad", day: 51, channel: "visit", outcome: "technical_submitting", text: "أبراج الكورنيش، قدمنا الحل الفني للواجهة الزجاجية المعدنية" },
  { company: "مؤسسة الضوء للدعاية والإعلان", by: "saad", day: 49, channel: "whatsapp", outcome: "catalogue_sent", text: "أرسلت الكتالوج على الواتساب" },
  { company: "مصنع النخبة للتشكيل المعدني", project: "P35", by: "saad", day: 46, channel: "call", outcome: "discussed_pricing", text: "دفعات 200 إلى 350 متر، اتفقنا على سعر الدفعة" },
  { company: "شركة السد للمقاولات", contact: true, by: "saad", day: 44, channel: "visit", outcome: "samples_sent", text: "سلمت عينات في الهفوف" },
  { company: "مكتب صياغة للاستشارات الهندسية", by: "saad", day: 40, channel: "email", outcome: "documents_sent", text: "أرسلت المواصفات الفنية" },
  { company: "Silver Line Contracting", contact: true, project: "P28", by: "saad", day: 32, channel: "meeting", outcome: "technical_submitting", text: "اجتماع في المكتب، مركز تجاري في الخبر، اللون نحاسي" },
  { company: "مؤسسة حصاد البناء", by: "saad", day: 28, channel: "visit", outcome: "introduced", text: "زيارة الجبيل، مقاول متوسط" },
  { company: "مصنع الجزيرة للواجهات", contact: true, by: "saad", day: 25, channel: "call", outcome: "discussed_pricing", text: "ناقشنا السعر لدفعة 260 متر" },
  { company: "مجموعة الرمال القابضة", project: "P29", by: "saad", day: 21, channel: "visit", outcome: "discussed_pricing", text: "تجديد مبنى مكاتب 690 متر، اللون رمادي، ناقشنا الميزانية" },
  { company: "شركة نقاط الخدمة لإدارة المحطات", by: "saad", day: 19, channel: "call", outcome: "on_hold", onHoldInDays: 21, text: "قال إن الميزانية مؤجلة للربع القادم، أرجع له بعد ثلاثة أسابيع" },
  { company: "مؤسسة الإشارة للدعاية والإعلان", contact: true, by: "saad", day: 17, channel: "whatsapp", outcome: "catalogue_sent", text: "أرسلت الكتالوج" },
  { company: "شركة الرافد للمقاولات", contact: true, project: "P30", by: "saad", day: 8, channel: "visit", outcome: "technical_submitting", text: "مستشفى خاص 1,480 متر، قدمنا الحل الفني وشهادات الحريق" },
  { company: "Northern Gulf General Trading and Contracting Establishment", contact: true, by: "saad", day: 4, channel: "meeting", outcome: "introduced", text: "جاء للمكتب من الجبيل، وسيط توريد، يشتغل مع عدة مقاولين" },

  /* ---- Majed ---- */
  { company: "شركة صروح جدة للمقاولات", contact: true, project: "P36", by: "majed", day: 109, channel: "visit", outcome: "technical_submitting", text: "برج مكاتب على طريق المدينة، قدمنا الحل الفني، اللون رمادي داكن" },
  { company: "مصنع البحر الأحمر للألمنيوم", contact: true, by: "majed", day: 106, channel: "visit", outcome: "introduced", text: "زيارة المصنع، يشتري بكميات، فتحنا حساب" },
  { company: "شركة تلال جدة للمقاولات", project: "P37", by: "majed", day: 97, channel: "call", outcome: "discussed_pricing", text: "مجمع سكني 1,050 متر، ناقشنا السعر" },
  { company: "unico aluminum factory", contact: true, by: "majed", day: 96, channel: "meeting", outcome: "discussed_pricing", text: "جاء للمكتب، يشتري بالحاويات، اتفقنا على سعر الحاوية" },
  { company: "مؤسسة الأفنان للتجارة", by: "majed", day: 90, channel: "call", outcome: "no_answer", text: "ما رد على ثلاث محاولات" },
  { company: "شركة مراسي جدة", contact: true, project: "P38", by: "majed", day: 80, channel: "visit", outcome: "technical_submitting", text: "فندق على الكورنيش، معاينة الواجهة، قدمنا الحل الفني" },
  { company: "مكتب الأثر للاستشارات الهندسية", by: "majed", day: 73, channel: "email", outcome: "documents_sent", text: "أرسلت المواصفات للاعتماد" },
  { company: "مصنع الأصالة للألمنيوم", contact: true, project: "P41", by: "majed", day: 59, channel: "visit", outcome: "discussed_pricing", text: "طلب لون غير متوفر عندنا، عرضت البدائل", signals: [{ signal: "colour_unavailable", reference: "RAL 7016" }] },
  { company: "شركة واجهة للدعاية والإعلان", by: "majed", day: 57, channel: "whatsapp", outcome: "catalogue_sent", text: "أرسلت الكتالوج على الواتساب" },
  { company: "Prime Facade Systems", contact: true, by: "majed", day: 48, channel: "meeting", outcome: "introduced", text: "اجتماع تعريفي في المكتب" },
  { company: "مصنع الينابيع للصناعات المعدنية", contact: true, project: "P39", by: "majed", day: 41, channel: "visit", outcome: "samples_sent", text: "أول طلب من ينبع، سلمت عينات رمادي فاتح" },
  { company: "شركة دار الوفاء للتطوير", by: "majed", day: 34, channel: "call", outcome: "not_interested", text: "قال إن مشاريعهم كلها خرسانة مكشوفة، ما يحتاجون الكلادينج", signals: [{ signal: "specification_unavailable", reference: "واجهة خرسانية مكشوفة" }] },
  { company: "مصنع القاهرة للألمنيوم", contact: true, by: "majed", day: 23, channel: "email", outcome: "documents_sent", text: "عميل مصري، أرسلت المواصفات وشروط الشحن من ميناء جدة" },
  { company: "شركة مرافئ العقارية", contact: true, project: "P40", by: "majed", day: 7, channel: "visit", outcome: "technical_submitting", text: "أبراج جدة 2,400 متر، قدمنا الحل الفني، ينتظرون اعتماد التصميم" },

  /* ---- Turki ---- */
  { company: "شركة ديار الجنوب للمقاولات", contact: true, project: "P42", by: "turki", day: 95, channel: "visit", outcome: "technical_submitting", text: "مبنى بلدية أبها، قدمنا الحل الفني، اللون بيج" },
  { company: "مصنع تهامة للألمنيوم", contact: true, by: "turki", day: 85, channel: "visit", outcome: "introduced", text: "زيارة المصنع في جازان، مصنع متوسط" },
  { company: "شركة عسير للتعمير والمقاولات", by: "turki", day: 79, channel: "call", outcome: "discussed_pricing", text: "مركز صحي 290 متر، ناقشنا السعر" },
  { company: "مصنع بوابة نجران للصناعة", by: "turki", day: 68, channel: "visit", outcome: "catalogue_sent", text: "زيارة نجران، سلمت الكتالوج ولوحة الألوان" },
  { company: "مؤسسة الطريق السريع لإدارة المحطات", contact: true, project: "P45", by: "turki", day: 58, channel: "visit", outcome: "technical_submitting", text: "محطة بيشة، معاينة الموقع، قدمنا تفاصيل المظلة" },
  { company: "مصنع الشروق للتشكيل المعدني", by: "turki", day: 52, channel: "call", outcome: "discussed_pricing", text: "ناقشنا سعر دفعة صغيرة" },
  { company: "شركة الياسمين للمقاولات", contact: true, project: "P43", by: "turki", day: 42, channel: "visit", outcome: "technical_submitting", text: "كورنيش جازان، اللون أزرق، قدمنا الحل الفني" },
  { company: "مكتب الرصانة للاستشارات الهندسية", by: "turki", day: 38, channel: "email", outcome: "documents_sent", text: "أرسلت المواصفات للمكتب" },
  { company: "مؤسسة النقش للدعاية والإعلان", contact: true, by: "turki", day: 30, channel: "whatsapp", outcome: "catalogue_sent", text: "أرسلت الكتالوج على الواتساب" },
  { company: "مصنع المنارة للألمنيوم", by: "turki", day: 26, channel: "call", outcome: "discussed_pricing", text: "دفعة 165 متر، اتفقنا على السعر" },
  { company: "مؤسسة السحاب للاستثمار", contact: true, by: "turki", day: 18, channel: "visit", outcome: "introduced", text: "زيارة تعريفية، مستثمر عنده مبنيين في أبها" },
  { company: "شركة جبال السروات للمقاولات", contact: true, project: "P44", by: "turki", day: 13, channel: "visit", outcome: "technical_submitting", text: "منتجع جبلي 830 متر، اللون خشبي، قدمنا الحل الفني" },
  { company: "مؤسسة بيت الخير للاستثمار", contact: true, by: "turki", day: 6, channel: "call", outcome: "introduced", text: "اتصال تعريفي، عندهم مشروع في جازان" },
  { company: "مصنع الهدى للصناعات المعدنية", by: "turki", day: 2, channel: "visit", outcome: "samples_sent", text: "مصنع جديد، سلمت عينات رمادي، يبي يجربها قبل الطلب" },

  /* ---- Nouf `S9` — she holds companies as a rep does ---- */
  { company: "شركة لمسات للدعاية والإعلان", contact: true, project: "P46", by: "nouf", day: 89, channel: "call", outcome: "discussed_pricing", text: "عميلة قديمة تتعامل مع المكتب مباشرة، لوحات 80 متر، اتفقنا على السعر" },
  { company: "مصنع جسور للصناعات المعدنية", contact: true, by: "nouf", day: 66, channel: "call", outcome: "introduced", text: "اتصال تعريفي من المكتب" },
  { company: "Harbour Square", contact: true, by: "nouf", day: 43, channel: "email", outcome: "documents_sent", text: "عميل من الإمارات، أرسلت المواصفات وشروط الشحن كارجو" },
  { company: "شركة المحترف للدعاية والإعلان", by: "nouf", day: 11, channel: "whatsapp", outcome: "catalogue_sent", text: "أرسلت الكتالوج على الواتساب" },

  /* ---- late signals on live deals: a warning, not a loss `S44` ------ */
  { company: "شركة تمكين للمقاولات", project: "P02", by: "faisal", day: 94, channel: "call", outcome: "discussed_pricing", text: "قال إن مدة التوريد طويلة عليه، شرحت جدول الإنتاج", signals: [{ signal: "lead_time_too_long" }] },
  { company: "شركة الشاطئ الأزرق للمقاولات", project: "P25", by: "saad", day: 50, channel: "call", outcome: "discussed_pricing", text: "طلب دفع على ثلاث دفعات، قلت له إن الشروط تتحدد مع المالية", signals: [{ signal: "payment_terms" }] },
  { company: "شركة مراسي جدة", project: "P38", by: "majed", day: 78, channel: "whatsapp", outcome: "other", text: "المالك يسأل عن شهادة الجودة، أرسلتها له", signals: [{ signal: "other", reference: "طلب شهادة جودة إضافية" }] },

  /* ---- field notes: no company at all `S33`, roughly one in ten ---- */
  { company: null, by: "faisal", day: 99, category: "exhibition", city: "Riyadh", text: "معرض البناء السعودي، وزعنا كتالوجات وأخذنا أرقام تواصل، منافسان جدد في السوق" },
  { company: null, by: "faisal", day: 63, category: "market_research", city: "Riyadh", text: "جولة على المصانع في الصناعية الثانية، أغلبهم يشترون من موردين قدامى، السعر هو العامل الأول" },
  { company: null, by: "saad", day: 88, category: "scouting", city: "Jubail", text: "جولة استكشافية في الجبيل الصناعية، ثلاثة مشاريع تحت الإنشاء ما عرفت المقاول" },
  { company: null, by: "saad", day: 36, category: "training", city: "Dammam", text: "تدريب داخلي على المواصفات الفنية الجديدة ومقاومة الحريق" },
  { company: null, by: "majed", day: 69, category: "exhibition", city: "Jeddah", text: "معرض جدة للتشييد، حضور ضعيف هالسنة، أخذنا خمسة أرقام" },
  { company: null, by: "majed", day: 20, category: "internal", text: "اجتماع الفريق الأسبوعي، مراجعة العروض المعلقة وتوزيع المتابعات" },
  { company: null, by: "turki", day: 71, category: "scouting", city: "Khamis Mushait", text: "جولة في خميس مشيط، سوق صغير بس فيه حركة بناء" },
  { company: null, by: "turki", day: 5, category: "market_research", city: "Abha", text: "سؤال عن أسعار المنافسين في أبها، الفرق تقريباً عشرة بالمئة لصالحهم على الفئات العادية" },
] as const;

/* ------------------------------------------------------------------ *
 * Targets `S83` `S84` — square metres per month, dated rows
 * ------------------------------------------------------------------ */

/**
 * `period` is months back from the current one: 0 is this month.
 *
 * Deliberately uneven, because `D32`'s pace tick is only legible against a
 * range: Faisal reads ahead of the tick, Saad well behind it, Turki almost
 * exactly on it, and **Majed carries no target at all** — `D64`'s first block
 * is absent for him rather than empty, which is the rule's own distinction.
 *
 * **Abdulrahman carries none since `S136`.** He held one until session `25b`;
 * the rule says a person who sells and holds `sees_all_reps` has no target of
 * their own, because their metres are already in the company total. `S83` is
 * untouched — a target is still optional per person and independent of role —
 * and nothing forbids such a row; nothing reads one either.
 *
 * Faisal's current month is set **twice** — `S84` makes a correction a
 * superseding row, never an overwrite, and `/targets` shows both.
 */
export type TargetEntry = {
  user: PersonKey;
  /** Months back from the current one. */
  period: number;
  sqm: string;
  /** Who set it — needs `can_set_targets` `S83`. */
  by: PersonKey;
  /** Days ago the act happened. */
  day: number;
};

export const TARGETS: readonly TargetEntry[] = [
  { user: "faisal", period: 1, sqm: "900", by: "abdulrahman", day: 55 },
  { user: "saad", period: 1, sqm: "2800", by: "abdulrahman", day: 55 },
  { user: "turki", period: 1, sqm: "800", by: "abdulrahman", day: 55 },
  { user: "faisal", period: 0, sqm: "750", by: "abdulrahman", day: 24 },
  /* the correction `S84` — a second row, never an edit of the first */
  { user: "faisal", period: 0, sqm: "800", by: "abdulrahman", day: 16 },
  { user: "saad", period: 0, sqm: "3200", by: "abdulrahman", day: 24 },
  { user: "turki", period: 0, sqm: "1000", by: "abdulrahman", day: 24 },
  /*
   * **Abdulrahman carries no row, and that is `S136` rather than an omission.**
   * He held a personal 400 m² until session `25b`, set by the Executive, and his
   * dashboard read *0 of 400* beside a team table saying his reps had dispatched
   * 5,082 — two correct figures answering different questions. `S136` says a
   * person who sells and holds `sees_all_reps` carries no target of their own:
   * their metres are already inside the company total, so a personal denominator
   * would measure the same work twice. **It was not converted into the company
   * figure either** — the rule makes the two independent decisions, so deriving
   * one from the other is the very thing it forbids.
   *
   * Consequence, so nobody reads it as a defect: `D39`'s team table drops from
   * four rows to three, because it shows only people with a target row.
   */
] as const;

/* ------------------------------------------------------------------ *
 * The company target `S136` — one figure a month, set independently
 * ------------------------------------------------------------------ */

/**
 * **Two rows for the current month, and the pair is the point.** `S84` makes a
 * correction a superseding row rather than an edit, so a fixture with one row
 * cannot tell a reader that picks the row in force from one that picks any row.
 * 5,500 was set first and 6,000 supersedes it: **6,000 is what every screen must
 * show**, and 5,500 appearing anywhere is the defect.
 *
 * **It is NOT the sum of the reps' targets** — those are 800 + 3,200 + 1,000 =
 * 5,000 for this month, deliberately unequal to 6,000. A fixture where the two
 * agreed would let a panel that summed the rep rows pass every assertion.
 *
 * Set by the super admin, the only holder of `can_set_company_target` `S136`.
 */
export type CompanyTargetEntry = {
  /** Months back from the current one. */
  period: number;
  sqm: string;
  /** Who set it — needs `can_set_company_target` `S136`. */
  by: PersonKey;
  /** Days ago the act happened. */
  day: number;
};

export const COMPANY_TARGETS: readonly CompanyTargetEntry[] = [
  { period: 1, sqm: "5000", by: "admin", day: 55 },
  { period: 0, sqm: "5500", by: "admin", day: 24 },
  /* the correction `S84` — a second row, never an edit of the first */
  { period: 0, sqm: "6000", by: "admin", day: 16 },
] as const;

/* ------------------------------------------------------------------ *
 * Shares `S96` — manager-initiated, and edit access `S99`
 * ------------------------------------------------------------------ */

export type ShareEntry = {
  type: "company" | "project" | "quotation_thread";
  /** A company name, a project key or a thread key. */
  target: string;
  to: PersonKey;
  day: number;
};

export const SHARES: readonly ShareEntry[] = [
  { type: "company", target: "شركة النهضة للمقاولات", to: "saad", day: 30 },
  { type: "project", target: "P08", to: "saad", day: 30 },
  { type: "company", target: "شركة صروح جدة للمقاولات", to: "faisal", day: 47 },
  { type: "quotation_thread", target: "T50", to: "faisal", day: 47 },
  { type: "company", target: "شركة الشاطئ الأزرق للمقاولات", to: "majed", day: 18 },
  /* `S97` — per company, THEN per project: the share above reveals none of
   * its projects on its own `S30`, so this is what lets Majed read P25. */
  { type: "project", target: "P25", to: "majed", day: 18 },
] as const;

/* ------------------------------------------------------------------ *
 * Comments `S114` — quotation threads and projects only
 * ------------------------------------------------------------------ */

/**
 * `S114` allows exactly two anchors, and since `27b` the code allows two as
 * well — the `comments_record_type` CHECK, `COMMENT_RECORD_TYPES` and
 * `visibleCommentsFilter` all narrowed with it.
 *
 * **This dataset was already on the rule's side of that gap**, which the
 * narrowing slice confirmed by measurement rather than by reading this comment:
 * the three company comments it deleted were all `verify:routes` residue, and
 * `seed:demo` had written none. The type below is what kept it honest.
 */
export type CommentEntry = {
  on: "project" | "quotation_thread";
  target: string;
  by: PersonKey;
  day: number;
  body: string;
};

export const COMMENTS: readonly CommentEntry[] = [
  { on: "project", target: "P08", by: "saad", day: 28, body: "شفت المشروع، عندي عميل مشابه في الخبر استخدم نفس اللون، أقدر أرسل لك صور التنفيذ" },
  { on: "project", target: "P08", by: "faisal", day: 27, body: "أرسلها، بيساعدني في الاجتماع الجاي معهم" },
  { on: "quotation_thread", target: "T50", by: "faisal", day: 44, body: "العميل سأل عن إمكانية تغيير اللون بعد الإصدار، قلت له إن هذا يحتاج نسخة جديدة" },
  { on: "quotation_thread", target: "T18", by: "abdulrahman", day: 60, body: "هذا البرج من أكبر ما عندنا هالربع، تابعه أسبوعياً" },
  { on: "project", target: "P25", by: "majed", day: 16, body: "الواجهة الجنوبية فيها انحناء، تأكد أن التفاصيل الفنية تغطيها قبل التوريد" },
  { on: "quotation_thread", target: "T53", by: "abdulrahman", day: 18, body: "النسخة الثالثة، أرجو مراجعة السعر مع الإدارة قبل الإصدار" },
] as const;

/* ------------------------------------------------------------------ *
 * The planned diary `[25 §18]` — `date_due`
 * ------------------------------------------------------------------ */

/**
 * `setNextFollowUp` refuses a past date (`follow-ups.ts:1296`), so every entry
 * is set through the writer at today or later and the arrived ones are moved
 * back with their own batch — a rep set a date, and the day came.
 *
 * `arrived` is how many days ago the date fell due; the row is on the list.
 * `future` is a date still ahead, which produces **no row and suppresses its
 * anchor** (`gather` step 2). Both halves of the rule, and only one of them
 * is visible — which is what the rule says.
 *
 * **Three entries share one customer** — the company `شركة النهضة للمقاولات`,
 * its project `P08` and its thread `T53` — so `D34`'s grouping by anchor has
 * something to group and the "same customer at rows 2, 6 and 9" case it exists
 * to prevent is actually on screen.
 */
export type FollowUpEntry = {
  on: "company" | "project" | "quotation_thread";
  target: string;
  by: PersonKey;
  /** Days ago the rep set it — the batch this act runs in. */
  setOn: number;
  /** Days ago the date fell due. Omit for a date still ahead. */
  arrived?: number;
  /** Days from today the date falls. Omit for an arrived one. */
  future?: number;
};

export const FOLLOW_UPS: readonly FollowUpEntry[] = [
  /* arrived — five distinct days, so `D34` is a diary and not one batch */
  { on: "company", target: "شركة النهضة للمقاولات", by: "faisal", setOn: 20, arrived: 12 },
  { on: "quotation_thread", target: "T22", by: "majed", setOn: 19, arrived: 12 },
  { on: "project", target: "P08", by: "faisal", setOn: 14, arrived: 7 },
  { on: "company", target: "مصنع البحر الأحمر للألمنيوم", by: "majed", setOn: 13, arrived: 7 },
  { on: "quotation_thread", target: "T53", by: "faisal", setOn: 9, arrived: 3 },
  { on: "company", target: "شركة ديار الجنوب للمقاولات", by: "turki", setOn: 8, arrived: 3 },
  { on: "project", target: "P25", by: "saad", setOn: 6, arrived: 1 },
  { on: "company", target: "مصنع الرواد للألمنيوم", by: "faisal", setOn: 4, arrived: 0 },
  { on: "company", target: "شركة الربيع للمقاولات العامة", by: "saad", setOn: 3, arrived: 0 },

  /* still ahead — no row, and the anchor is suppressed until it arrives */
  { on: "quotation_thread", target: "T18", by: "faisal", setOn: 0, future: 5 },
  { on: "quotation_thread", target: "T20", by: "saad", setOn: 0, future: 14 },
  { on: "project", target: "P02", by: "faisal", setOn: 0, future: 9 },
  { on: "company", target: "مصنع الواحة للصناعات المعدنية", by: "faisal", setOn: 0, future: 3 },
] as const;
