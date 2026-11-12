const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { parsePdfResume, parseResumeText } = require("../helpers/resumeParser");

test("Resume Parser extracts all fields from SahilBajaj.pdf", async () => {
  const filePath = path.join(
    __dirname,
    "../../public/temp/function now() { [native code] }-777478457-SahilBajaj.pdf"
  );
  if (!fs.existsSync(filePath)) return;

  const result = await parsePdfResume(filePath);
  assert.equal(result.fullName, "SAHIL BAJAJ");
  assert.equal(result.email, "sahilbajaj2004@gmail.com");
  assert.equal(result.phone, "+919811057531");
  assert.equal(result.location, "Delhi, India");
  assert.equal(result.headline, "Full Stack developer");
  assert.ok(result.skills.length >= 25, "Should extract technical skills");
  assert.ok(result.skills.includes("JavaScript"));
  assert.ok(result.skills.includes("React.js"));
  assert.ok(result.skills.includes("Next.js"));
  assert.ok(!result.skills.some(s => s.startsWith("Technical Skills")), "Should strip category prefixes");
  assert.equal(result.experience.length, 2);
  assert.equal(result.experience[0].company, "Blackspire");
  assert.equal(result.experience[0].location, "Delhi, India");
  assert.equal(result.education.length, 1);
  assert.equal(result.education[0].institution, "CCS University");
  assert.equal(result.education[0].degree, "Bachelor of Computer Application");
  assert.equal(result.projects.length, 5);
  assert.equal(result.projects[0].title, "LetsMeet");
  assert.equal(result.projects[0].link, "https://github.com/sahilbajaj2004/LetsMeet");
  assert.equal(result.certifications.length, 2);
  assert.equal(result.linkedinUrl, "https://www.linkedin.com/in/sahilbajaj2004/");
  assert.equal(result.githubUrl, "https://github.com/sahilbajaj2004");
  assert.equal(result.portfolioUrl, "https://sahilbajajportfolio.vercel.app/");
});

test("Resume Parser extracts all fields from meghapantcv.pdf", async () => {
  const filePath = path.join(
    __dirname,
    "../../public/temp/function now() { [native code] }-940904515-meghapantcv.pdf"
  );
  if (!fs.existsSync(filePath)) return;

  const result = await parsePdfResume(filePath);
  assert.equal(result.fullName, "MEGHA PANT");
  assert.equal(result.email, "pantmegha195@gmail.com");
  assert.equal(result.phone, "+919258581085");
  assert.equal(result.location, "Delhi, India");
  assert.equal(result.headline, "Full Stack Developer");
  assert.ok(result.skills.length >= 15);
  assert.ok(result.skills.includes("JavaScript"));
  assert.ok(result.skills.includes("React.js"));
  assert.equal(result.experience.length, 1);
  assert.equal(result.experience[0].company, "Freelancer");
  assert.equal(result.education.length, 1);
  assert.equal(result.education[0].institution, "CCS University");
  assert.equal(result.projects.length, 4);
  assert.equal(result.projects[0].title, "See My Glasses");
  assert.equal(result.projects[0].link, "https://see-my-glasses-55re.vercel.app/");
  assert.equal(result.certifications.length, 2);
  assert.equal(result.linkedinUrl, "https://www.linkedin.com/in/meghapantdev/");
  assert.equal(result.githubUrl, "https://github.com/meghapant2006");
  assert.equal(result.portfolioUrl, "https://see-my-glasses-55re.vercel.app/");
});

test("Resume Parser handles sample.pdf with labelled headers and two-line name", async () => {
  const filePath = path.join(
    __dirname,
    "../../public/temp/function now() { [native code] }-109720170-sample.pdf"
  );
  if (!fs.existsSync(filePath)) return;

  const result = await parsePdfResume(filePath);
  assert.equal(result.fullName, "CHRISTOPHER MORGAN");
  assert.equal(result.email, "christoper.morgan@gmail.com");
  assert.equal(result.phone, "+44 (0)20 7666 8555");
  assert.equal(result.location, "177 Great Portland Street, London W5W 6PQ");
  assert.equal(result.headline, "Web Developer");
  assert.equal(result.skills.length, 6);
  assert.ok(!result.skills[0].includes(""), "Should strip bullets from skills");
  assert.equal(result.experience.length, 1);
  assert.equal(result.experience[0].company, "Luna Web Design");
  assert.equal(result.education.length, 1);
  assert.equal(result.education[0].institution, "Columbia University, NY");
});
