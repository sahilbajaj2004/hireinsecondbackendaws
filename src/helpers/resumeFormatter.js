/**
 * resumeFormatter.js
 * Helpers for sanitizing candidate experience/education, cleaning skills,
 * and generating the standardized branded HireInSecond ATS resume.
 */

function cleanSkills(list) {
  if (!list) return [];
  if (typeof list === "string") {
    try {
      const parsed = JSON.parse(list);
      if (Array.isArray(parsed)) list = parsed;
      else list = list.split(",");
    } catch {
      list = list.split(",");
    }
  }
  if (!Array.isArray(list)) return [];

  const categoryHeaders = [
    /^Technical Skills\s+/i,
    /^Programming Languages\s+/i,
    /^Languages & Databases\s+/i,
    /^Languages\s+/i,
    /^Frontend\s+/i,
    /^Backend\s+/i,
    /^Frameworks & Libraries\s+/i,
    /^Frameworks\/Technologies\s+/i,
    /^Frameworks\s+/i,
    /^Libraries\s+/i,
    /^Databases & Caching\s+/i,
    /^Databases\s+/i,
    /^Tools & Platforms\s+/i,
    /^Developer Tools\s+/i,
    /^Tools\s+/i,
    /^Concepts\s+/i,
    /^Core Competencies\s+/i,
    /^Cloud & DevOps\s+/i,
    /^Soft Skills\s+/i,
  ];

  const cleaned = [];
  for (let s of list) {
    if (typeof s !== "string") continue;
    for (const re of categoryHeaders) {
      s = s.replace(re, "").trim();
    }
    s = s.trim();
    if (s && !cleaned.includes(s)) {
      cleaned.push(s);
    }
  }
  return cleaned;
}

function sanitizeExperiences(list, parsedResumeExp) {
  const initial = (Array.isArray(list) ? list : []).filter((item) => {
    if (!item) return false;
    if (typeof item === "string") return item.trim().length > 0;
    if (typeof item === "object") {
      return Boolean(
        item.title ||
        item.role ||
        item.jobRole ||
        item.designation ||
        item.company ||
        item.companyName ||
        item.description
      );
    }
    return false;
  });

  const source =
    initial.length > 0
      ? initial
      : (Array.isArray(parsedResumeExp) ? parsedResumeExp : []).filter((item) => {
          if (!item) return false;
          if (typeof item === "string") return item.trim().length > 0;
          if (typeof item === "object") {
            return Boolean(item.title || item.role || item.company || item.description);
          }
          return false;
        });

  return source.map((item) => {
    if (typeof item === "string") {
      return {
        title: item,
        company: "Enterprise Organization",
        dates: "Verified",
        location: "India",
        description: item,
      };
    }
    return {
      title: item.title || item.role || item.jobRole || item.designation || "Software Specialist",
      company: item.company || item.companyName || "Technology Partner",
      dates: item.dates || item.duration || (item.startDate ? `${item.startDate} — ${item.endDate || "Present"}` : (item.startYear ? `${item.startMonth ? item.startMonth + ' ' : ''}${item.startYear} — ${item.isCurrent ? 'Present' : (item.endYear || 'Present')}` : "Recent")),
      location: item.location || "",
      description: item.description || (Array.isArray(item.bullets) ? item.bullets.join("\n") : ""),
    };
  });
}

