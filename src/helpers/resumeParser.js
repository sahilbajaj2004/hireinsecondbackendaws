const fs = require("fs/promises");
const { PDFParse } = require("pdf-parse");

const SECTION_NAMES = {
  summary: [
    "summary",
    "professional summary",
    "profile",
    "about me",
    "about",
    "objective",
    "career objective",
    "executive summary",
    "personal profile",
  ],
  skills: [
    "skills",
    "skill highlights",
    "key skills",
    "technical skills",
    "core skills",
    "core competencies",
    "competencies",
    "technologies",
    "tech stack",
    "tools & technologies",
    "areas of expertise",
    "programming skills",
    "languages & frameworks",
    "languages & databases",
  ],
  experience: [
    "experience",
    "work experience",
    "professional experience",
    "employment",
    "employment history",
    "work history",
    "career history",
    "relevant experience",
  ],
  education: [
    "education",
    "academic background",
    "academic qualifications",
    "qualifications",
    "educational background",
    "academic credentials",
    "academics",
  ],
  projects: [
    "projects",
    "academic projects",
    "personal projects",
    "key projects",
    "notable projects",
    "recent projects",
    "selected projects",
  ],
  certifications: [
    "certifications",
    "certificates",
    "achievements",
    "awards",
    "honors",
    "licenses & certifications",
    "accreditations",
    "accomplishments",
  ],
  other: [
    "languages",
    "interests",
    "references",
    "volunteer",
    "publications",
    "activities",
  ],
};

const SECTION_LOOKUP = new Map(
  Object.entries(SECTION_NAMES).flatMap(([section, names]) =>
    names.map((name) => [name, section])
  )
);

const ROLE_WORDS =
  /\b(developer|engineer|designer|manager|lead|architect|consultant|analyst|administrator|specialist|officer|director|head|associate|intern|internship|recruiter|executive|founder|co-founder|product|marketing|sales|accountant|teacher|professor|freelancer)\b/i;
const COMPANY_WORDS =
  /\b(pvt|private|limited|ltd|inc|llc|corp|corporation|company|technologies|solutions|services|labs|studio|fiverr|freelancer|upwork)\b/i;
const DEGREE_WORDS =
  /\b(b\.?(?:tech|e|sc|a|com|ca)|m\.?(?:tech|e|sc|a|com|ba|ca)|bachelor|master|diploma|ph\.?d|doctorate|degree|bca|mca|btech|mtech|bba|mba|bsc|msc|bcom|mcom|intermediate|matriculation|high\s+school|secondary)\b/i;
const INSTITUTION_WORDS =
  /\b(university|college|institute|school|academy|campus|polytechnic|vidyalaya)\b/i;
const ROLE_OR_COMPANY =
  /\b(freelance|freelancer|intern|internship|developer|engineer|consultant|technologies|solutions|services|limited|ltd|pvt|inc)\b/i;
const KNOWN_LOCATIONS =
  /\b(delhi|mumbai|bangalore|bengaluru|hyderabad|chennai|pune|noida|gurugram|gurgaon|kolkata|ahmedabad|jaipur|lucknow|chandigarh|new york|san francisco|london|remote|india|usa|uk|canada|germany)\b/i;

const MONTH =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DATE = `(?:${MONTH}\\.?\\s+)?(?:19|20)\\d{2}|(?:0?[1-9]|1[0-2])[\\/-](?:19|20)\\d{2}`;
const DATE_RANGE = new RegExp(
  `\\b(${DATE})\\s*(?:-|–|—|to)\\s*(${DATE}|present|current|till\\s+date)\\b`,
  "i"
);

const CATEGORY_PREFIX =
  /^(?:technical\s+skills|programming\s+languages|languages\s*&?\s*databases|languages|frameworks\s*&?\s*libraries|frameworks\/technologies|frameworks|libraries|databases\s*&?\s*caching|databases|tools\s*&?\s*platforms|tools|platforms|developer\s+tools|technologies|concepts|core\s+competencies|competencies|methodologies|cloud\s*&?\s*devops|devops|soft\s+skills|other\s+skills)\s*[:|\-–—]?\s*/i;

