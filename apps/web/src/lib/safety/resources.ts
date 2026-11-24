/**
 * Curated crisis resources. Public records, verified by hand on the date below against
 * the sources listed. They MUST be re-verified by a named owner before any public pilot
 * (PRD §13 release condition) and on a regular schedule after that.
 */
export type Resource = {
  name: string;
  description: string;
  phone?: string; // dialable string for tel: links
  phoneDisplay?: string;
  sms?: string;
  smsDisplay?: string;
  url?: string;
  hours: string;
  source: string;
};

export type RegionResources = {
  country: string;
  countryName: string;
  emergency: { number: string; label: string };
  resources: Resource[];
  verified_at: string;
};

const VERIFIED = "2026-11-24";

export const RESOURCES: Record<string, RegionResources> = {
  IN: {
    country: "IN",
    countryName: "India",
    emergency: { number: "112", label: "Emergency (112)" },
    verified_at: VERIFIED,
    resources: [
      {
        name: "Tele-MANAS",
        description: "Free national tele-mental-health helpline from the Ministry of Health & Family Welfare, available in many Indian languages.",
        phone: "14416",
        phoneDisplay: "14416 or 1-800-891-4416",
        hours: "24/7",
        source: "https://dghs.mohfw.gov.in/national-mental-health-programme.php",
      },
    ],
  },
  US: {
    country: "US",
    countryName: "United States",
    emergency: { number: "911", label: "Emergency (911)" },
    verified_at: VERIFIED,
    resources: [
      {
        name: "988 Suicide & Crisis Lifeline",
        description: "Free, confidential support for emotional distress, suicidal crisis or substance use concerns. Call, text or chat.",
        phone: "988",
        phoneDisplay: "988",
        sms: "988",
        smsDisplay: "Text 988",
        url: "https://988lifeline.org",
        hours: "24/7",
        source: "https://www.samhsa.gov/mental-health/988/key-messages",
      },
    ],
  },
  GB: {
    country: "GB",
    countryName: "United Kingdom",
    emergency: { number: "999", label: "Emergency (999)" },
    verified_at: VERIFIED,
    resources: [
      {
        name: "Samaritans",
        description: "Free listening support from any phone, day or night.",
        phone: "116123",
        phoneDisplay: "116 123",
        url: "https://www.samaritans.org",
        hours: "24/7",
        source: "https://www.samaritans.org/how-we-can-help/contact-samaritan/",
      },
      {
        name: "SHOUT",
        description: "Free 24/7 text support for anyone in crisis in the UK.",
        sms: "85258",
        smsDisplay: "Text SHOUT to 85258",
        url: "https://giveusashout.org",
        hours: "24/7",
        source: "https://www.samaritans.org/how-we-can-help/contact-samaritan/text-us/",
      },
      {
        name: "NHS 111 (mental health option)",
        description: "Urgent mental health help in England when you can keep yourself safe for a short while.",
        phone: "111",
        phoneDisplay: "111",
        url: "https://www.nhs.uk/nhs-services/mental-health-services/where-to-get-urgent-help-for-mental-health/",
        hours: "24/7",
        source: "https://www.rbkc.gov.uk/health-and-social-care/public-health/suicide-prevention/crisis-and-emergency-support",
      },
    ],
  },
  CA: {
    country: "CA",
    countryName: "Canada",
    emergency: { number: "911", label: "Emergency (911)" },
    verified_at: VERIFIED,
    resources: [
      {
        name: "9-8-8: Suicide Crisis Helpline",
        description: "National, bilingual crisis support by phone and text.",
        phone: "988",
        phoneDisplay: "988",
        sms: "988",
        smsDisplay: "Text 988",
        url: "https://988.ca",
        hours: "24/7",
        source: "https://www.canada.ca/en/public-health/services/mental-health-services/mental-health-get-help.html",
      },
    ],
  },
  AU: {
    country: "AU",
    countryName: "Australia",
    emergency: { number: "000", label: "Emergency (000)" },
    verified_at: VERIFIED,
    resources: [
      {
        name: "Lifeline",
        description: "Crisis support by phone, text and online chat for anyone in Australia.",
        phone: "131114",
        phoneDisplay: "13 11 14",
        sms: "0477131114",
        smsDisplay: "Text 0477 13 11 14",
        url: "https://www.lifeline.org.au",
        hours: "24/7",
        source: "https://www.lifeline.org.au/articles/general/contacting-lifeline",
      },
    ],
  },
  OTHER: {
    country: "OTHER",
    countryName: "Other countries",
    emergency: { number: "", label: "Your local emergency number" },
    verified_at: VERIFIED,
    resources: [
      {
        name: "Find A Helpline",
        description: "Directory of free, confidential helplines in many countries.",
        url: "https://findahelpline.com",
        hours: "Varies by service",
        source: "https://findahelpline.com",
      },
    ],
  },
};

export function resourcesFor(country?: string | null): RegionResources {
  return RESOURCES[country ?? ""] ?? RESOURCES.OTHER;
}
