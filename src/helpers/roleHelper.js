/**
 * Role category verification and conflict resolution helper.
 * Enforces AUTH-02: Clear separation between Client and Candidate accounts.
 */

const CLIENT_ROLES = new Set(["client", "company", "individual", "employer"]);
const CANDIDATE_ROLES = new Set(["personal", "candidate", "jobseeker"]);

function normalizeRole(role) {
  return String(role || "").toLowerCase().trim();
}

function isClientRole(role) {
  return CLIENT_ROLES.has(normalizeRole(role));
}

function isCandidateRole(role) {
  const norm = normalizeRole(role);
  // Default unassigned roles or personal are treated as Candidate persona
  return CANDIDATE_ROLES.has(norm) || norm === "";
}

/**
 * Checks for role conflicts between existing account role and requested role.
 * @param {string} existingRole The role currently stored in the DB
 * @param {string} targetRole The role requested during login / registration
 * @returns {string|null} Conflict error message or null if no conflict
 */
function checkRoleConflict(existingRole, targetRole) {
  if (!existingRole || !targetRole) return null;

  const existingIsClient = isClientRole(existingRole);
  const targetIsClient = isClientRole(targetRole);

  const existingIsCandidate = isCandidateRole(existingRole);
  const targetIsCandidate = isCandidateRole(targetRole);

  if (existingIsClient && targetIsCandidate) {
    return "This email is already registered as a Client. Please log in through the Client Portal.";
  }

  if (existingIsCandidate && targetIsClient) {
    return "This email is already registered as a Candidate. Please log in through the Candidate Portal.";
  }

  return null;
}

module.exports = {
  isClientRole,
  isCandidateRole,
  checkRoleConflict,
};