function cleanLines(text) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(
      (line) =>
        line &&
        !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line) &&
        !/^[=\-_]{3,}$/.test(line)
    );
}

function sectionForLine(line) {
  const normalized = line
    .toLowerCase()
    .replace(/[:|\-–—*#]+$/, "")
    .replace(/^[#*]+\s*/, "")
    .trim();
  return SECTION_LOOKUP.get(normalized);
}

function splitSections(lines) {
  const sections = {
    header: [],
    summary: [],
    skills: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    other: [],
  };
  let current = "header";

  for (const line of lines) {
    const section = sectionForLine(line);
    if (section) {
      current = section;
    } else {
      sections[current].push(line);
    }
  }
  return sections;
}

function firstLabelledValue(lines, labels) {
  const labelPattern = labels.join("|");
  const regex = new RegExp(`^(?:${labelPattern})\\s*[:\\-]\\s*(.+)$`, "i");
  const labelOnly = new RegExp(`^(?:${labelPattern})\\s*[:\\-]?\\s*$`, "i");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(regex);
    if (match?.[1]) return match[1].trim();
    if (labelOnly.test(line) && lines[index + 1])
      return lines[index + 1].trim();
  }
  return "";
}

function extractEmail(text) {
  const mailtoMatch = text.match(
    /mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i
  );
  if (mailtoMatch) return mailtoMatch[1];
  return (
    text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || ""
  );
}

function extractPhone(text, sections = null) {
  if (sections?.header) {
    const labelled = firstLabelledValue(sections.header, [
      "phone",
      "mobile",
      "contact",
      "tel",
    ]);
    if (labelled) {
      const cleanDigits = labelled.replace(/\D/g, "");
      if (cleanDigits.length >= 7) return labelled.trim();
    }
  }
  const telMatch = text.match(/tel:([+\d\s.-]+)/i);
  if (telMatch) {
    const digits = telMatch[1].replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 15) return telMatch[1].trim();
  }
  const candidates =
    text.match(
      /(?:\+?\d{1,3}[\s.-]*)?(?:\(?\d{2,5}\)?[\s.-]*)?\d(?:[\s.-]*\d){7,11}/g
    ) || [];
  return (
    candidates
      .find((value) => {
        const digits = value.replace(/\D/g, "");
        return digits.length >= 8 && digits.length <= 15;
      })
      ?.trim() || ""
  );
}

function normalizeUrl(value) {
  const cleaned = value.replace(/[),.;]+$/, "").trim();
  return /^https?:\/\//i.test(cleaned)
    ? cleaned
    : `https://${cleaned.replace(/^www\./i, "")}`;
}

function extractLinks(text) {
  const mdMatches = [
    ...text.matchAll(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/gi),
  ].map((m) => m[2]);
  const rawMatches =
    text.match(
      /(?:https?:\/\/|www\.)[^\s<>)"]+|(?:linkedin\.com\/in|github\.com)\/[^\s<>)"]+/gi
    ) || [];
  const allUrls = [
    ...new Set([...mdMatches, ...rawMatches].map(normalizeUrl)),
  ];

  return {
    linkedinUrl:
      allUrls.find((url) => /linkedin\.com\/in\//i.test(url)) || "",
    githubUrl: allUrls.find((url) => /github\.com\//i.test(url)) || "",
    portfolioUrl:
      allUrls.find(
        (url) => !/linkedin\.com|github\.com|tel:|mailto:/i.test(url)
      ) || "",
    links: allUrls,
  };
}

function extractLocation(sections) {
  const labelled = firstLabelledValue(sections.header, [
    "location",
    "address",
    "based in",
    "city",
  ]);
  if (labelled)
    return labelled.replace(/^[•·⋄▪◦*,\s|-]+|[•·⋄▪◦*,\s|-]+$/g, "");

  for (const line of sections.header) {
    const clean = line
      .replace(/^[•·⋄▪◦*-]\s*/, "")
      .replace(/\[.*?\]\(.*?\)/g, "")
      .trim();
    if (
      clean.length > 2 &&
      clean.length <= 80 &&
      KNOWN_LOCATIONS.test(clean) &&
      !/@/.test(clean) &&
      !ROLE_WORDS.test(clean)
    ) {
      return clean.replace(/^[•·⋄▪◦*,\s|-]+|[•·⋄▪◦*,\s|-]+$/g, "");
    }
  }
  return "";
}

function extractName(sections) {
  const labelled = firstLabelledValue(sections.header, [
    "full name",
    "name",
    "candidate name",
  ]);
  if (labelled)
    return labelled.replace(/^[•·⋄▪◦*\uF0B7,\s|-]+|[•·⋄▪◦*\uF0B7,\s|-]+$/g, "");

  const header = sections.header.slice(0, 10);
  for (const raw of header) {
    const line = raw
      .replace(/^[•·⋄▪◦*\uF0B7-]\s*/, "")
      .replace(/\[.*?\]\(.*?\)/g, "")
      .trim();
    if (
      line.length >= 3 &&
      line.length <= 60 &&
      !/[@:/|\d]/.test(line) &&
      !ROLE_WORDS.test(line) &&
      !KNOWN_LOCATIONS.test(line) &&
      !sectionForLine(line) &&
      !/\b(resume|curriculum vitae|cv)\b/i.test(line)
    ) {
      const words = line.split(/\s+/);
      if (
        words.length >= 2 &&
        words.length <= 5 &&
        /^[\p{L}][\p{L} .'’-]+$/u.test(line)
      ) {
        return line;
      }
    }
  }

  // Check if first two lines are single-word first name and last name
  const singleName = /^[\p{L}][\p{L}.'’-]+$/u;
  const h0 = header[0]?.trim();
  const h1 = header[1]?.trim();
  if (
    h0 &&
    h1 &&
    singleName.test(h0) &&
    singleName.test(h1) &&
    !ROLE_WORDS.test(h0) &&
    !ROLE_WORDS.test(h1) &&
    !KNOWN_LOCATIONS.test(h0) &&
    !KNOWN_LOCATIONS.test(h1)
  ) {
    return `${h0} ${h1}`;
  }

  const direct = header.find(
    (l) => l.length >= 3 && l.length <= 40 && !/[@:/|\d]/.test(l) && !ROLE_WORDS.test(l)
  );
  return direct ? direct.replace(/^[•·⋄▪◦*\uF0B7,\s|-]+|[•·⋄▪◦*\uF0B7,\s|-]+$/g, "") : "";
}

function extractSkills(lines, fullText = "") {
  const seen = new Set();
  const skills = [];

  const sourceLines =
    lines && lines.length > 0 ? lines : fullText.split("\n");

  for (const line of sourceLines) {
    let text = line.trim().replace(/\[.*?\]\(.*?\)/g, "");
    text = text.replace(CATEGORY_PREFIX, "");
    text = text.replace(/^[:|\-–—•·⋄▪◦*\uF0B7]+\s*/, "");

    for (const value of text.split(/[,;|•·⋄▪◦*\uF0B7]+/)) {
      const skill = value
        .replace(/^[\s\-–—•·⋄▪◦*\uF0B7]+|[\s.]+$/g, "")
        .trim();
      const key = skill.toLowerCase();
      if (
        !skill ||
        skill.length > 50 ||
        skill.split(/\s+/).length > 6 ||
        seen.has(key)
      )
        continue;
      if (
        /^(?:skills|technical|technologies|frameworks|tools|databases|concepts|languages|competencies|highlights)$/i.test(
          skill
        )
      )
        continue;
      seen.add(key);
      skills.push(skill);
    }
  }
  return skills.slice(0, 50);
}

function splitCompanyAndLocation(line) {
  let text = line.replace(/^[•·⋄▪◦*-]\s*/, "").trim();
  const match = text.match(
    /(?:,\s*|\s+)([A-Za-z]+(?:\s+[A-Za-z]+)?,\s*[A-Za-z]+|[A-Za-z]+(?:\s+[A-Za-z]+)?)$/
  );
  if (match) {
    let loc = match[1].trim();
    const parts = loc.split(/,\s*/);
    const words = parts[0].split(/\s+/);
    if (words.length > 1 && ROLE_OR_COMPANY.test(words[0])) {
      parts[0] = words.slice(1).join(" ");
      loc = parts.join(", ");
    }
    if (KNOWN_LOCATIONS.test(loc)) {
      const locIdx = text.lastIndexOf(loc);
      const company = text
        .slice(0, locIdx)
        .replace(/[\s,|-]+$/, "")
        .trim();
      return { company, location: loc };
    }
  }
  return { company: text, location: "" };
}

function parseDuration(startStr, endStr) {
  const isCurrent = /present|current|till/i.test(endStr);
  const startMonth = startStr.match(/[A-Za-z]+/)?.[0] || "";
  const startYear = startStr.match(/(?:19|20)\d{2}/)?.[0] || "";
  const endMonth = isCurrent ? "" : startStr.match(/[A-Za-z]+/)?.[0] || "";
  const endYear = isCurrent
    ? ""
    : endStr.match(/(?:19|20)\d{2}/)?.[0] || "";
  return {
    duration: `${startStr} - ${isCurrent ? "Present" : endStr}`,
    startMonth,
    startYear,
    endMonth,
    endYear,
    isCurrent,
  };
}

function extractExperience(lines) {
  const markers = [];
  lines.forEach((line, index) => {
    const match = line.match(DATE_RANGE);
    if (match) markers.push({ index, match });
  });

  return markers
    .map((marker, index) => {
      const prevIdx = index ? markers[index - 1].index : -1;
      const nextIdx = markers[index + 1]?.index ?? lines.length;
      const inline = lines[marker.index]
        .replace(marker.match[0], "")
        .trim();

      let title = "";
      let company = "";
      let location = "";
      let descStart = marker.index + 1;

      if (inline.length > 2) {
        if (ROLE_WORDS.test(inline)) {
          title = inline;
        } else {
          const split = splitCompanyAndLocation(inline);
          company = split.company;
          location = split.location;
        }
      }

      if (!title && marker.index > prevIdx + 1) {
        const candidates = lines
          .slice(prevIdx + 1, marker.index)
          .filter((l) => l.length < 80);
        title =
          candidates.find((l) => ROLE_WORDS.test(l)) || candidates[0] || "";
      }

      if (
        !company &&
        lines[descStart] &&
        lines[descStart].length < 80 &&
        !/^[•·⋄▪◦*-]/.test(lines[descStart])
      ) {
        const split = splitCompanyAndLocation(lines[descStart]);
        company = split.company;
        location = location || split.location;
        descStart += 1;
      }

      const description = lines
        .slice(descStart, nextIdx)
        .join(" ")
        .replace(/^[•·⋄▪◦*-]\s*/, "")
        .slice(0, 2000);

      const dur = parseDuration(
        marker.match[1].trim(),
        marker.match[2].trim()
      );
      return {
        title: title || "Software Specialist",
        jobRole: title || "Software Specialist",
        company: company || "Organization",
        companyName: company || "Organization",
        employmentType:
          (title + " " + company).match(
            /\b(full[- ]time|part[- ]time|contract|internship|intern|freelance)\b/i
          )?.[0] || "",
        startDate: marker.match[1].trim(),
        endDate: dur.isCurrent ? "Present" : marker.match[2].trim(),
        ...dur,
        location,
        description,
      };
    })
    .filter((item) => item.title || item.company);
}

function extractEducation(lines) {
  const markers = [];
  lines.forEach((line, index) => {
    const match =
      line.match(DATE_RANGE) || line.match(/\b((?:19|20)\d{2})\b/);
    if (match) markers.push({ index, match });
  });

  const entries = markers
    .map((marker) => {
      let line = lines[marker.index].replace(marker.match[0], "").trim();
      let prevLine = lines[marker.index - 1] || "";
      let institution = "";
      let degree = "";
      let field = "";

      const splitMatch = line.match(
        /^(.+?)\s*(?:,\s*|\s*[-–—]\s*|\s+(?:at|from)\s+)(.+)$/i
      );
      if (splitMatch) {
        if (DEGREE_WORDS.test(splitMatch[1])) {
          degree = splitMatch[1].trim();
          institution = splitMatch[2].trim();
        } else {
          institution = splitMatch[1].trim();
          degree = splitMatch[2].trim();
        }
      } else if (DEGREE_WORDS.test(line)) {
        degree = line;
        let nextLine = lines[marker.index + 1] || "";
        if (INSTITUTION_WORDS.test(prevLine)) institution = prevLine;
        else if (INSTITUTION_WORDS.test(nextLine)) institution = nextLine;
        else if (nextLine && !DEGREE_WORDS.test(nextLine) && nextLine.length < 80) institution = nextLine;
      } else if (INSTITUTION_WORDS.test(line)) {
        institution = line;
        let nextLine = lines[marker.index + 1] || "";
        if (DEGREE_WORDS.test(prevLine)) degree = prevLine;
        else if (DEGREE_WORDS.test(nextLine)) degree = nextLine;
      } else {
        degree = line || prevLine;
      }

      degree = degree.replace(/[\s\-–—:]+$/, "").trim();

      const fieldMatch = degree.match(/(?:in|:)\s+(.+)$/i);
      if (fieldMatch) field = fieldMatch[1].trim();

      const startYear =
        marker.match[1]?.match(/(?:19|20)\d{2}/)?.[0] || "";
      const endYear =
        marker.match[2]?.match(/(?:19|20)\d{2}/)?.[0] ||
        marker.match[1]?.match(/(?:19|20)\d{2}/)?.[0] ||
        "";

      return {
        institution,
        degree,
        field,
        startYear,
        endYear,
        location: "",
      };
    })
    .filter((e) => e.institution || e.degree);

  if (entries.length || !lines.length) return entries;
  const values = lines.filter((l) => l.length <= 100).slice(0, 3);
  const rawDegree = values.find((value) => DEGREE_WORDS.test(value)) || "";
  const year = rawDegree.match(/(?:19|20)\d{2}/)?.[0] || "";
  const degree = rawDegree
    .replace(/\s*[-–—]?\s*(?:19|20)\d{2}\s*$/, "")
    .trim();
  const institution = values.find((value) => value !== rawDegree) || "";
  const field =
    degree.match(/:\s*(.+)$/)?.[1]?.trim() ||
    degree.match(/\bin\s+(.+)$/i)?.[1]?.trim() ||
    "";
  return institution || degree
    ? [
        {
          institution,
          degree,
          field,
          startYear: "",
          endYear: year,
          location: "",
        },
      ]
    : [];
}

function extractProjects(lines) {
  if (!lines || !lines.length) return [];
  const fullText = lines.join("\n");
  const projects = [];

  const mdLinkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const matches = [...fullText.matchAll(mdLinkPattern)];

  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const rawTitle = match[1].replace(/[.:\-–—\s]+$/, "").trim();
      const link = match[2];
      const startPos = match.index + match[0].length;
      const endPos =
        i + 1 < matches.length ? matches[i + 1].index : fullText.length;
      const desc = fullText
        .slice(startPos, endPos)
        .replace(/^[•·⋄▪◦*:\-–—\s]+/, "")
        .replace(/\n+/g, " ")
        .trim();

      projects.push({
        title: rawTitle,
        link,
        description: desc,
      });
    }
    return projects;
  }

  let current = null;
  for (const raw of lines) {
    const clean = raw.replace(/^[•·⋄▪◦*-]\s*/, "").trim();
    if (!clean) continue;
    const split = clean.match(
      /^([A-Za-z0-9_.\s-]{2,40}?)(?:\s*[:|\-–—]\s*|\s+(\([A-Za-z0-9_.,\s+-]+\))\s+|\s{2,}|\s+(?=[A-Z][a-z]+ing\b|[A-Z][a-z]+ed\b|Peer-to-peer|Full-stack|Natural-language|AI-powered|Production-grade|Developed|Designed|Built|Crafted))(.*)$/
    );
    if (split) {
      if (current) projects.push(current);
      current = { title: split[1].trim(), description: split[3].trim() };
    } else if (clean.length < 50 && !/[.!?]$/.test(clean) && !current) {
      current = { title: clean, description: "" };
    } else if (current) {
      current.description = current.description
        ? current.description + " " + clean
        : clean;
    } else {
      current = { title: clean.slice(0, 40), description: clean };
    }
  }
  if (current) projects.push(current);
  return projects;
}

function extractCertifications(lines) {
  if (!lines || !lines.length) return [];
  const list = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const isBullet = /^[•·⋄▪◦*-]\s*/.test(raw);
    const line = raw.replace(/^[•·⋄▪◦*-]\s*/, "").trim();

    if (isBullet || !current) {
      if (current) list.push(current);
      const mdMatch = line.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)\s*(.*)$/);
      if (mdMatch) {
        current = {
          title: mdMatch[1].replace(/[\s\-–—]+$/, "").trim(),
          link: mdMatch[2],
          description: mdMatch[3].trim(),
        };
        continue;
      }

      const match = line.match(
        /^([A-Za-z0-9_.\s\-–—()]{3,50}?)(?:\s*[:|\-–—]\s*|\s+(?=[A-Z][a-z]+ed\b|Recognized|Secured|Completed|Issued|Received|Awarded|As\s+a\b))(.*)$/
      );
      if (match && match[2] && match[2].length > 10) {
        current = {
          title: match[1].replace(/[\s\-–—]+$/, "").trim(),
          description: match[2].trim(),
        };
      } else {
        current = { title: line, description: "" };
      }
    } else {
      current.description = current.description
        ? current.description + " " + line
        : line;
    }
  }
  if (current) list.push(current);
  return list;
}

