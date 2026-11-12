import { readFile } from "node:fs/promises";
import {
  profileSchema,
  storySchema,
  states,
  type VisaCase,
} from "../shared/schema";

// Preview fixtures never enter the database or the email/reminder pipeline.
export function demoEnabled(env = process.env) {
  return env.NODE_ENV !== "production" && env.DEMO_DATA === "true";
}

export async function createDemoData(now = new Date()) {
  const date = (daysAgo: number) =>
    new Date(+now - daysAgo * 86400000).toISOString().slice(0, 10);
  const timestamp = (daysAgo: number) => `${date(daysAgo)}T12:00:00.000Z`;
  const boundaries = JSON.parse(
    await readFile("public/data/districts.json", "utf8"),
  );
  const districts = boundaries.features
    .map((f: any) => f.properties)
    .filter((p: any) => states.some((s) => s[0] === p.STATE))
    .sort((a: any, b: any) => a.GEOID.localeCompare(b.GEOID));
  const posts = [
    ["India", "Mumbai"],
    ["Mexico", "Ciudad Juárez"],
    ["Philippines", "Manila"],
    ["Colombia", "Bogotá"],
    ["Pakistan", "Islamabad"],
    ["Nigeria", "Lagos"],
    ["United Kingdom", "London"],
    ["Canada", "Montreal"],
    ["Vietnam", "Ho Chi Minh City"],
    ["Bangladesh", "Dhaka"],
    ["Brazil", "Rio de Janeiro"],
    ["Ghana", "Accra"],
  ];
  const categories = [
    "CR-1",
    "IR-1",
    "K-1",
    "IR-5",
    "F2A",
    "EB-2",
    "F-1",
    "H-1B",
  ] as const;
  const firstNames = [
    "Maya",
    "Daniel",
    "Aisha",
    "Luis",
    "Priya",
    "Sam",
    "Elena",
    "Noah",
    "Amara",
    "Alex",
    "Sofia",
    "Jordan",
  ];
  const lastNames = [
    "Rivera",
    "Chen",
    "Morgan",
    "Patel",
    "Brooks",
    "Reed",
    "Silva",
    "Park",
    "Ali",
    "Santos",
    "Taylor",
  ];
  const cityByState: Record<string, string> = {
    CA: "Los Angeles",
    TX: "Houston",
    NY: "New York",
    FL: "Miami",
    WA: "Seattle",
    VA: "Arlington",
    IL: "Chicago",
    NJ: "Newark",
    MA: "Boston",
    GA: "Atlanta",
  };
  let seed = 4217;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];
  const weightedDistricts = districts.flatMap((d: any) => {
    const state = states.find((s) => s[0] === d.STATE)![1];
    return Array.from(
      {
        length: ["CA", "TX", "NY", "FL", "WA", "VA", "NJ"].includes(state)
          ? 5
          : 1,
      },
      () => d,
    );
  });

  function visaCase(index: number, sequence: number): VisaCase {
    const [country, post] = posts[(index + sequence * 7) % posts.length];
    const age = 210 + Math.floor(random() * 650);
    const stage = index % 8;
    const category =
      categories[(Math.floor(index / 8) + sequence) % categories.length];
    const nonimmigrant = category === "F-1" || category === "H-1B";
    const milestones: [VisaCase["events"][number]["type"], number][] = [
      ["Filed", age],
      ["NOA1", age - 8],
    ];
    if (stage !== 0)
      milestones.push(
        ["NOA2", age - 90],
        ["At NVC", age - 110],
        ["Documentarily qualified", age - 135],
      );
    if (stage >= 2) milestones.push(["In transit", 65], ["Ready", 60]);
    if (stage >= 3) milestones.push(["Interview", 45]);
    if (stage === 3)
      milestones.push(["Administrative processing / 221(g)", 44]);
    if (stage === 4)
      milestones.push(
        ["Administrative processing / 221(g)", 44],
        ["Interview", 12],
      );
    if (stage === 5) milestones.push(["Approved", 32], ["Visa issued", 25]);
    if (stage === 6) milestones.push(["Final refusal", 30]);
    if (stage === 7) milestones.push(["Final refusal", 30], ["Reopened", 15]);
    if (stage === 2) milestones.push(["Interview", -14 - (index % 30)]);
    return {
      id: `demo-case-${index}-${sequence}`,
      applicantName: `${firstNames[(index + 4) % firstNames.length]} (fictional)`,
      relationship: sequence ? "Child" : "Spouse / partner",
      country,
      post,
      category,
      updatedAt: timestamp(index < 8 ? index : Math.floor(random() * 115)),
      events: milestones
        .filter(
          ([type]) =>
            !nonimmigrant ||
            ![
              "At NVC",
              "Documentarily qualified",
              "In transit",
              ...(category === "F-1" ? ["NOA1", "NOA2"] : []),
            ].includes(type),
        )
        .map(([type, days], n) => ({
          id: `event-${n}`,
          type,
          date: date(days),
          note: "Illustrative milestone, not a real visa record.",
        })),
    };
  }

  const profiles = Array.from({ length: 840 }, (_, index) => {
    const district = pick<any>(weightedDistricts);
    const state = states.find((s) => s[0] === district.STATE)!;
    const abroad = index > 7 && index % 13 === 0;
    const involved = index < 8 || index % 5 !== 0;
    const cases = involved ? [visaCase(index, 0)] : [];
    if (involved && index % 9 === 0) cases.push(visaCase(index, 1));
    const profile = profileSchema.parse({
      name: `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length) % lastNames.length]} · Demo ${index + 1}`,
      legalStatus: abroad
        ? "Other"
        : index % 4 === 0
          ? "Permanent resident"
          : "US citizen",
      country: abroad ? posts[index % posts.length][0] : "United States",
      city: abroad
        ? posts[index % posts.length][1]
        : cityByState[state[1]] || `${state[2]} sample city`,
      state: abroad ? "" : state[1],
      district: abroad ? "" : district.CD119,
      politicalAffiliation: [
        "Democratic",
        "Independent",
        "Republican",
        "Other",
        "",
      ][index % 5],
      personallyInvolved: involved,
      signed: true,
      publicConsent: true,
      adultConsent: true,
      reminders: false,
      cases,
    });
    const {
      reminders,
      reminderEmails,
      signed,
      publicConsent,
      adultConsent,
      ...publicFields
    } = profile;
    return {
      ...publicFields,
      id: `demo-${index}`,
      updatedAt: timestamp(index % 115),
      signedAt: timestamp(120 + (index % 200)),
    };
  });

  const narratives = [
    [
      "Two homes, one family",
      "We budget for two rents and plan our weeks around a video call. All we want is a date we can plan around.",
      "Our kitchen calendar has a space where a moving date should be. We have stopped buying flights far in advance because each trip depends on work leave and another month of rent. A clearer timeline would help us make ordinary decisions together.",
      "Two households",
      "Travel costs",
    ],
    [
      "Another birthday over video",
      "Our daughter held her birthday cake up to the screen so her dad could help blow out the candles.",
      "We try to keep the small routines: reading the same bedtime book, calling before school, saving drawings for the next visit. We would like to know what comes next in the process instead of guessing when we can all be in the same room.",
      "Missed milestones",
      "Parenting apart",
    ],
    [
      "Ready for the interview",
      "Our paperwork is ready and an interview is on the calendar. We are trying to plan the travel without getting ahead of ourselves.",
      "Getting to the consulate means a long trip, hotel rooms, and time away from work. We have set aside the money and checked the document list again. Clear instructions about what to bring would make this part less stressful.",
      "Time off work",
      "Interview travel",
    ],
    [
      "Waiting after the interview",
      "We left the interview with another step to complete, but no estimate of how long it would take.",
      "We check for updates every week. It is hard to explain to family why an interview did not mean we were nearly finished. Knowing whether anything else is needed from us would help, even if a decision still takes time.",
      "Administrative processing",
      "Uncertain plans",
    ],
    [
      "A second trip to the consulate",
      "A follow-up interview meant arranging another flight and asking for another day away from work.",
      "We keep every receipt and copy of every document in a folder. The second interview is behind us now, but we still cannot set a moving date. We hope future families get clearer instructions earlier in the process.",
      "Repeat interviews",
      "Extra expenses",
    ],
    [
      "Finally, the same front door",
      "The visa arrived. For the first time, we can make plans without checking when the next visit has to end.",
      "We are grateful to have a decision and to start the move. Looking back, the hardest part was not knowing which plans were safe to make. We are sharing this example to show what a completed timeline looks like alongside families still waiting.",
      "Reunited",
      "Moving home",
    ],
    [
      "Trying to understand the decision",
      "After the final decision, we are taking time to understand the explanation and what options might remain.",
      "We had been organizing our lives around a possible move. Now we need to reconsider those plans and understand the information we received. Clear written explanations matter just as much when the answer is not the one a family hoped for.",
      "Final decision",
      "Changed plans",
    ],
    [
      "Our case is moving again",
      "Our case was reopened. We are keeping the timeline up to date while we wait for the next step.",
      "We had put the moving boxes away. Now there is movement again, but we do not know when another decision will come. Keeping the dates in one place helps us explain the history without having to reconstruct it every time.",
      "Reopened case",
      "Keeping records",
    ],
  ];
  const photo = `data:image/jpeg;base64,${(await readFile("public/hero-family.jpg")).toString("base64")}`;
  const stories = narratives.map(
    ([title, summary, body, ...impacts], index) => {
      const profile = profiles[index];
      const story = storySchema.parse({
        title,
        summary,
        body: `Fictional demo story. Any photograph is illustrative and does not depict the people described.\n\n${body}`,
        impacts,
        support:
          "Demo request: clearer case updates and help understanding the next step. This is not a real request for assistance.",
        caseId: profile.cases[0].id,
        photos: index === 0 || index === 5 ? [photo] : [],
        publish: true,
        rightsConsent: true,
      });
      const { publish, rightsConsent, ...publicFields } = story;
      return {
        ...publicFields,
        id: profile.id,
        name: profile.name,
        country: profile.country,
        updatedAt: profile.updatedAt,
        timeline: profile.cases[0].events,
      };
    },
  );
  return { profiles, stories };
}
