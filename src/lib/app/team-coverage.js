export const COVERAGE_STATUS_PRIORITY = ['missing', 'thin', 'growing', 'healthy'];

const STATUS_ACTIONS = {
  healthy: 'Duy trì coverage',
  thin: 'Thêm backup',
  missing: 'Cần primary owner',
  growing: 'Ghép trainee với mentor',
};

const STATUS_RANK = new Map(COVERAGE_STATUS_PRIORITY.map((status, index) => [status, index]));

export function deriveTeamCoverage({ skills = [], members = [], query = '', mode = 'grouped' } = {}) {
  const normalizedQuery = normalizeText(query);
  const allRows = skills
    .map((skill) => deriveSkillCoverage({ skill, members }))
    .filter((row) => matchesQuery(row, normalizedQuery))
    .filter((row) => matchesMode(row, mode))
    .sort(compareCoverageRows);

  const groupsByCategory = new Map();
  for (const row of allRows) {
    const category = row.category || 'Custom';
    if (!groupsByCategory.has(category)) {
      groupsByCategory.set(category, {
        category,
        skillCount: 0,
        healthyCount: 0,
        thinCount: 0,
        missingCount: 0,
        growingCount: 0,
        topActions: [],
        rows: [],
      });
    }
    const group = groupsByCategory.get(category);
    group.skillCount += 1;
    group[`${row.status}Count`] += 1;
    group.rows.push(row);
  }

  const groups = [...groupsByCategory.values()]
    .map((group) => ({
      ...group,
      rows: group.rows.sort(compareCoverageRows),
      topActions: group.rows.filter((row) => row.status !== 'healthy').slice(0, 3),
    }))
    .sort(compareCoverageGroups);

  const actions = allRows.filter((row) => row.status !== 'healthy').sort(compareCoverageRows);
  const statusCounts = allRows.reduce((counts, row) => {
    counts[row.status] += 1;
    return counts;
  }, { healthy: 0, thin: 0, missing: 0, growing: 0 });

  return {
    groups,
    actions,
    allRows,
    visibleRowCount: allRows.length,
    statusCounts,
  };
}

export function deriveSkillCoverage({ skill, members = [] }) {
  const people = members.map((member) => {
    const level = clampInteger(member.skills?.[skill?.id], 0, 4);
    const interest = clampInteger(member.interests?.[skill?.id], 0, 3);
    return { ...member, level, interest };
  });

  const primaries = people
    .filter((member) => member.level >= 3)
    .sort(comparePeopleForLead);
  const primary = primaries[0] || null;
  const mentors = people
    .filter((member) => member.level >= 4)
    .sort(comparePeopleForLead);
  const backups = people
    .filter((member) => member.level >= 2 && getMemberId(member) !== getMemberId(primary))
    .sort(comparePeopleForLead);
  const trainees = people
    .filter((member) => member.interest >= 2 && member.level <= 2)
    .sort((a, b) => b.interest - a.interest || b.level - a.level || compareNames(a, b));

  const status = getCoverageStatus({ primary, backups, trainees });

  return {
    skill,
    category: skill?.category || 'Custom',
    status,
    action: STATUS_ACTIONS[status],
    primary,
    mentors,
    backups,
    trainees,
    people: uniquePeople([primary, ...mentors, ...backups, ...trainees]),
  };
}

function getCoverageStatus({ primary, backups, trainees }) {
  if (primary && backups.length > 0) return 'healthy';
  if (primary) return 'thin';
  if (trainees.length > 0) return 'growing';
  return 'missing';
}

function matchesMode(row, mode) {
  if (mode === 'needs') return row.status === 'missing' || row.status === 'thin';
  if (mode === 'growth') return row.status === 'growing';
  return true;
}

function matchesQuery(row, normalizedQuery) {
  if (!normalizedQuery) return true;
  const peopleText = row.people.map((member) => `${member.name || ''} ${member.handle || ''}`).join(' ');
  return normalizeText(`${row.skill?.name || ''} ${row.category || ''} ${peopleText}`).includes(normalizedQuery);
}

function compareCoverageGroups(a, b) {
  return groupSeverity(a) - groupSeverity(b)
    || String(a.category || '').localeCompare(String(b.category || ''), 'vi');
}

function groupSeverity(group) {
  if (group.missingCount > 0) return 0;
  if (group.thinCount > 0) return 1;
  if (group.growingCount > 0) return 2;
  return 3;
}

function compareCoverageRows(a, b) {
  return STATUS_RANK.get(a.status) - STATUS_RANK.get(b.status)
    || String(a.category || '').localeCompare(String(b.category || ''), 'vi')
    || String(a.skill?.name || '').localeCompare(String(b.skill?.name || ''), 'vi');
}

function comparePeopleForLead(a, b) {
  return b.level - a.level || b.interest - a.interest || compareNames(a, b);
}

function compareNames(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
}

function uniquePeople(people) {
  const seen = new Set();
  return people.filter((member) => {
    const memberId = getMemberId(member);
    if (!memberId || seen.has(memberId)) return false;
    seen.add(memberId);
    return true;
  });
}

function getMemberId(member) {
  return member?.id || member?.userId;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

function clampInteger(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
