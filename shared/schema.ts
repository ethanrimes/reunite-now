import { z } from "zod";
import { caseRoles, rolesFor, relationshipsFor } from "./visa-workflow";
export const legalStatuses = [
  "US citizen",
  "Permanent resident",
  "Other",
] as const;
export const visaCategories = [
  "K-1",
  "K-2",
  "CR-1",
  "IR-1",
  "IR-2",
  "IR-5",
  "F1",
  "F2A",
  "F2B",
  "F3",
  "F4",
  "EB-1",
  "EB-2",
  "EB-3",
  "EB-4",
  "EB-5",
  "DV",
  "B-1/B-2",
  "F-1",
  "J-1",
  "H-1B",
  "L-1",
  "O-1",
  "Other",
] as const;
export const eventTypes = [
  "Filed",
  "NOA1",
  "NOA2",
  "At NVC",
  "At KCC",
  "Visa application submitted",
  "Documentarily qualified",
  "In transit",
  "Ready",
  "Interview",
  "Administrative processing / 221(g)",
  "Policy-related refusal",
  "Final refusal",
  "Approved",
  "Visa issued",
  "Withdrawn",
  "Reopened",
] as const;
export const states = [
  ["01", "AL", "Alabama"],
  ["02", "AK", "Alaska"],
  ["04", "AZ", "Arizona"],
  ["05", "AR", "Arkansas"],
  ["06", "CA", "California"],
  ["08", "CO", "Colorado"],
  ["09", "CT", "Connecticut"],
  ["10", "DE", "Delaware"],
  ["11", "DC", "District of Columbia"],
  ["12", "FL", "Florida"],
  ["13", "GA", "Georgia"],
  ["15", "HI", "Hawaii"],
  ["16", "ID", "Idaho"],
  ["17", "IL", "Illinois"],
  ["18", "IN", "Indiana"],
  ["19", "IA", "Iowa"],
  ["20", "KS", "Kansas"],
  ["21", "KY", "Kentucky"],
  ["22", "LA", "Louisiana"],
  ["23", "ME", "Maine"],
  ["24", "MD", "Maryland"],
  ["25", "MA", "Massachusetts"],
  ["26", "MI", "Michigan"],
  ["27", "MN", "Minnesota"],
  ["28", "MS", "Mississippi"],
  ["29", "MO", "Missouri"],
  ["30", "MT", "Montana"],
  ["31", "NE", "Nebraska"],
  ["32", "NV", "Nevada"],
  ["33", "NH", "New Hampshire"],
  ["34", "NJ", "New Jersey"],
  ["35", "NM", "New Mexico"],
  ["36", "NY", "New York"],
  ["37", "NC", "North Carolina"],
  ["38", "ND", "North Dakota"],
  ["39", "OH", "Ohio"],
  ["40", "OK", "Oklahoma"],
  ["41", "OR", "Oregon"],
  ["42", "PA", "Pennsylvania"],
  ["44", "RI", "Rhode Island"],
  ["45", "SC", "South Carolina"],
  ["46", "SD", "South Dakota"],
  ["47", "TN", "Tennessee"],
  ["48", "TX", "Texas"],
  ["49", "UT", "Utah"],
  ["50", "VT", "Vermont"],
  ["51", "VA", "Virginia"],
  ["53", "WA", "Washington"],
  ["54", "WV", "West Virginia"],
  ["55", "WI", "Wisconsin"],
  ["56", "WY", "Wyoming"],
  ["60", "AS", "American Samoa"],
  ["66", "GU", "Guam"],
  ["69", "MP", "Northern Mariana Islands"],
  ["72", "PR", "Puerto Rico"],
  ["78", "VI", "US Virgin Islands"],
];
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => {
    const x = new Date(`${d}T00:00:00Z`);
    return !isNaN(+x) && x.toISOString().slice(0, 10) === d;
  }, "Use a valid calendar date");
export const eventSchema = z
  .object({
    id: z.string().min(1).max(80),
    type: z.enum(eventTypes),
    date: dateSchema,
    note: z.string().max(1000).default(""),
  })
  .superRefine((e, c) => {
    if (
      e.type !== "Interview" &&
      e.date > new Date().toISOString().slice(0, 10)
    )
      c.addIssue({
        code: "custom",
        path: ["date"],
        message: "Only interview appointments may be in the future",
      });
  });
