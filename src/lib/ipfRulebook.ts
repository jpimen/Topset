export interface RulebookEntry {
  section: string;
  title: string;
  page: number;
  summary: string;
}

export interface RulebookChapter {
  section: string;
  title: string;
  entries: RulebookEntry[];
}

export const IPF_RULEBOOK_PDF_URL = 'https://www.powerlifting.sport/fileadmin/ipf/data/rules/technical-rules/english/2026_IPF_Technical_Rulebook__effective_01_March_2026__v3.pdf';
export const IPF_RULES_INDEX_URL = 'https://www.powerlifting.sport/rules/codes/info/technical-rules';
export const IPF_CHANGES_URL = 'https://www.powerlifting.sport/fileadmin/ipf/data/rules/technical-rules/english/2026_IPF_Technical_Rulebook_Changes-_Explanations.pdf';

// Section titles and printed page locators follow the 2026 PDF contents page.
// Summaries are original quick-reference notes; the linked English PDF governs.
export const IPF_RULEBOOK_CHAPTERS: RulebookChapter[] = [
  {
    section: '1', title: 'General Rules of Powerlifting', entries: [
      { section: '1', title: 'General rules', page: 4, summary: 'Sets out the lifts and total, competition categories, attempts, placing, championships and general event requirements.' },
      { section: '1.1', title: 'Age categories', page: 5, summary: 'Defines Open, Sub-Junior, Junior and Masters age divisions by calendar year and age.' },
      { section: '1.2', title: 'Bodyweight categories', page: 5, summary: 'Lists men’s and women’s class limits in category tables, including the Sub-Junior and Junior-only lightest classes.' },
    ],
  },
  {
    section: '2', title: 'Equipment and Specifications', entries: [
      { section: '2', title: 'Equipment overview', page: 7, summary: 'Specifies competition equipment and its required dimensions, condition and use.' },
      { section: '2.1', title: 'Scales', page: 7, summary: 'Covers scale type, precision, capacity and calibration certification.' },
      { section: '2.2', title: 'Platform', page: 7, summary: 'Sets platform size, height, level surface and permitted non-slip covering requirements.' },
      { section: '2.3', title: 'Bars and discs', page: 8, summary: 'Defines bar and disc dimensions, weights, markings and approval. The section begins on printed page 7 and includes a disc face-value tolerance table on page 8.' },
      { section: '2.4', title: 'Collars', page: 9, summary: 'Specifies the collars used to secure discs on the bar during competition.' },
      { section: '2.5', title: 'Squat racks', page: 9, summary: 'Sets requirements for squat racks used to unrack and rerack the bar.' },
      { section: '2.6', title: 'Bench', page: 9, summary: 'Defines the competition bench’s required construction and dimensions.' },
      { section: '2.7', title: 'Clocks', page: 9, summary: 'Describes the timing equipment used to display the competition clock.' },
      { section: '2.8', title: 'Lights', page: 10, summary: 'Specifies the referee light system used to indicate decisions on attempts.' },
      { section: '2.9', title: 'Failure cards / Paddles', page: 10, summary: 'Describes the numbered signals referees use to identify causes of a failed attempt.' },
      { section: '2.10', title: 'Scoreboard', page: 12, summary: 'Lists information that must be displayed for lifters and the audience during the meet.' },
    ],
  },
  {
    section: '3', title: 'Personal Equipment', entries: [
      { section: '3', title: 'Personal equipment overview', page: 13, summary: 'Sets the permitted personal-equipment framework for Classic and Equipped lifting.' },
      { section: '3.1', title: 'Suits', page: 13, summary: 'Defines permitted lifting suits, including construction and approval conditions.' },
      { section: '3.2', title: 'T-shirt', page: 14, summary: 'Sets requirements for the shirt worn under a lifting suit or for Classic lifting.' },
      { section: '3.3', title: 'Supportive shirts', page: 15, summary: 'Covers supportive bench shirts permitted in Equipped competition.' },
      { section: '3.4', title: 'Briefs', page: 16, summary: 'Defines permitted briefs and their use with lifting suits.' },
      { section: '3.5', title: 'Socks', page: 16, summary: 'Specifies sock requirements, including coverage for the deadlift.' },
      { section: '3.6', title: 'Belt', page: 16, summary: 'Sets belt construction, dimensions and wearing requirements.' },
      { section: '3.7', title: 'Shoes or boots', page: 17, summary: 'Defines acceptable footwear for lifting.' },
      { section: '3.8', title: 'Knee sleeves', page: 17, summary: 'Covers permitted knee sleeves, their construction and use.' },
      { section: '3.9', title: 'Wraps', page: 18, summary: 'Sets rules for wrist and knee wraps, including permitted types and application.' },
      { section: '3.10', title: 'Head wear', page: 18, summary: 'States the conditions for headwear during competition.' },
      { section: '3.11', title: 'Medical tape', page: 18, summary: 'Defines when and how medical tape may be worn.' },
      { section: '3.12', title: 'Inspection of personal equipment', page: 19, summary: 'Explains when equipment is inspected and what happens if an item is not permitted.' },
      { section: '3.13', title: 'Sponsor’s logos', page: 19, summary: 'Sets the conditions for displaying sponsor logos on personal equipment.' },
      { section: '3.14', title: 'General', page: 20, summary: 'Covers general personal-equipment conditions, including permitted substances and items.' },
    ],
  },
  {
    section: '4', title: 'Powerlifting and Rules of Performance', entries: [
      { section: '4', title: 'Rules of performance overview', page: 20, summary: 'Introduces the performance standards for the squat, bench press and deadlift.' },
      { section: '4.1', title: 'Squat', page: 20, summary: 'Describes the squat setup, referee commands, depth standard and completion of the lift.' },
      { section: '4.1.1', title: 'Causes of disqualification of a Squat', page: 21, summary: 'Lists actions and omissions that make a squat attempt unsuccessful.' },
      { section: '4.2', title: 'Bench press', page: 22, summary: 'Describes bench setup, referee commands, execution and completion requirements.' },
      { section: '4.2.1', title: 'Causes of disqualification of a Bench press', page: 24, summary: 'Lists actions and omissions that make a bench press attempt unsuccessful.' },
      { section: '4.2.2', title: 'Rules for the Disabled athletes Competing in IPF Single Lift Bench press Championships', page: 24, summary: 'Provides modified bench-press provisions for disabled athletes in the specified IPF single-lift championships.' },
      { section: '4.3', title: 'Deadlift', page: 25, summary: 'Describes the deadlift start, completion standard and referee signal.' },
      { section: '4.3.1', title: 'Causes of disqualification of a deadlift', page: 25, summary: 'Lists actions and omissions that make a deadlift attempt unsuccessful.' },
    ],
  },
  { section: '5', title: 'Weighing In', entries: [
    { section: '5', title: 'Weighing in', page: 26, summary: 'Covers weigh-in timing, athlete identification, bodyweight recording, clothing and category confirmation.' },
  ] },
  {
    section: '6', title: 'Order of Competition', entries: [
      { section: '6', title: 'Competition order overview', page: 27, summary: 'Sets the procedures for arranging attempts and running a lifting session.' },
      { section: '6.1', title: 'The round system', page: 27, summary: 'Explains attempt declarations, attempt order, round progression and timing between attempts.' },
      { section: '6.2', title: 'Responsibilities of the officials', page: 31, summary: 'Assigns meet-day duties to the officials involved in operating the competition.' },
      { section: '6.3', title: 'Miscellaneous Rules (loading errors, misconduct, appeals etc.)', page: 32, summary: 'Covers competition interruptions and procedures for loading errors, misconduct and appeals.' },
    ],
  },
  { section: '7', title: 'Referees', entries: [
    { section: '7', title: 'Referees', page: 36, summary: 'Defines referee eligibility, appointments, conduct, decisions and the practical judging process.' },
  ] },
  {
    section: '8', title: 'Jury and Technical Committee', entries: [
      { section: '8', title: 'Jury and Technical Committee overview', page: 41, summary: 'Introduces the oversight and technical roles used at IPF competitions.' },
      { section: '8.1', title: 'Jury', page: 41, summary: 'Describes jury composition, authority and procedures for reviewing competition matters.' },
      { section: '8.2', title: 'IPF Technical Committee', page: 42, summary: 'Defines the Technical Committee’s responsibilities for technical rules and competition standards.' },
    ],
  },
  {
    section: '9', title: 'World and International Records', entries: [
      { section: '9', title: 'World and international records overview', page: 42, summary: 'Sets the framework for recognition and recording of IPF records.' },
      { section: '9.1', title: 'International Competitions', page: 42, summary: 'States competition and equipment conditions relevant to setting and recognizing records.' },
    ],
  },
  { section: '10', title: 'Coach Responsibilities', entries: [
    { section: '10', title: 'Coach responsibilities', page: 44, summary: 'Outlines coach conduct, access and responsibilities during the competition.' },
  ] },
];

export function searchRulebookEntries(query: string, chapters = IPF_RULEBOOK_CHAPTERS): RulebookChapter[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return chapters;

  return chapters.map((chapter) => ({
    ...chapter,
    entries: chapter.entries.filter((entry) =>
      `${entry.section} ${entry.title} ${entry.summary}`.toLocaleLowerCase().includes(normalized),
    ),
  })).filter((chapter) => chapter.entries.length > 0);
}