function calculateTotalExperience(experienceList) {
  if (!Array.isArray(experienceList) || !experienceList.length) return 0;
  const currentYear = new Date().getFullYear();
  let totalYears = 0;

  for (const exp of experienceList) {
    const startYear = parseInt(exp.startYear, 10);
    const endYear = exp.isCurrent ? currentYear : parseInt(exp.endYear, 10);
    if (startYear && endYear && endYear >= startYear) {
      totalYears += Math.max(0.5, endYear - startYear);
    } else if (startYear) {
      totalYears += 1;
    }
  }
  return Math.min(40, Math.round(totalYears * 10) / 10);
}

function parseResumeText(text) {
  const lines = cleanLines(text);
  const sections = splitSections(lines);
  const fullName = extractName(sections);
  const experience = extractExperience(sections.experience);
  const education = extractEducation(sections.education);
  const skills = extractSkills(sections.skills, text);
  const projects = extractProjects(sections.projects);
  const certifications = extractCertifications(sections.certifications);
  const links = extractLinks(text);

  const labelledHeadline = firstLabelledValue(sections.header, [
    "headline",
    "designation",
    "title",
    "role",
  ]);
  const headerHeadline = sections.header.find(
    (line) =>
      line !== fullName &&
      line.length <= 100 &&
      ROLE_WORDS.test(line) &&
      !/@/.test(line)
  );

  const headline = (
    labelledHeadline ||
    headerHeadline ||
    experience[0]?.title ||
    "Software Developer"
  ).replace(/[\s\-–—:,|]+$/, "").trim();
  const bio = sections.summary.join(" ").slice(0, 2000);
  const totalExperienceYears = calculateTotalExperience(experience);

  return {
    fullName,
    name: fullName,
    email: extractEmail(text),
    phone: extractPhone(text, sections),
    location: extractLocation(sections),
    headline,
    designation: headline,
    bio,
    summary: bio,
    skills,
    experience,
    expriences: experience,
    education,
    projects,
    certifications,
    achievements: certifications,
    totalExperienceYears,
    experienceYears: totalExperienceYears,
    ...links,
  };
}

async function parsePdfResume(filePath) {
  const data = await fs.readFile(filePath);
  // Flexible PDF magic byte check: %PDF- can appear anywhere within the first 1024 bytes
  const pdfMagicIndex = data.indexOf("%PDF-");
  if (pdfMagicIndex === -1 || pdfMagicIndex > 1024) {
    throw new Error("The uploaded file is not a valid PDF.");
  }

  const parser = new PDFParse({ data });
  try {
    let result;
    try {
      // First try extracting with hyperlinks enabled
      result = await parser.getText({ parseHyperlinks: true, first: 30 });
    } catch {
      // Fallback if hyperlink parsing encounters malformed annotations
      result = await parser.getText({ first: 30 });
    }

    if (!result?.text?.trim()) {
      throw new Error(
        "This PDF contains no readable text. Scanned PDFs are not supported yet."
      );
    }
    return parseResumeText(result.text);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

module.exports = { parsePdfResume, parseResumeText };