function sanitizeEducation(list, parsedResumeEdu) {
  const initial = (Array.isArray(list) ? list : []).filter((item) => {
    if (!item) return false;
    if (typeof item === "string") return item.trim().length > 0;
    if (typeof item === "object") {
      return Boolean(
        item.institution ||
        item.school ||
        item.university ||
        item.college ||
        item.degree ||
        item.degreeName ||
        item.field ||
        item.course
      );
    }
    return false;
  });

  const source =
    initial.length > 0
      ? initial
      : (Array.isArray(parsedResumeEdu) ? parsedResumeEdu : []).filter((item) => {
          if (!item) return false;
          if (typeof item === "string") return item.trim().length > 0;
          if (typeof item === "object") {
            return Boolean(item.institution || item.school || item.degree || item.field);
          }
          return false;
        });

  return source.map((item) => {
    if (typeof item === "string") {
      return {
        institution: item,
        degree: "Degree / Certification",
        field: "",
        startYear: "",
        endYear: "",
        location: "",
      };
    }
    return {
      institution: item.institution || item.school || item.university || item.college || "Accredited University",
      degree: item.degree || item.degreeName || "Bachelor of Technology / Equivalent",
      field: item.field || item.major || item.specialization || item.course || "",
      startYear: item.startYear || "",
      endYear: item.endYear || item.year || item.graduationYear || "",
      location: item.location || "",
    };
  });
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateStandardizedResumeHtml(candidate) {
  const {
    name = "Candidate",
    title = "Software Engineer",
    location = "India",
    email = "",
    phone = "",
    maskedEmail = "",
    maskedPhone = "",
    bio = "",
    skills = [],
    experiences = [],
    education = [],
    isVerified = true,
    isCandidateSelf = false,
  } = candidate;

  const displayEmail = isCandidateSelf ? (email || maskedEmail) : (maskedEmail || email);
  const displayPhone = isCandidateSelf ? (phone || maskedPhone) : (maskedPhone || phone);

  const skillsHtml = skills
    .slice(0, 20)
    .map((s) => `<span class="skill-tag">${escapeHtml(s)}</span>`)
    .join("\n");

  const experiencesHtml = experiences.length > 0
    ? experiences.map((exp) => `
      <div class="timeline-item">
        <div class="timeline-header">
          <div class="timeline-title">${escapeHtml(exp.title)}</div>
          <div class="timeline-date">${escapeHtml(exp.dates)}</div>
        </div>
        <div class="timeline-subtitle">
          <span class="timeline-company">${escapeHtml(exp.company)}</span>
          ${exp.location ? `<span class="timeline-location">• ${escapeHtml(exp.location)}</span>` : ""}
        </div>
        ${exp.description ? `
          <div class="timeline-desc">
            ${exp.description
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => {
                const clean = line.replace(/^[•\-\*]\s*/, "");
                return `<p class="bullet-item"><span class="bullet-dot">•</span> ${escapeHtml(clean)}</p>`;
              })
              .join("")}
          </div>
        ` : ""}
      </div>
    `).join("")
    : `<p class="empty-state">No formal work experience added yet.</p>`;

  const educationHtml = education.length > 0
    ? education.map((edu) => `
      <div class="timeline-item">
        <div class="timeline-header">
          <div class="timeline-title">${escapeHtml(edu.degree)}${edu.field ? ` in ${escapeHtml(edu.field)}` : ""}</div>
          <div class="timeline-date">${escapeHtml(edu.endYear ? (edu.startYear ? `${edu.startYear} — ${edu.endYear}` : edu.endYear) : "")}</div>
        </div>
        <div class="timeline-subtitle">
          <span class="timeline-company">${escapeHtml(edu.institution)}</span>
          ${edu.location ? `<span class="timeline-location">• ${escapeHtml(edu.location)}</span>` : ""}
        </div>
      </div>
    `).join("")
    : `<p class="empty-state">Education details not specified on profile.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(name)} — HireInSecond Standardized Resume</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #0F172A;
      --primary-accent: #2563EB;
      --secondary-accent: #059669;
      --surface: #FFFFFF;
      --surface-subtle: #F8FAFC;
      --border: #E2E8F0;
      --border-strong: #CBD5E1;
      --text-main: #0F172A;
      --text-muted: #64748B;
      --tag-bg: #EFF6FF;
      --tag-text: #1D4ED8;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #F1F5F9;
      color: var(--text-main);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    .action-bar {
      position: sticky;
      top: 0;
      background: #0B132B;
      color: #FFFFFF;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.18);
      z-index: 1000;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex-shrink: 1;
    }

    .brand-logo-text {
      font-weight: 800;
      font-size: 15px;
      letter-spacing: 0.5px;
      color: #FFFFFF;
      white-space: nowrap;
      text-transform: uppercase;
      display: inline-flex;
      align-items: center;
    }

    .brand-pill {
      background: #10B981;
      color: #FFFFFF;
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
    }

    .btn-print {
      background: #2563EB;
      color: #FFFFFF;
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      white-space: nowrap;
      flex-shrink: 0;
      transition: background 0.2s, transform 0.1s;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
    }

    .btn-print:hover {
      background: #1D4ED8;
    }

    .btn-print:active {
      transform: scale(0.97);
    }

    .btn-text-mobile {
      display: none;
    }

    .resume-page {
      max-width: 820px;
      margin: 32px auto;
      background: #FFFFFF;
      padding: 48px;
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
      position: relative;
    }

    .resume-header {
      border-bottom: 2px solid var(--border);
      padding-bottom: 24px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
    }

    .candidate-info {
      flex: 1;
    }

    .candidate-name {
      font-size: 30px;
      font-weight: 800;
      color: var(--primary);
      letter-spacing: -0.5px;
      margin-bottom: 4px;
    }

    .candidate-role {
      font-size: 17px;
      font-weight: 600;
      color: var(--primary-accent);
      margin-bottom: 12px;
    }

    .contact-row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 13px;
      color: var(--text-muted);
    }

    .contact-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .header-badge {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      text-align: right;
    }

    .verified-stamp {
      border: 1.5px solid #10B981;
      background: #ECFDF5;
      color: #065F46;
      font-size: 11px;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .watermark-sub {
      font-size: 10px;
      color: var(--text-muted);
      margin-top: 4px;
      letter-spacing: 0.3px;
    }

    .section-block {
      margin-bottom: 24px;
    }

    .section-title {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: var(--primary);
      border-bottom: 1.5px solid var(--border);
      padding-bottom: 6px;
      margin-bottom: 14px;
    }

    .bio-text {
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
    }

    .skills-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .skill-tag {
      background: var(--tag-bg);
      color: var(--tag-text);
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid #BFDBFE;
    }

    .timeline-item {
      margin-bottom: 18px;
      page-break-inside: avoid;
    }

    .timeline-item:last-child {
      margin-bottom: 0;
    }

    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 2px;
    }

    .timeline-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--primary);
    }

    .timeline-date {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
    }

    .timeline-subtitle {
      font-size: 13px;
      color: var(--primary-accent);
      font-weight: 600;
      margin-bottom: 6px;
    }

    .timeline-location {
      font-weight: 400;
      color: var(--text-muted);
    }

    .timeline-desc {
      font-size: 13px;
      color: #334155;
      line-height: 1.55;
    }

    .bullet-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 4px;
    }

    .bullet-dot {
      color: var(--primary-accent);
      font-weight: bold;
      margin-right: 6px;
      flex-shrink: 0;
    }

    .empty-state {
      font-size: 13px;
      color: var(--text-muted);
      font-style: italic;
    }

    .footer-stamp {
      border-top: 1px solid var(--border);
      padding-top: 16px;
      margin-top: 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: var(--text-muted);
    }

    @media (max-width: 640px) {
      .action-bar {
        padding: 10px 14px;
        gap: 8px;
      }

      .brand-group {
        gap: 8px;
      }

      .brand-logo-text {
        font-size: 13px;
        letter-spacing: 0.3px;
      }

      .brand-pill {
        font-size: 9px;
        padding: 2px 6px;
      }

      .btn-print {
        padding: 6px 12px;
        font-size: 12px;
        gap: 5px;
      }

      .btn-text-full {
        display: none;
      }

      .btn-text-mobile {
        display: inline;
      }

      .resume-page {
        margin: 12px auto 24px auto;
        padding: 20px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
      }

      .resume-header {
        flex-direction: column-reverse;
        align-items: flex-start;
        gap: 12px;
        padding-bottom: 16px;
        margin-bottom: 18px;
      }

      .header-badge {
        width: 100%;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        text-align: left;
        padding-bottom: 10px;
        border-bottom: 1px dashed var(--border);
      }

      .watermark-sub {
        margin-top: 0;
      }

      .candidate-name {
        font-size: 24px;
        line-height: 1.2;
      }

      .candidate-role {
        font-size: 15px;
        margin-bottom: 10px;
      }

      .contact-row {
        gap: 8px 12px;
        font-size: 12px;
      }

      .footer-stamp {
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
        font-size: 10px;
      }
    }

    @media print {
      body {
        background: #FFFFFF !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .no-print {
        display: none !important;
      }

      .resume-page {
        margin: 0 !important;
        padding: 0 !important;
        max-width: 100% !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }

      .skill-tag {
        border: 1px solid #94A3B8 !important;
        background: #F1F5F9 !important;
        color: #0F172A !important;
      }

      @page {
        size: A4;
        margin: 12mm 15mm;
      }
    }
  </style>
</head>
<body>
  <div class="action-bar no-print">
    <div class="brand-group">
      <span class="brand-logo-text">HIRE IN SECOND</span>
      <span class="brand-pill">ATS Verified</span>
    </div>
    <button class="btn-print" onclick="window.print()" title="Print or save candidate resume">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 6 2 18 2 18 9"></polyline>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>
      <span class="btn-text-full">Print / Save as PDF</span>
      <span class="btn-text-mobile">Print PDF</span>
    </button>
  </div>

  <main class="resume-page">
    <header class="resume-header">
      <div class="candidate-info">
        <h1 class="candidate-name">${escapeHtml(name)}</h1>
        <h2 class="candidate-role">${escapeHtml(title)}</h2>
        <div class="contact-row">
          ${location ? `<div class="contact-item">📍 ${escapeHtml(location)}</div>` : ""}
          ${displayEmail ? `<div class="contact-item">✉️ ${escapeHtml(displayEmail)}</div>` : ""}
          ${displayPhone ? `<div class="contact-item">📞 ${escapeHtml(displayPhone)}</div>` : ""}
        </div>
      </div>
      <div class="header-badge">
        <div class="verified-stamp">
          ${isVerified ? "✓ Verified Talent" : "Candidate Profile"}
        </div>
        <div class="watermark-sub">HireInSecond ATS Standard</div>
      </div>
    </header>

    ${bio ? `
      <section class="section-block">
        <h3 class="section-title">Professional Summary</h3>
        <p class="bio-text">${escapeHtml(bio)}</p>
      </section>
    ` : ""}

    ${skills.length > 0 ? `
      <section class="section-block">
        <h3 class="section-title">Skills &amp; Technologies</h3>
        <div class="skills-grid">
          ${skillsHtml}
        </div>
      </section>
    ` : ""}

    <section class="section-block">
      <h3 class="section-title">Work Experience</h3>
      ${experiencesHtml}
    </section>

    <section class="section-block">
      <h3 class="section-title">Education &amp; Credentials</h3>
      ${educationHtml}
    </section>

    <footer class="footer-stamp">
      <span>Standardized Profile generated by HireInSecond Platform</span>
      <span>Authenticity ID: HIS-${escapeHtml(String(candidate.id || candidate._id || "VERIFIED").slice(-8).toUpperCase())}</span>
    </footer>
  </main>
</body>
</html>`;
}

module.exports = {
  cleanSkills,
  sanitizeExperiences,
  sanitizeEducation,
  generateStandardizedResumeHtml,
};