export const caseSchema = z
  .object({
    id: z.string().min(1).max(80),
    applicantName: z.string().trim().min(1).max(100),
    relationship: z.enum([
      "Self",
      "Spouse / partner",
      "Child",
      "Parent",
      "Sibling",
      "Other",
    ]),
    country: z.string().min(2).max(100),
    nationality: z.string().min(2).max(100).optional(),
    role: z.enum(caseRoles).optional(),
    category: z.enum(visaCategories),
    post: z.string().trim().min(2).max(120),
    events: z.array(eventSchema).min(1).max(100),
    updatedAt: z.string().optional(),
  })
  .superRefine((v, c) => {
    if (
      v.role &&
      (!rolesFor(v.category, false).includes(v.role) ||
        !relationshipsFor(v.category, v.role).includes(v.relationship))
    )
      c.addIssue({
        code: "custom",
        path: ["relationship"],
        message:
          "Choose a relationship that matches your role and visa category",
      });
    const ids = v.events.map((e) => e.id);
    if (new Set(ids).size !== ids.length)
      c.addIssue({
        code: "custom",
        path: ["events"],
        message: "Timeline event IDs must be unique",
      });
    const filed = v.events
      .filter((e) => e.type === "Filed")
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (filed && v.events.some((e) => e.date < filed.date))
      c.addIssue({
        code: "custom",
        path: ["events"],
        message: "Timeline events cannot precede filing",
      });
  });
export const reminderEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Use a valid email address")
  .max(254);
export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    legalStatus: z.enum(legalStatuses),
    country: z.string().min(2).max(100),
    city: z.string().trim().min(2).max(100),
    state: z.string().max(2).default(""),
    district: z.string().max(2).default(""),
    politicalAffiliation: z
      .enum(["", "Democratic", "Independent", "Republican", "Other"])
      .default(""),
    personallyInvolved: z.boolean(),
    signed: z.literal(true),
    publicConsent: z.literal(true),
    adultConsent: z.literal(true),
    reminders: z.boolean(),
    reminderEmails: z
      .array(reminderEmailSchema)
      .max(5, "Add no more than 5 additional reminder emails")
      .transform((emails) => [...new Set(emails)])
      .default([]),
    cases: z.array(caseSchema).max(20),
  })
  .superRefine((p, c) => {
    if (p.country === "United States") {
      if (!states.some((s) => s[1] === p.state))
        c.addIssue({
          code: "custom",
          path: ["state"],
          message: "Select a US state or territory",
        });
      if (!/^\d{2}$/.test(p.district))
        c.addIssue({
          code: "custom",
          path: ["district"],
          message: "Select your congressional district",
        });
    }
    if (
      p.legalStatus === "US citizen" &&
      p.cases.some((v) => v.relationship === "Self")
    )
      c.addIssue({
        code: "custom",
        path: ["cases"],
        message: "US citizens may add visa cases for others, not themselves",
      });
    if (new Set(p.cases.map((v) => v.id)).size !== p.cases.length)
      c.addIssue({
        code: "custom",
        path: ["cases"],
        message: "Case IDs must be unique",
      });
  });
// Keep historical profiles readable; stronger requirements apply when a member saves.
export const profileWriteSchema = profileSchema.superRefine((p, c) => {
  if (p.personallyInvolved && !p.cases.length)
    c.addIssue({
      code: "custom",
      path: ["cases"],
      message: "Add at least one visa case when you are personally involved",
    });
  if (!p.personallyInvolved && p.cases.length)
    c.addIssue({
      code: "custom",
      path: ["cases"],
      message: "Choose personally involved to include visa cases",
    });
  p.cases.forEach((v, i) => {
    if (!v.role)
      c.addIssue({
        code: "custom",
        path: ["cases", i, "role"],
        message: "Choose your role for each visa case",
      });
    if (!v.nationality)
      c.addIssue({
        code: "custom",
        path: ["cases", i, "nationality"],
        message: "Confirm the applicant nationality for each visa case",
      });
  });
});
export const storySchema = z.object({
  title: z.string().trim().min(8).max(120),
  summary: z.string().trim().min(20).max(240),
  body: z.string().trim().min(60).max(12000),
  impacts: z.array(z.string().max(80)).max(10),
  support: z.string().max(2000),
  caseId: z.string().max(80),
  photos: z
    .array(
      z
        .string()
        .max(1500000)
        .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
    )
    .max(4),
  publish: z.boolean(),
  rightsConsent: z.literal(true),
});
export type VisaEvent = z.infer<typeof eventSchema>;
export type VisaCase = z.infer<typeof caseSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Story = z.infer<typeof storySchema>;
export type PublicProfile = Omit<
  Profile,
  "reminders" | "reminderEmails" | "adultConsent" | "publicConsent" | "signed"
> & {
  id: string;
  updatedAt: string;
  signedAt: string;
};
export type PublicStory = Story & {
  id: string;
  name: string;
  country: string;
  updatedAt: string;
  timeline: VisaEvent[];
};
