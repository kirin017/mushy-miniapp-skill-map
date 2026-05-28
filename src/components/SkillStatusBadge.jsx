import React from 'react';

export default function SkillStatusBadge({ status }) {
  const usable = status === 'usable';

  return (
    <span className={`skill-status ${usable ? 'skill-status--usable' : 'skill-status--learning'}`}>
      <span className="skill-status__dot" aria-hidden="true" />
      {usable ? 'Dùng được' : 'Đang học'}
    </span>
  );
}
